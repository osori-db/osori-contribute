/**
 * URL 접속 가능 여부 검사 (서버 전용).
 *
 * 검사 대상 URL 은 사용자가 올린 엑셀에서 오므로 신뢰할 수 없다. 서버가 임의 주소로 요청을
 * 보내는 구조이니 SSRF 방어가 이 모듈의 핵심 책임이다:
 * 스킴 화이트리스트 + 내부 주소 차단(`isCheckableUrl`), 리다이렉트 미추적, 본문 미독출,
 * 동시성·타임아웃 상한. 응답 본문과 헤더는 호출자에게 절대 돌려주지 않는다.
 *
 * 프록시 설정은 읽지도 주입하지도 않는다. 평범한 `fetch` 만 쓴다.
 */
import { isBlockedHost, isCheckableUrl, type UrlCheckResult } from './url-check'
import { isSafeHttpUrl } from './url'

export interface ReachabilityOptions {
  readonly timeoutMs?: number
  readonly concurrency?: number
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_CONCURRENCY = 6

/** HEAD 를 지원하지 않는 서버를 오탐하지 않도록 GET 으로 한 번 더 확인할 상태코드. */
const GET_FALLBACK_STATUSES: readonly number[] = [400, 403, 405, 501]

const TIMEOUT_REASON = '요청 시간이 초과되었습니다'
const NETWORK_REASON = '네트워크 오류'

function invalidReason(url: string): string {
  if (!isSafeHttpUrl(url)) return 'http/https URL이 아닙니다'

  try {
    if (isBlockedHost(new URL(url.trim()).hostname)) {
      return '내부 주소는 검사할 수 없습니다'
    }
  } catch {
    return 'URL 형식이 올바르지 않습니다'
  }

  return 'URL 형식이 올바르지 않습니다'
}

function classify(url: string, status: number): UrlCheckResult {
  if (status >= 200 && status < 400) {
    return { url, outcome: 'ok', status, reason: null }
  }
  if (status === 403) {
    return { url, outcome: 'forbidden', status, reason: '접근이 거부되었습니다(403)' }
  }
  return { url, outcome: 'unreachable', status, reason: `HTTP ${status}` }
}

/** 본문을 읽지 않고 즉시 버린다. 읽어들인 내용은 호출자에게 전달되지 않는다. */
async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // 본문 폐기 실패는 판정에 영향을 주지 않는다.
  }
}

async function requestStatus(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
): Promise<number> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      // 리다이렉트를 따라가지 않는다. SSRF 우회 표면을 없애면서 "3xx 통과" 요구를 함께 만족한다.
      redirect: 'manual',
      signal: controller.signal,
      headers: method === 'GET' ? { Range: 'bytes=0-0' } : undefined,
    })
    await discardBody(response)
    return response.status
  } finally {
    clearTimeout(timer)
  }
}

async function checkSingleUrl(url: string, timeoutMs: number): Promise<UrlCheckResult> {
  if (!isCheckableUrl(url)) {
    return { url, outcome: 'invalid', status: null, reason: invalidReason(url) }
  }

  const target = url.trim()

  try {
    const headStatus = await requestStatus(target, 'HEAD', timeoutMs)
    if (!GET_FALLBACK_STATUSES.includes(headStatus)) {
      return classify(url, headStatus)
    }

    const getStatus = await requestStatus(target, 'GET', timeoutMs)
    return classify(url, getStatus)
  } catch (error) {
    // 한 URL 의 실패가 배치 전체를 깨면 안 되므로 예외를 밖으로 던지지 않는다.
    const aborted = error instanceof Error && error.name === 'AbortError'
    return {
      url,
      outcome: 'unreachable',
      status: null,
      reason: aborted ? TIMEOUT_REASON : NETWORK_REASON,
    }
  }
}

/** 동시성 상한을 지키며 작업 큐를 소진한다. */
async function runWithConcurrency(
  targets: readonly string[],
  concurrency: number,
  run: (url: string) => Promise<UrlCheckResult>,
): Promise<ReadonlyMap<string, UrlCheckResult>> {
  const entries: [string, UrlCheckResult][] = []
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < targets.length) {
      const url = targets[cursor]
      cursor += 1
      entries.push([url, await run(url)])
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, targets.length))
  await Promise.all(Array.from({ length: workerCount }, worker))

  return new Map(entries)
}

/**
 * 여러 URL 의 접속 가능 여부를 동시성 제한 하에 검사한다.
 * - 동일 URL 은 한 번만 요청하고 결과를 복제한다(요청 내 캐싱).
 * - 반환 배열 길이·순서는 입력 urls 와 1:1 대응한다.
 * - 응답 본문은 읽지 않는다.
 */
export async function checkUrlsReachability(
  urls: readonly string[],
  options?: ReachabilityOptions,
): Promise<readonly UrlCheckResult[]> {
  if (urls.length === 0) return []

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY

  const unique = Array.from(new Set(urls))
  const resultByUrl = await runWithConcurrency(unique, concurrency, (url) =>
    checkSingleUrl(url, timeoutMs),
  )

  return urls.map(
    (url) =>
      resultByUrl.get(url) ?? {
        url,
        outcome: 'unreachable' as const,
        status: null,
        reason: NETWORK_REASON,
      },
  )
}
