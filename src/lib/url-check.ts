/**
 * URL 접속 검사(규칙 1)의 클라이언트·서버 공용 타입과 순수 판정 함수.
 *
 * 이 모듈은 브라우저 번들에도 들어가므로 node 전용 모듈을 import 하지 않는다.
 * 실제 네트워크 호출은 서버 전용 `url-reachability.ts` 가 담당한다.
 */
import type { FieldHint } from './field-hints'
import { isSafeHttpUrl } from './url'

export type UrlCheckOutcome =
  | 'ok' // 2xx, 3xx
  | 'forbidden' // 403 — 판정 보류
  | 'unreachable' // 그 외 4xx, 5xx, 타임아웃, DNS/네트워크 실패
  | 'invalid' // http/https 아님, 파싱 불가, 내부 주소

export interface UrlCheckResult {
  readonly url: string
  readonly outcome: UrlCheckOutcome
  /** HTTP 응답이 있었을 때만 채워진다. 타임아웃·DNS 실패·invalid 는 null */
  readonly status: number | null
  /** 사용자에게 보일 사유. outcome==='ok' 이면 null */
  readonly reason: string | null
}

export interface UrlCheckRequestBody {
  readonly urls: readonly string[]
}

export interface UrlCheckData {
  readonly results: readonly UrlCheckResult[]
}

/** 한 요청에 담을 수 있는 URL 최대 개수. 클라이언트는 이 값으로 청크를 나눈다. */
export const MAX_URLS_PER_REQUEST = 50

/** 한 URL 문자열의 최대 길이. 라우트 스키마와 공유한다. */
export const MAX_URL_LENGTH = 2048

const BLOCKED_HOSTNAMES: readonly string[] = ['localhost', '0.0.0.0', '[::]', '::']

const BLOCKED_HOST_SUFFIXES: readonly string[] = ['.localhost', '.internal', '.local']

const BLOCKED_IPV4_PATTERNS: readonly RegExp[] = [
  /^127\./, // 루프백
  /^10\./, // 사설 A
  /^172\.(1[6-9]|2\d|3[01])\./, // 사설 B
  /^192\.168\./, // 사설 C
  /^169\.254\./, // 링크 로컬 (클라우드 메타데이터 포함)
  /^0\./, // unspecified
]

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname
}

/**
 * IPv4 를 담은 IPv6 리터럴인지 본다.
 * `::ffff:127.0.0.1`(점 표기) / `::ffff:7f00:1`(URL 파서가 정규화한 16진 표기) /
 * `::ffff:0:x`(IPv4-translated) / `::a00:1`(IPv4-compatible) 를 모두 잡는다.
 *
 * 사설 대역만 골라내지 않고 이 표기 자체를 차단한다. 정상적인 공개 서비스가
 * IPv4-mapped 리터럴로 표기되는 경우는 사실상 없고, 환산 로직에 구멍이 생기면
 * 그대로 내부 주소 차단 우회가 되기 때문이다.
 */
function isIpv4InIpv6(address: string): boolean {
  return (
    /^::(?:ffff:)?(?:0:)?\d{1,3}(?:\.\d{1,3}){3}$/.test(address) ||
    /^::(?:ffff:)?(?:0:)?[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(address)
  )
}

function isBlockedIpv6(hostname: string): boolean {
  const address = stripIpv6Brackets(hostname)
  if (!address.includes(':')) return false
  if (address === '::1' || address === '::') return true
  if (isIpv4InIpv6(address)) return true

  // fc00::/7 (유니크 로컬) + fe80::/10 (링크 로컬)
  return /^f[cd][0-9a-f]{0,2}:/.test(address) || /^fe[89ab][0-9a-f]?:/.test(address)
}

/**
 * 내부/사설 주소 호스트 차단.
 * DNS 리졸브 결과까지는 보지 않는다(호스트명 리터럴 판정만).
 */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return true

  if (BLOCKED_HOSTNAMES.includes(host)) return true
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true
  if (BLOCKED_IPV4_PATTERNS.some((pattern) => pattern.test(host))) return true

  return isBlockedIpv6(host)
}

/** 네트워크 호출 전 순수 판정. false 면 outcome='invalid' 로 즉시 확정한다. */
export function isCheckableUrl(value: string): boolean {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false
  if (!isSafeHttpUrl(trimmed)) return false

  try {
    return !isBlockedHost(new URL(trimmed).hostname)
  } catch {
    return false
  }
}

/** URL 검사 결과 1건을 필드 힌트 1건으로 변환. 'ok' 면 null */
export function urlResultToHint(result: UrlCheckResult): FieldHint | null {
  switch (result.outcome) {
    case 'ok':
      return null
    case 'forbidden':
      return {
        status: 'warn',
        message: `URL 접속 확인이 필요합니다(${result.status ?? 403}): ${result.url}`,
      }
    case 'unreachable':
      return {
        status: 'fail',
        message:
          result.status !== null
            ? `URL에 접속할 수 없습니다(${result.status}): ${result.url}`
            : `URL 접속에 실패했습니다(${result.reason ?? '네트워크 오류'}): ${result.url}`,
      }
    case 'invalid':
      return {
        status: 'fail',
        message: `검사할 수 없는 URL입니다(${result.reason ?? '형식 오류'}): ${result.url}`,
      }
  }
}
