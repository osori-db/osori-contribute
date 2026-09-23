import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAllLicenses, LICENSE_PAGE_SIZE } from './api-client'
import type { OsoriLicense } from './osori-types'

/**
 * OSORI 의 /api/v2/admin/licenses 는 size 를 100 으로 제한한다.
 * 그보다 크게 보내면 400 이 돌아와 라이선스 마스터 목록을 통째로 못 받는다.
 * 목록이 비면 규칙 4가 정상 라이선스까지 미등록으로 판정하므로, 페이지 크기는
 * 상한 이내여야 하고 전체를 받으려면 페이지를 이어 붙여야 한다.
 */

function license(id: number): OsoriLicense {
  return { id, name: `License ${id}`, spdx_identifier: `L-${id}` } as OsoriLicense
}

function page(count: number, offset = 0): OsoriLicense[] {
  return Array.from({ length: count }, (_, i) => license(offset + i))
}

const mockFetch = vi.fn()

function respondWith(pages: readonly (OsoriLicense[] | { error: string })[]): void {
  let call = 0
  mockFetch.mockImplementation(() => {
    const body = pages[call++]
    const json = body && 'error' in body
      ? { success: false, error: body.error }
      : { success: true, data: body ?? [] }
    return Promise.resolve({ json: () => Promise.resolve(json) })
  })
}

function requestedSizes(): string[] {
  return mockFetch.mock.calls.map(([url]) => new URL(url as string, 'http://x').searchParams.get('size')!)
}

function requestedPages(): string[] {
  return mockFetch.mock.calls.map(([url]) => new URL(url as string, 'http://x').searchParams.get('page')!)
}

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchAllLicenses 페이지 크기', () => {
  it('OSORI 상한(100) 을 넘는 size 를 보내지 않는다', async () => {
    respondWith([page(10)])

    await fetchAllLicenses('t')

    expect(LICENSE_PAGE_SIZE).toBeLessThanOrEqual(100)
    for (const size of requestedSizes()) {
      expect(Number(size)).toBeLessThanOrEqual(100)
    }
  })

  it('토큰을 헤더로 보낸다', async () => {
    respondWith([page(1)])

    await fetchAllLicenses('my-token')

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-Auth-Token']).toBe('my-token')
  })
})

describe('fetchAllLicenses 페이지네이션', () => {
  it('한 페이지에 다 들어오면 한 번만 요청한다', async () => {
    respondWith([page(7)])

    const result = await fetchAllLicenses('t')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(7)
  })

  it('가득 찬 페이지가 이어지면 다음 페이지를 요청해 합친다', async () => {
    respondWith([page(LICENSE_PAGE_SIZE, 0), page(LICENSE_PAGE_SIZE, 100), page(6, 200)])

    const result = await fetchAllLicenses('t')

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(requestedPages()).toEqual(['0', '1', '2'])
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(LICENSE_PAGE_SIZE * 2 + 6)
  })

  it('빈 페이지가 오면 멈춘다', async () => {
    respondWith([page(LICENSE_PAGE_SIZE, 0), []])

    const result = await fetchAllLicenses('t')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.data).toHaveLength(LICENSE_PAGE_SIZE)
  })

  it('합친 결과에 중복이 없다', async () => {
    respondWith([page(LICENSE_PAGE_SIZE, 0), page(3, 100)])

    const result = await fetchAllLicenses('t')
    const ids = result.data!.map((l) => l.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('fetchAllLicenses 실패 처리', () => {
  it('첫 페이지가 실패하면 그 오류를 그대로 돌려준다', async () => {
    respondWith([{ error: '인증 정보가 유효하지 않습니다.' }])

    const result = await fetchAllLicenses('t')

    expect(result.success).toBe(false)
    expect(result.error).toBe('인증 정보가 유효하지 않습니다.')
  })

  it('이어받던 중 실패하면 부분 목록을 성공으로 위장하지 않는다', async () => {
    // 부분 목록을 돌려주면 규칙 4가 받아오지 못한 라이선스를 미등록으로 판정한다.
    respondWith([page(LICENSE_PAGE_SIZE, 0), { error: '서버 오류' }])

    const result = await fetchAllLicenses('t')

    expect(result.success).toBe(false)
    expect(result.data).toBeUndefined()
  })

  it('fetch 가 던져도 예외를 밖으로 내보내지 않는다', async () => {
    mockFetch.mockRejectedValue(new Error('네트워크 끊김'))

    const result = await fetchAllLicenses('t')

    expect(result.success).toBe(false)
    expect(result.error).toContain('네트워크 끊김')
  })

  it('페이지가 끝없이 가득 차도 무한 루프에 빠지지 않는다', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ json: () => Promise.resolve({ success: true, data: page(LICENSE_PAGE_SIZE) }) }),
    )

    const result = await fetchAllLicenses('t')

    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(50)
    expect(result.success).toBe(true)
  })
})
