import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkUrlsReachability } from './url-reachability'

/**
 * 이 파일은 실제 네트워크를 호출하지 않는다. 전역 fetch 를 전부 가로채고,
 * 가로채지 못한 호출이 있으면 즉시 실패하도록 기본 구현을 둔다.
 */
type FetchInit = { readonly method: string; readonly redirect: string; readonly signal: AbortSignal; readonly headers?: Record<string, string> }

const fetchMock = vi.fn()

function fakeResponse(status: number) {
  return { status, body: null }
}

/** 네트워크 계층 실패(DNS/TLS)를 흉내낸다. */
function networkError(message = 'getaddrinfo ENOTFOUND') {
  return new TypeError(message)
}

/** signal 이 abort 될 때까지 응답하지 않는 서버. 타임아웃 경로를 검증한다. */
function hangUntilAbort(_url: string, init: FetchInit): Promise<never> {
  return new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('The operation was aborted.')
      error.name = 'AbortError'
      reject(error)
    })
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string) => {
    throw new Error(`모킹되지 않은 fetch 호출: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('checkUrlsReachability 상태코드 판정', () => {
  const okStatuses = [200, 204, 301, 302, 307]

  it.each(okStatuses)('%d 는 ok 로 통과시킨다', async (status) => {
    fetchMock.mockResolvedValue(fakeResponse(status))

    const [result] = await checkUrlsReachability(['https://example.com/a'])

    expect(result).toEqual({
      url: 'https://example.com/a',
      outcome: 'ok',
      status,
      reason: null,
    })
  })

  const unreachableStatuses = [401, 404, 410, 429, 500, 503]

  it.each(unreachableStatuses)('%d 는 unreachable(fail 대상) 이다', async (status) => {
    fetchMock.mockResolvedValue(fakeResponse(status))

    const [result] = await checkUrlsReachability(['https://example.com/a'])

    expect(result.outcome).toBe('unreachable')
    expect(result.status).toBe(status)
  })

  it('403 은 forbidden 으로 분류한다 (차단하지 않는다)', async () => {
    fetchMock.mockResolvedValue(fakeResponse(403))

    const [result] = await checkUrlsReachability(['https://example.com/a'])

    expect(result.outcome).toBe('forbidden')
    expect(result.status).toBe(403)
  })
})

describe('checkUrlsReachability HEAD → GET 폴백', () => {
  const fallbackStatuses = [400, 403, 405, 501]

  it.each(fallbackStatuses)('HEAD 가 %d 면 GET 으로 한 번 더 확인한다', async (headStatus) => {
    fetchMock.mockImplementation((_url: string, init: FetchInit) =>
      Promise.resolve(fakeResponse(init.method === 'HEAD' ? headStatus : 200)),
    )

    const [result] = await checkUrlsReachability(['https://example.com/a'])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].method).toBe('HEAD')
    expect(fetchMock.mock.calls[1][1].method).toBe('GET')
    expect(result.outcome).toBe('ok')
    expect(result.status).toBe(200)
  })

  it('폴백 대상이 아닌 상태코드는 GET 을 보내지 않는다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(404))

    await checkUrlsReachability(['https://example.com/a'])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].method).toBe('HEAD')
  })

  it('GET 폴백도 실패하면 최종 상태로 판정한다', async () => {
    fetchMock.mockImplementation((_url: string, init: FetchInit) =>
      Promise.resolve(fakeResponse(init.method === 'HEAD' ? 405 : 500)),
    )

    const [result] = await checkUrlsReachability(['https://example.com/a'])

    expect(result.outcome).toBe('unreachable')
    expect(result.status).toBe(500)
  })

  it('GET 폴백 후에도 403 이면 forbidden 이다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(403))

    const [result] = await checkUrlsReachability(['https://example.com/a'])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.outcome).toBe('forbidden')
  })
})

describe('checkUrlsReachability 요청 형태 (SSRF 방어)', () => {
  it('리다이렉트를 따라가지 않는다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200))

    await checkUrlsReachability(['https://example.com/a'])

    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual')
  })

  it('GET 폴백에는 Range 헤더를 붙인다', async () => {
    fetchMock.mockImplementation((_url: string, init: FetchInit) =>
      Promise.resolve(fakeResponse(init.method === 'HEAD' ? 405 : 200)),
    )

    await checkUrlsReachability(['https://example.com/a'])

    expect(fetchMock.mock.calls[1][1].headers).toEqual({ Range: 'bytes=0-0' })
  })

  it('응답 본문을 읽지 않고 취소한다', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    const text = vi.fn()
    fetchMock.mockResolvedValue({ status: 200, body: { cancel }, text })

    await checkUrlsReachability(['https://example.com/a'])

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(text).not.toHaveBeenCalled()
  })

  it('본문 취소가 실패해도 판정은 유지된다', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      body: { cancel: vi.fn().mockRejectedValue(new Error('already locked')) },
    })

    const [result] = await checkUrlsReachability(['https://example.com/a'])

    expect(result.outcome).toBe('ok')
  })

  it('검사 불가 URL 은 네트워크 호출 없이 invalid 로 확정한다', async () => {
    const results = await checkUrlsReachability([
      'github.com/foo/bar',
      'ftp://example.com',
      'http://169.254.169.254/latest/meta-data/',
      '',
    ])

    expect(fetchMock).not.toHaveBeenCalled()
    expect(results.map((r) => r.outcome)).toEqual(['invalid', 'invalid', 'invalid', 'invalid'])
    expect(results.map((r) => r.status)).toEqual([null, null, null, null])
  })

  it('내부 주소와 비 http 스킴의 사유를 구분한다', async () => {
    const [internal, scheme] = await checkUrlsReachability([
      'http://192.168.0.1/admin',
      'ftp://example.com',
    ])

    expect(internal.reason).toBe('내부 주소는 검사할 수 없습니다')
    expect(scheme.reason).toBe('http/https URL이 아닙니다')
  })
})

describe('checkUrlsReachability 실패 처리', () => {
  it('타임아웃은 status null 의 unreachable 이다', async () => {
    fetchMock.mockImplementation(hangUntilAbort)

    const [result] = await checkUrlsReachability(['https://slow.example.com'], { timeoutMs: 10 })

    expect(result).toEqual({
      url: 'https://slow.example.com',
      outcome: 'unreachable',
      status: null,
      reason: '요청 시간이 초과되었습니다',
    })
  })

  it('DNS/네트워크 실패는 예외를 밖으로 던지지 않고 unreachable 로 기록한다', async () => {
    fetchMock.mockRejectedValue(networkError())

    const [result] = await checkUrlsReachability(['https://no-such-host.example'])

    expect(result).toEqual({
      url: 'https://no-such-host.example',
      outcome: 'unreachable',
      status: null,
      reason: '네트워크 오류',
    })
  })

  it('한 URL 이 실패해도 나머지 검사는 계속된다', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('broken')
        ? Promise.reject(networkError())
        : Promise.resolve(fakeResponse(200)),
    )

    const results = await checkUrlsReachability([
      'https://broken.example.com',
      'https://good.example.com',
    ])

    expect(results.map((r) => r.outcome)).toEqual(['unreachable', 'ok'])
  })
})

describe('checkUrlsReachability 배치 동작', () => {
  it('빈 입력은 네트워크 호출 없이 빈 배열을 돌려준다', async () => {
    const results = await checkUrlsReachability([])

    expect(results).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('중복 URL 은 한 번만 요청하고 결과를 복제한다', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200))

    const results = await checkUrlsReachability([
      'https://example.com/a',
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/a',
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(results).toHaveLength(4)
    expect(results.map((r) => r.url)).toEqual([
      'https://example.com/a',
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/a',
    ])
  })

  it('반환 배열은 입력과 1:1 로 대응한다', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(fakeResponse(url.endsWith('/404') ? 404 : 200)),
    )

    const urls = [
      'https://example.com/1',
      'https://example.com/404',
      'github.com/no-scheme',
      'https://example.com/2',
    ]
    const results = await checkUrlsReachability(urls)

    expect(results).toHaveLength(urls.length)
    expect(results.map((r) => r.url)).toEqual(urls)
    expect(results.map((r) => r.outcome)).toEqual(['ok', 'unreachable', 'invalid', 'ok'])
  })

  it('동시성 상한을 넘겨 요청하지 않는다', async () => {
    let inFlight = 0
    let maxInFlight = 0
    fetchMock.mockImplementation(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 1))
      inFlight -= 1
      return fakeResponse(200)
    })

    const urls = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}`)
    await checkUrlsReachability(urls, { concurrency: 3 })

    expect(fetchMock).toHaveBeenCalledTimes(12)
    expect(maxInFlight).toBeLessThanOrEqual(3)
    expect(maxInFlight).toBeGreaterThan(1)
  })

  it('기본 동시성은 6 이다', async () => {
    let inFlight = 0
    let maxInFlight = 0
    fetchMock.mockImplementation(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 1))
      inFlight -= 1
      return fakeResponse(200)
    })

    const urls = Array.from({ length: 20 }, (_, i) => `https://example.com/${i}`)
    await checkUrlsReachability(urls)

    expect(maxInFlight).toBe(6)
  })
})
