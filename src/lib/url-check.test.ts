import { describe, it, expect } from 'vitest'
import {
  MAX_URLS_PER_REQUEST,
  MAX_URL_LENGTH,
  isBlockedHost,
  isCheckableUrl,
  urlResultToHint,
  type UrlCheckResult,
} from './url-check'

describe('isBlockedHost 내부 주소 차단', () => {
  const blocked = [
    'localhost',
    'LOCALHOST',
    'app.localhost',
    '127.0.0.1',
    '127.1.1.1',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.20.10.5',
    '172.31.255.254',
    '192.168.0.1',
    '192.168.100.200',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    '[::1]',
    'fc00::1',
    'fd12:3456:789a::1',
    'fe80::1',
    'metadata.internal',
    'printer.local',
  ]

  it.each(blocked)('%s 는 차단한다', (hostname) => {
    expect(isBlockedHost(hostname)).toBe(true)
  })

  const allowed = [
    'github.com',
    'example.com',
    'raw.githubusercontent.com',
    '8.8.8.8',
    '172.15.0.1',
    '172.32.0.1',
    '11.0.0.1',
    '192.169.0.1',
    '2001:4860:4860::8888',
    'localhost.example.com',
  ]

  it.each(allowed)('%s 는 통과시킨다', (hostname) => {
    expect(isBlockedHost(hostname)).toBe(false)
  })

  it('빈 호스트는 차단한다', () => {
    expect(isBlockedHost('')).toBe(true)
    expect(isBlockedHost('   ')).toBe(true)
  })
})

/**
 * 회귀: IPv4 를 담은 IPv6 리터럴이 내부 주소 차단을 통과하던 결함.
 *
 * URL 파서가 `::ffff:127.0.0.1` 을 `[::ffff:7f00:1]` 로 정규화하기 때문에 IPv4 패턴에도
 * IPv6 패턴에도 걸리지 않았다. 환산 로직에 구멍이 생기면 그대로 우회가 되므로,
 * 사설 대역만 골라내지 않고 이 표기 자체를 차단한다.
 */
describe('isBlockedHost IPv4-mapped IPv6 차단 (회귀)', () => {
  // 이번 수정의 핵심 경로: URL 파서가 정규화해 넘기는 16진 표기를 직접 넣어도 잡혀야 한다.
  const normalizedHex = [
    '::ffff:7f00:1', // ::ffff:127.0.0.1
    '::ffff:a9fe:a9fe', // ::ffff:169.254.169.254 (클라우드 메타데이터)
    '::ffff:a00:1', // ::ffff:10.0.0.1
    '::ffff:ac10:1', // ::ffff:172.16.0.1
    '::ffff:c0a8:1', // ::ffff:192.168.0.1
  ]

  it.each(normalizedHex)('파서가 정규화한 16진 표기 %s 를 차단한다', (hostname) => {
    expect(isBlockedHost(hostname)).toBe(true)
  })

  const mapped = [
    // 대괄호가 붙은 형태 (URL.hostname 이 실제로 돌려주는 값)
    '[::ffff:7f00:1]',
    '[::ffff:a9fe:a9fe]',
    '[::ffff:a00:1]',
    '[::ffff:ac1f:5]', // ::ffff:172.31.0.5
    '[::ffff:c0a8:101]', // ::ffff:192.168.1.1
    '[::ffff:808:808]', // ::ffff:8.8.8.8 — 공인 IP 라도 이 표기는 막는다
    '[::ffff:0:7f00:1]', // IPv4-translated
    '[::a00:1]', // IPv4-compatible (ffff 없음)
    // 점 표기도 같이 받는다.
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '::ffff:172.16.0.1',
    '::ffff:192.168.0.1',
    '::ffff:0:127.0.0.1',
  ]

  it.each(mapped)('%s 는 차단한다', (hostname) => {
    expect(isBlockedHost(hostname)).toBe(true)
  })

  const globalIpv6 = ['[2606:4700::1111]', '2606:4700::1111', '[2001:4860:4860::8888]']

  it.each(globalIpv6)('일반 글로벌 IPv6 %s 는 통과시킨다 (오탐 방지)', (hostname) => {
    expect(isBlockedHost(hostname)).toBe(false)
  })

  const bypassUrls = [
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:169.254.169.254]/',
    'http://[::ffff:169.254.169.254]/latest/meta-data/',
    'http://[::ffff:10.0.0.1]/',
    'http://[::ffff:192.168.0.1]/',
    'http://[::ffff:172.16.0.1]/',
    'http://[::ffff:127.0.0.1]:8080/admin',
    'http://[::a00:1]/',
    'http://[0:0:0:0:0:0:0:1]/',
    'http://[::1]/',
  ]

  it.each(bypassUrls)('URL 단위로도 %s 를 검사 대상에서 제외한다', (url) => {
    expect(isCheckableUrl(url)).toBe(false)
  })

  const allowedUrls = [
    'https://github.com/foo/bar',
    'http://example.com',
    // 공개 IPv6. fc00::/7·fe80::/10 패턴이나 IPv4-mapped 판정에 걸리면 안 된다.
    'https://[2606:4700::1111]/',
    'http://[2606:4700::1111]/',
    'http://8.8.8.8/',
  ]

  it.each(allowedUrls)('정상 URL %s 은 계속 검사 대상이다 (과차단 회귀 방지)', (url) => {
    expect(isCheckableUrl(url)).toBe(true)
  })
})

