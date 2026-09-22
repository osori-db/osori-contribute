import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePreValidation, type IndexedRow } from './usePreValidation'
import { hasValidationFailure } from '@/lib/field-hints'
import { urlResultToHint, type UrlCheckResult } from '@/lib/url-check'
import type { UrlCheckMap } from '@/lib/pre-validation'

// ─── Mocks ───

let mockToken: string | null = 'test-token'
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: mockToken }),
}))

const mockCheckUrls = vi.fn()
vi.mock('@/lib/api-client', () => ({
  checkUrls: (...args: unknown[]) => mockCheckUrls(...args),
}))

// ─── Helpers ───

interface TestRow {
  readonly name: string
  readonly urls: readonly string[]
}

const collectUrls = (row: TestRow): readonly string[] => row.urls

/** URL 결과를 그대로 힌트로 옮긴다 — 훅이 무엇을 넘기는지 관찰하기 위한 최소 구현. */
const buildHints = (row: TestRow, urlResults?: UrlCheckMap) => {
  if (!urlResults) return {}
  const hints = row.urls
    .map((url) => urlResults.get(url))
    .filter((result): result is UrlCheckResult => result !== undefined)
    .map(urlResultToHint)
    .filter((hint) => hint !== null)
  return hints.length > 0 ? { url: hints } : {}
}

function makeTargets(rows: readonly TestRow[]): readonly IndexedRow<TestRow>[] {
  return rows.map((row, index) => ({ row, index }))
}

function okResult(url: string): UrlCheckResult {
  return { url, outcome: 'ok', status: 200, reason: null }
}

function failResult(url: string): UrlCheckResult {
  return { url, outcome: 'unreachable', status: 404, reason: 'HTTP 404' }
}

/** 요청받은 URL 을 전부 성공으로 응답한다. */
function respondOk() {
  mockCheckUrls.mockImplementation((_token: string, urls: readonly string[]) =>
    Promise.resolve({ success: true, data: { results: urls.map(okResult) } }),
  )
}

function renderPreValidation() {
  return renderHook(() => usePreValidation<TestRow>({ collectUrls, buildHints }))
}

beforeEach(() => {
  mockToken = 'test-token'
  mockCheckUrls.mockReset()
})

// ─── Tests ───

describe('usePreValidation 초기 상태', () => {
  it('결과 없이 시작한다', () => {
    const { result } = renderPreValidation()

    expect(result.current.results).toEqual({})
    expect(result.current.running).toBe(false)
    expect(result.current.progress).toEqual({ current: 0, total: 0 })
    expect(result.current.error).toBeNull()
  })
})

describe('usePreValidation 검증 실행', () => {
  it('행 인덱스를 키로 결과를 저장한다', async () => {
    respondOk()
    const { result } = renderPreValidation()
    const targets = makeTargets([
      { name: 'a', urls: ['https://a.example.com'] },
      { name: 'b', urls: ['https://b.example.com'] },
    ])

    await act(async () => {
      await result.current.validate(targets)
    })

    expect(Object.keys(result.current.results)).toEqual(['0', '1'])
    expect(result.current.results[0].urlChecked).toBe(true)
    expect(result.current.results[0].checkedAt).toBeGreaterThan(0)
    expect(result.current.error).toBeNull()
  })

  it('URL 을 중복 제거해 한 번만 요청한다', async () => {
    respondOk()
    const { result } = renderPreValidation()
    const shared = 'https://shared.example.com'

    await act(async () => {
      await result.current.validate(
        makeTargets([
          { name: 'a', urls: [shared] },
          { name: 'b', urls: [shared] },
          { name: 'c', urls: [shared, 'https://c.example.com'] },
        ]),
      )
    })

    expect(mockCheckUrls).toHaveBeenCalledTimes(1)
    expect(mockCheckUrls.mock.calls[0][1]).toEqual([shared, 'https://c.example.com'])
  })

  it('검사 결과가 행 힌트에 반영된다', async () => {
    mockCheckUrls.mockResolvedValue({
      success: true,
      data: { results: [failResult('https://gone.example.com')] },
    })
    const { result } = renderPreValidation()

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls: ['https://gone.example.com'] }]))
    })

    expect(hasValidationFailure(result.current.results[0].hints)).toBe(true)
  })

  it('URL 이 없는 행도 결과를 남긴다 (요청은 하지 않는다)', async () => {
    respondOk()
    const { result } = renderPreValidation()

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls: [] }]))
    })

    expect(mockCheckUrls).not.toHaveBeenCalled()
    expect(result.current.results[0].urlChecked).toBe(true)
  })

  it('실행이 끝나면 running 이 false 로 돌아온다', async () => {
    respondOk()
    const { result } = renderPreValidation()

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls: ['https://a.example.com'] }]))
    })

    expect(result.current.running).toBe(false)
  })
})

