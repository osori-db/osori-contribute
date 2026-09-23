import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { MAX_URLS_PER_REQUEST, MAX_URL_LENGTH, type UrlCheckResult } from '@/lib/url-check'

// 라우트 단위 테스트다. 실제 네트워크는 url-reachability 모듈째로 대체한다.
const mockCheckUrlsReachability = vi.fn()
vi.mock('@/lib/url-reachability', () => ({
  checkUrlsReachability: (...args: unknown[]) => mockCheckUrlsReachability(...args),
}))

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/url-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const withToken = { 'X-Auth-Token': 'test-token' }

function okResult(url: string): UrlCheckResult {
  return { url, outcome: 'ok', status: 200, reason: null }
}

beforeEach(() => {
  mockCheckUrlsReachability.mockReset()
  mockCheckUrlsReachability.mockImplementation((urls: readonly string[]) =>
    Promise.resolve(urls.map(okResult)),
  )
})

describe('POST /api/url-check 인증', () => {
  it('토큰이 없으면 401 이고 검사를 실행하지 않는다', async () => {
    const response = await POST(makeRequest({ urls: ['https://example.com'] }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: '인증 토큰이 필요합니다.',
    })
    expect(mockCheckUrlsReachability).not.toHaveBeenCalled()
  })

  it('토큰이 빈 문자열이어도 401 이다', async () => {
    const response = await POST(
      makeRequest({ urls: ['https://example.com'] }, { 'X-Auth-Token': '' }),
    )

    expect(response.status).toBe(401)
  })
})

describe('POST /api/url-check 입력 검증', () => {
  it('urls 가 없으면 400', async () => {
    const response = await POST(makeRequest({}, withToken))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: '검사할 URL 목록이 올바르지 않습니다.',
    })
  })

  it('빈 배열은 400', async () => {
    const response = await POST(makeRequest({ urls: [] }, withToken))

    expect(response.status).toBe(400)
  })

  it('문자열이 아닌 원소는 400', async () => {
    const response = await POST(makeRequest({ urls: ['https://example.com', 42] }, withToken))

    expect(response.status).toBe(400)
    expect(mockCheckUrlsReachability).not.toHaveBeenCalled()
  })

  it('빈 문자열 원소는 400', async () => {
    const response = await POST(makeRequest({ urls: [''] }, withToken))

    expect(response.status).toBe(400)
  })

  it(`상한(${MAX_URLS_PER_REQUEST})을 넘으면 400`, async () => {
    const urls = Array.from({ length: MAX_URLS_PER_REQUEST + 1 }, (_, i) => `https://e.com/${i}`)

    const response = await POST(makeRequest({ urls }, withToken))

    expect(response.status).toBe(400)
    expect(mockCheckUrlsReachability).not.toHaveBeenCalled()
  })

  it(`상한과 같은 ${MAX_URLS_PER_REQUEST}개는 통과한다`, async () => {
    const urls = Array.from({ length: MAX_URLS_PER_REQUEST }, (_, i) => `https://e.com/${i}`)

    const response = await POST(makeRequest({ urls }, withToken))

    expect(response.status).toBe(200)
    expect(mockCheckUrlsReachability).toHaveBeenCalledWith(urls)
  })

  it('길이 상한을 넘는 URL 은 400', async () => {
    const tooLong = `https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`

    const response = await POST(makeRequest({ urls: [tooLong] }, withToken))

    expect(response.status).toBe(400)
  })

  it('JSON 이 아닌 본문은 400', async () => {
    const response = await POST(makeRequest('not-json', withToken))

    expect(response.status).toBe(400)
  })

  it('배열이 아닌 urls 는 400', async () => {
    const response = await POST(makeRequest({ urls: 'https://example.com' }, withToken))

    expect(response.status).toBe(400)
  })
})

describe('POST /api/url-check 정상 응답', () => {
  it('검사 결과를 200 으로 돌려준다', async () => {
    const urls = ['https://example.com/a', 'https://example.com/b']

    const response = await POST(makeRequest({ urls }, withToken))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { results: urls.map(okResult) },
    })
  })

  it('대상 서버의 본문·헤더를 응답에 담지 않는다', async () => {
    // 검사기가 여분의 필드를 흘리더라도 계약에 없는 키는 내보내지 않아야 한다.
    mockCheckUrlsReachability.mockResolvedValue([
      {
        url: 'https://internal.example.com',
        outcome: 'unreachable',
        status: 500,
        reason: 'HTTP 500',
      },
    ])

    const response = await POST(
      makeRequest({ urls: ['https://internal.example.com'] }, withToken),
    )
    const body = await response.json()

    expect(Object.keys(body)).toEqual(['success', 'data'])
    expect(Object.keys(body.data)).toEqual(['results'])
    expect(Object.keys(body.data.results[0]).sort()).toEqual(
      ['outcome', 'reason', 'status', 'url'].sort(),
    )
    expect(JSON.stringify(body)).not.toMatch(/headers|body|set-cookie/i)
  })

  it('검사기에 URL 목록을 그대로 넘긴다', async () => {
    const urls = ['https://example.com/a', 'https://example.com/a']

    await POST(makeRequest({ urls }, withToken))

    expect(mockCheckUrlsReachability).toHaveBeenCalledWith(urls)
  })
})

describe('POST /api/url-check 예외 처리', () => {
  it('검사기가 예외를 던지면 500 을 돌려준다', async () => {
    mockCheckUrlsReachability.mockRejectedValue(new Error('내부 오류'))

    const response = await POST(makeRequest({ urls: ['https://example.com'] }, withToken))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ success: false, error: '내부 오류' })
  })
})