/**
 * URL 파서가 십진·8진·16진 IPv4 표기를 점 표기로 정규화해 주므로 기존 패턴으로 잡힌다.
 * 파서 동작에 기대는 부분이라 회귀로 고정해 둔다.
 */
describe('isCheckableUrl 비표준 IPv4 표기 (회귀)', () => {
  const encoded = [
    'http://2130706433/', // 십진 127.0.0.1
    'http://0177.0.0.1/', // 8진
    'http://0x7f000001/', // 16진
    'http://127.1/', // 축약
  ]

  it.each(encoded)('%s 는 루프백으로 정규화되어 차단된다', (url) => {
    expect(new URL(url).hostname).toBe('127.0.0.1')
    expect(isCheckableUrl(url)).toBe(false)
  })
})

describe('isCheckableUrl', () => {
  it('http/https URL 은 검사 대상이다', () => {
    expect(isCheckableUrl('https://github.com/foo/bar')).toBe(true)
    expect(isCheckableUrl('http://example.com')).toBe(true)
  })

  it('앞뒤 공백은 무시한다', () => {
    expect(isCheckableUrl('  https://github.com/foo  ')).toBe(true)
  })

  const nonHttpSchemes = [
    'ftp://example.com/file',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'gopher://example.com',
    'mailto:someone@example.com',
  ]

  it.each(nonHttpSchemes)('%s 는 검사 대상이 아니다', (url) => {
    expect(isCheckableUrl(url)).toBe(false)
  })

  it('스킴이 없는 값은 검사 대상이 아니다', () => {
    expect(isCheckableUrl('github.com/foo/bar')).toBe(false)
    expect(isCheckableUrl('www.example.com')).toBe(false)
  })

  it('빈 값은 검사 대상이 아니다', () => {
    expect(isCheckableUrl('')).toBe(false)
    expect(isCheckableUrl('   ')).toBe(false)
  })

  const internalUrls = [
    'http://localhost:3000/health',
    'http://127.0.0.1/admin',
    'http://10.0.0.5/',
    'http://172.16.3.4/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:8080/',
    'http://[fc00::1]/',
    'http://vault.internal/secret',
    'http://nas.local/',
  ]

  it.each(internalUrls)('내부 주소 %s 는 검사 대상이 아니다', (url) => {
    expect(isCheckableUrl(url)).toBe(false)
  })

  it('최대 길이를 넘는 URL 은 검사 대상이 아니다', () => {
    const tooLong = `https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`
    expect(tooLong.length).toBeGreaterThan(MAX_URL_LENGTH)
    expect(isCheckableUrl(tooLong)).toBe(false)
  })

  it('최대 길이 이내면 검사 대상이다', () => {
    const base = 'https://example.com/'
    const exact = base + 'a'.repeat(MAX_URL_LENGTH - base.length)
    expect(exact).toHaveLength(MAX_URL_LENGTH)
    expect(isCheckableUrl(exact)).toBe(true)
  })
})

describe('urlResultToHint 판정 매핑', () => {
  function result(overrides: Partial<UrlCheckResult>): UrlCheckResult {
    return {
      url: 'https://example.com',
      outcome: 'ok',
      status: 200,
      reason: null,
      ...overrides,
    }
  }

  it('ok 는 힌트를 만들지 않는다', () => {
    expect(urlResultToHint(result({ outcome: 'ok', status: 200 }))).toBeNull()
    expect(urlResultToHint(result({ outcome: 'ok', status: 301 }))).toBeNull()
  })

  it('403 forbidden 은 warn 이다 (차단하지 않는다)', () => {
    const hint = urlResultToHint(result({ outcome: 'forbidden', status: 403, reason: '거부' }))

    expect(hint?.status).toBe('warn')
    expect(hint?.message).toContain('403')
    expect(hint?.message).toContain('https://example.com')
  })

  it('상태코드가 있는 unreachable 은 fail 이고 코드를 담는다', () => {
    const hint = urlResultToHint(result({ outcome: 'unreachable', status: 404, reason: 'HTTP 404' }))

    expect(hint?.status).toBe('fail')
    expect(hint?.message).toBe('URL에 접속할 수 없습니다(404): https://example.com')
  })

  it('상태코드가 없는 unreachable 은 사유를 담는다', () => {
    const hint = urlResultToHint(
      result({ outcome: 'unreachable', status: null, reason: '요청 시간이 초과되었습니다' }),
    )

    expect(hint?.status).toBe('fail')
    expect(hint?.message).toBe(
      'URL 접속에 실패했습니다(요청 시간이 초과되었습니다): https://example.com',
    )
  })

  it('invalid 는 fail 이다', () => {
    const hint = urlResultToHint(
      result({
        url: 'github.com/foo',
        outcome: 'invalid',
        status: null,
        reason: 'http/https URL이 아닙니다',
      }),
    )

    expect(hint?.status).toBe('fail')
    expect(hint?.message).toBe(
      '검사할 수 없는 URL입니다(http/https URL이 아닙니다): github.com/foo',
    )
  })
})

describe('상한 상수', () => {
  it('한 요청의 URL 개수 상한은 50 이다', () => {
    expect(MAX_URLS_PER_REQUEST).toBe(50)
  })
})