describe('usePreValidation 청크 분할', () => {
  it('50개를 넘으면 나눠서 순차 요청한다', async () => {
    respondOk()
    const { result } = renderPreValidation()
    const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/${i}`)

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls }]))
    })

    expect(mockCheckUrls).toHaveBeenCalledTimes(2)
    expect(mockCheckUrls.mock.calls[0][1]).toHaveLength(50)
    expect(mockCheckUrls.mock.calls[1][1]).toHaveLength(1)
  })

  it('진행률은 청크가 아니라 URL 개수 기준이다', async () => {
    respondOk()
    const { result } = renderPreValidation()
    const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/${i}`)

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls }]))
    })

    expect(result.current.progress).toEqual({ current: 51, total: 51 })
  })
})

describe('usePreValidation 캐시와 무효화', () => {
  it('이미 검사한 URL 은 다시 요청하지 않는다', async () => {
    respondOk()
    const { result } = renderPreValidation()
    const targets = makeTargets([{ name: 'a', urls: ['https://a.example.com'] }])

    await act(async () => {
      await result.current.validate(targets)
    })
    await act(async () => {
      await result.current.validate(targets)
    })

    expect(mockCheckUrls).toHaveBeenCalledTimes(1)
    expect(result.current.results[0].urlChecked).toBe(true)
  })

  it('invalidate 는 해당 행 결과만 버린다', async () => {
    respondOk()
    const { result } = renderPreValidation()

    await act(async () => {
      await result.current.validate(
        makeTargets([
          { name: 'a', urls: ['https://a.example.com'] },
          { name: 'b', urls: ['https://b.example.com'] },
        ]),
      )
    })

    act(() => {
      result.current.invalidate(0)
    })

    expect(result.current.results[0]).toBeUndefined()
    expect(result.current.results[1]).toBeDefined()
  })

  it('invalidate 는 기존 results 객체를 변경하지 않는다 (불변성)', async () => {
    respondOk()
    const { result } = renderPreValidation()

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls: ['https://a.example.com'] }]))
    })
    const before = result.current.results

    act(() => {
      result.current.invalidate(0)
    })

    expect(before[0]).toBeDefined()
    expect(result.current.results).not.toBe(before)
  })

  it('없는 인덱스를 invalidate 하면 상태를 바꾸지 않는다', async () => {
    respondOk()
    const { result } = renderPreValidation()

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls: ['https://a.example.com'] }]))
    })
    const before = result.current.results

    act(() => {
      result.current.invalidate(99)
    })

    expect(result.current.results).toBe(before)
  })

  it('reset 은 결과와 URL 캐시를 모두 비운다', async () => {
    respondOk()
    const { result } = renderPreValidation()
    const targets = makeTargets([{ name: 'a', urls: ['https://a.example.com'] }])

    await act(async () => {
      await result.current.validate(targets)
    })
    act(() => {
      result.current.reset()
    })

    expect(result.current.results).toEqual({})
    expect(result.current.progress).toEqual({ current: 0, total: 0 })
    expect(result.current.error).toBeNull()

    // 캐시가 비었으므로 같은 URL 을 다시 요청한다.
    await act(async () => {
      await result.current.validate(targets)
    })
    expect(mockCheckUrls).toHaveBeenCalledTimes(2)
  })
})

describe('usePreValidation 실패 처리', () => {
  it('토큰이 없으면 요청하지 않고 error 를 남긴다', async () => {
    mockToken = null
    const { result } = renderPreValidation()

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls: ['https://a.example.com'] }]))
    })

    expect(mockCheckUrls).not.toHaveBeenCalled()
    expect(result.current.error).toBe('인증 토큰이 필요합니다.')
    expect(result.current.results).toEqual({})
  })

  it('API 가 실패를 돌려주면 예외 없이 error 를 남기고 urlChecked=false 로 기록한다', async () => {
    mockCheckUrls.mockResolvedValue({ success: false, error: '서버 오류' })
    const { result } = renderPreValidation()

    await act(async () => {
      await result.current.validate(makeTargets([{ name: 'a', urls: ['https://a.example.com'] }]))
    })

    expect(result.current.error).toContain('서버 오류')
    expect(result.current.results[0].urlChecked).toBe(false)
    expect(result.current.running).toBe(false)
  })

  it('요청이 예외를 던져도 훅은 예외를 밖으로 내지 않는다', async () => {
    mockCheckUrls.mockRejectedValue(new Error('네트워크 끊김'))
    const { result } = renderPreValidation()

    await act(async () => {
      await expect(
        result.current.validate(makeTargets([{ name: 'a', urls: ['https://a.example.com'] }])),
      ).resolves.toBeUndefined()
    })

    expect(result.current.error).toContain('네트워크 끊김')
    expect(result.current.results[0].urlChecked).toBe(false)
  })

  it('청크 하나가 실패해도 성공한 청크의 행은 urlChecked=true 로 남는다', async () => {
    // 첫 청크(50개)는 성공, 두 번째 청크는 실패시킨다.
    mockCheckUrls
      .mockImplementationOnce((_token: string, urls: readonly string[]) =>
        Promise.resolve({ success: true, data: { results: urls.map(okResult) } }),
      )
      .mockResolvedValueOnce({ success: false, error: '일시 오류' })

    const { result } = renderPreValidation()
    // 첫 행이 50개를 모두 차지해 첫 청크를 채우고, 두 번째 행의 URL 이 다음 청크로 밀린다.
    const firstChunk = Array.from({ length: 50 }, (_, i) => `https://example.com/${i}`)
    const secondChunk = 'https://example.com/late'

    await act(async () => {
      await result.current.validate(
        makeTargets([
          { name: 'ok', urls: firstChunk },
          { name: 'broken', urls: [secondChunk] },
        ]),
      )
    })

    expect(mockCheckUrls).toHaveBeenCalledTimes(2)
    expect(result.current.results[0].urlChecked).toBe(true)
    expect(result.current.results[1].urlChecked).toBe(false)
    expect(result.current.error).toContain('일시 오류')
  })
})

describe('usePreValidation hintsFor', () => {
  it('저장된 결과가 있으면 그 힌트를 돌려준다', async () => {
    mockCheckUrls.mockResolvedValue({
      success: true,
      data: { results: [failResult('https://gone.example.com')] },
    })
    const { result } = renderPreValidation()
    const row: TestRow = { name: 'a', urls: ['https://gone.example.com'] }

    await act(async () => {
      await result.current.validate(makeTargets([row]))
    })

    expect(result.current.hintsFor(row, 0)).toBe(result.current.results[0].hints)
    expect(hasValidationFailure(result.current.hintsFor(row, 0))).toBe(true)
  })

  it('저장된 결과가 없으면 오프라인 규칙만으로 힌트를 만든다', () => {
    const { result } = renderPreValidation()
    const row: TestRow = { name: 'a', urls: ['https://gone.example.com'] }

    // buildHints 는 urlResults 가 없으면 빈 힌트를 돌려주도록 만들어 두었다.
    expect(result.current.hintsFor(row, 0)).toEqual({})
  })

  it('invalidate 한 뒤에는 다시 오프라인 규칙으로 되돌아간다', async () => {
    mockCheckUrls.mockResolvedValue({
      success: true,
      data: { results: [failResult('https://gone.example.com')] },
    })
    const { result } = renderPreValidation()
    const row: TestRow = { name: 'a', urls: ['https://gone.example.com'] }

    await act(async () => {
      await result.current.validate(makeTargets([row]))
    })
    act(() => {
      result.current.invalidate(0)
    })

    expect(result.current.hintsFor(row, 0)).toEqual({})
  })
})
