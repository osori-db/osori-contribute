import { describe, it, expect } from 'vitest'
import {
  buildLicenseRowHints,
  buildOssRowHints,
  collectLicenseUrls,
  collectOssUrls,
  toRowValidationResult,
  type UrlCheckMap,
} from './pre-validation'
import { collectFailMessages, collectWarnMessages, hasValidationFailure } from './field-hints'
import type { UrlCheckResult } from './url-check'
import type { LicenseRow, OssRow } from './types'

const REGISTERED = ['MIT', 'Apache-2.0', 'BSD-3-Clause']
const isRegistered = (name: string): boolean =>
  REGISTERED.some((known) => known.toLowerCase() === name.trim().toLowerCase())

function makeOssRow(overrides: Partial<OssRow> = {}): OssRow {
  return {
    no: 1,
    ossName: 'lodash',
    nickname: null,
    homepage: null,
    downloadLocation: 'https://github.com/lodash/lodash',
    downloadLocationList: null,
    attribution: null,
    complianceNotice: null,
    complianceNoticeKo: null,
    publisher: null,
    version: '4.17.21',
    licenseCombination: null,
    declaredLicenseList: 'MIT',
    detectedLicenseList: null,
    copyright: null,
    releaseDate: null,
    description: null,
    descriptionKo: null,
    ...overrides,
  }
}

function makeLicenseRow(overrides: Partial<LicenseRow> = {}): LicenseRow {
  return {
    no: 1,
    licenseName: 'MIT License',
    spdxIdentifier: 'MIT',
    nickName: null,
    obligationNotice: true,
    obligationDisclosingSrc: 'NONE',
    restriction: null,
    webpage: 'https://opensource.org/license/mit',
    webpageList: null,
    descriptionKo: null,
    ...overrides,
  }
}

function urlMap(...results: readonly UrlCheckResult[]): UrlCheckMap {
  return new Map(results.map((result) => [result.url, result]))
}

const ok = (url: string): UrlCheckResult => ({ url, outcome: 'ok', status: 200, reason: null })
const notFound = (url: string): UrlCheckResult => ({
  url,
  outcome: 'unreachable',
  status: 404,
  reason: 'HTTP 404',
})
const forbidden = (url: string): UrlCheckResult => ({
  url,
  outcome: 'forbidden',
  status: 403,
  reason: '접근이 거부되었습니다(403)',
})
const timedOut = (url: string): UrlCheckResult => ({
  url,
  outcome: 'unreachable',
  status: null,
  reason: '요청 시간이 초과되었습니다',
})

describe('collectOssUrls', () => {
  it('대표 URL 과 후보 목록을 모두 뽑는다', () => {
    const row = makeOssRow({
      downloadLocation: 'https://github.com/a/b',
      downloadLocationList: 'https://npmjs.com/a\nhttps://pypi.org/a',
    })

    expect(collectOssUrls(row)).toEqual([
      'https://github.com/a/b',
      'https://npmjs.com/a',
      'https://pypi.org/a',
    ])
  })

  it('중복과 공백을 제거한다', () => {
    const row = makeOssRow({
      downloadLocation: ' https://github.com/a/b ',
      downloadLocationList: 'https://github.com/a/b, , https://npmjs.com/a',
    })

    expect(collectOssUrls(row)).toEqual(['https://github.com/a/b', 'https://npmjs.com/a'])
  })

  it('URL 이 없으면 빈 배열', () => {
    expect(collectOssUrls(makeOssRow({ downloadLocation: '', downloadLocationList: null }))).toEqual(
      [],
    )
  })
})

describe('collectLicenseUrls', () => {
  it('webpage 만 뽑는다 (webpageList 는 대상이 아니다)', () => {
    const row = makeLicenseRow({
      webpage: 'https://opensource.org/license/mit',
      webpageList: 'https://example.com/other',
    })

    expect(collectLicenseUrls(row)).toEqual(['https://opensource.org/license/mit'])
  })

  it('webpage 가 비면 빈 배열', () => {
    expect(collectLicenseUrls(makeLicenseRow({ webpage: '' }))).toEqual([])
  })
})

describe('buildOssRowHints 오프라인 규칙 합성', () => {
  it('정상 행은 fail 이 없다', () => {
    const hints = buildOssRowHints(makeOssRow(), isRegistered)

    expect(hasValidationFailure(hints)).toBe(false)
  })

  it('규칙 2 — 스킴 없는 downloadLocation 은 fail', () => {
    const hints = buildOssRowHints(makeOssRow({ downloadLocation: 'github.com/foo/bar' }), isRegistered)

    expect(hasValidationFailure(hints)).toBe(true)
    expect(collectFailMessages(hints)).toContain('Download location은 http/https URL이어야 합니다.')
  })

  it('규칙 4 — 미등록 라이선스는 fail (mapNamesToIds 무음 누락 방지)', () => {
    const hints = buildOssRowHints(
      makeOssRow({ declaredLicenseList: 'MIT, FooBar-1.0' }),
      isRegistered,
    )

    expect(hasValidationFailure(hints)).toBe(true)
    expect(collectFailMessages(hints)).toContain('OSORI에 등록되지 않은 라이선스입니다: FooBar-1.0')
  })

  it('규칙 5 — git hash version 은 fail', () => {
    const hints = buildOssRowHints(makeOssRow({ version: 'deadbeef' }), isRegistered)

    expect(collectFailMessages(hints)).toContain('Git hash 값은 버전으로 사용할 수 없습니다.')
  })

  it('규칙 6 — declared/detected 중복은 trim·대소문자 무시로 fail', () => {
    const hints = buildOssRowHints(
      makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: 'mit ' }),
      isRegistered,
    )

    expect(hasValidationFailure(hints)).toBe(true)
    expect(collectFailMessages(hints)).toContain(
      'declared와 detected에 같은 라이선스가 중복 등록되었습니다: MIT',
    )
  })

  it('여러 규칙이 동시에 걸리면 모두 모은다', () => {
    const hints = buildOssRowHints(
      makeOssRow({
        downloadLocation: 'github.com/foo',
        version: 'abcdef1',
        declaredLicenseList: 'FooBar-1.0',
      }),
      isRegistered,
    )

    const fails = collectFailMessages(hints)
    expect(fails).toHaveLength(3)
    expect(fails).toEqual(
      expect.arrayContaining([
        'Download location은 http/https URL이어야 합니다.',
        'Git hash 값은 버전으로 사용할 수 없습니다.',
        'OSORI에 등록되지 않은 라이선스입니다: FooBar-1.0',
      ]),
    )
  })

  it('같은 필드의 힌트는 두 검증기 결과를 이어붙인다', () => {
    const hints = buildOssRowHints(
      makeOssRow({ declaredLicenseList: 'FooBar-1.0', detectedLicenseList: 'foobar-1.0' }),
      isRegistered,
    )

    // 규칙 6(중복) + 규칙 4(미등록) 두 건이 declaredLicense 한 필드에 쌓인다.
    expect(hints.declaredLicense).toHaveLength(2)
  })

  it('urlResults 를 넘기지 않으면 URL 규칙을 적용하지 않는다', () => {
    const hints = buildOssRowHints(makeOssRow(), isRegistered)

    expect(hints.downloadLocation).toBeUndefined()
  })
})

describe('buildOssRowHints URL 결과 병합 (규칙 1)', () => {
  const url = 'https://github.com/lodash/lodash'

  it('ok 인 URL 은 힌트를 만들지 않는다', () => {
    const hints = buildOssRowHints(makeOssRow(), isRegistered, urlMap(ok(url)))

    expect(hints.downloadLocation).toBeUndefined()
    expect(hasValidationFailure(hints)).toBe(false)
  })

  it('404 는 downloadLocation 에 fail 을 남긴다', () => {
    const hints = buildOssRowHints(makeOssRow(), isRegistered, urlMap(notFound(url)))

    expect(hasValidationFailure(hints)).toBe(true)
    expect(collectFailMessages(hints)).toContain(`URL에 접속할 수 없습니다(404): ${url}`)
  })

  it('403 은 warn 이라 차단하지 않는다', () => {
    const hints = buildOssRowHints(makeOssRow(), isRegistered, urlMap(forbidden(url)))

    expect(hasValidationFailure(hints)).toBe(false)
    expect(collectWarnMessages(hints)).toContain(`URL 접속 확인이 필요합니다(403): ${url}`)
  })

  it('타임아웃은 fail 이다', () => {
    const hints = buildOssRowHints(makeOssRow(), isRegistered, urlMap(timedOut(url)))

    expect(collectFailMessages(hints)).toContain(
      `URL 접속에 실패했습니다(요청 시간이 초과되었습니다): ${url}`,
    )
  })

  it('후보 목록의 실패는 downloadLocationList 필드에 붙는다', () => {
    const candidate = 'https://npmjs.com/package/lodash'
    const hints = buildOssRowHints(
      makeOssRow({ downloadLocationList: candidate }),
      isRegistered,
      urlMap(ok(url), notFound(candidate)),
    )

    expect(hints.downloadLocation).toBeUndefined()
    expect(hints.downloadLocationList?.[0].status).toBe('fail')
    expect(hasValidationFailure(hints)).toBe(true)
  })

  it('맵에 없는 URL 은 건너뛴다', () => {
    const hints = buildOssRowHints(makeOssRow(), isRegistered, new Map())

    expect(hints.downloadLocation).toBeUndefined()
  })

  it('URL 힌트는 오프라인 힌트와 같은 필드에 공존한다', () => {
    const hints = buildOssRowHints(
      makeOssRow({
        downloadLocation: 'https://npmjs.com/package/lodash',
        downloadLocationList: 'https://github.com/lodash/lodash',
      }),
      isRegistered,
      urlMap(notFound('https://npmjs.com/package/lodash'), ok(url)),
    )

    // warn(GitHub 권장) + fail(404) 두 건
    expect(hints.downloadLocation).toHaveLength(2)
    expect(collectWarnMessages(hints)).toContain('GitHub repository를 대표 URL로 권장합니다.')
    expect(hasValidationFailure(hints)).toBe(true)
  })
})

describe('buildLicenseRowHints', () => {
  it('오프라인 규칙은 기존 validateLicenseRow 와 동일하게 동작한다', () => {
    const hints = buildLicenseRowHints(makeLicenseRow({ spdxIdentifier: '' }))

    expect(collectFailMessages(hints)).toContain('SPDX Identifier는 필수 항목입니다.')
  })

  it('정상 행은 fail 이 없다', () => {
    expect(hasValidationFailure(buildLicenseRowHints(makeLicenseRow()))).toBe(false)
  })

  it('webpage 접속 실패는 webpage 필드에 fail 을 남긴다', () => {
    const row = makeLicenseRow()
    const hints = buildLicenseRowHints(row, urlMap(notFound(row.webpage)))

    expect(hints.webpage?.[0].status).toBe('fail')
  })

  it('스킴 없는 webpage 는 사전 검증 시 invalid 로 잡힌다', () => {
    const row = makeLicenseRow({ webpage: 'www.opensource.org/license/mit' })
    const hints = buildLicenseRowHints(
      row,
      urlMap({
        url: row.webpage,
        outcome: 'invalid',
        status: null,
        reason: 'http/https URL이 아닙니다',
      }),
    )

    expect(hasValidationFailure(hints)).toBe(true)
  })

  it('규칙 4(라이선스 등록 여부)는 적용하지 않는다', () => {
    const hints = buildLicenseRowHints(makeLicenseRow({ spdxIdentifier: 'Never-Registered-1.0' }))

    expect(hasValidationFailure(hints)).toBe(false)
  })

  it('urlResults 를 넘기지 않으면 URL 규칙을 적용하지 않는다', () => {
    expect(buildLicenseRowHints(makeLicenseRow()).webpage).toBeUndefined()
  })
})

describe('toRowValidationResult', () => {
  it('힌트와 urlChecked 를 그대로 담고 시각을 기록한다', () => {
    const before = Date.now()
    const result = toRowValidationResult({ version: [{ status: 'warn', message: 'W' }] }, true)

    expect(result.hints.version).toHaveLength(1)
    expect(result.urlChecked).toBe(true)
    expect(result.checkedAt).toBeGreaterThanOrEqual(before)
  })

  it('urlChecked=false 를 유지한다', () => {
    expect(toRowValidationResult({}, false).urlChecked).toBe(false)
  })
})

// collectOssUrls 는 parseMultiValue 를 거치므로 줄바꿈 우선 전환의 영향을 받는다.
describe('collectOssUrls 다중값 분리 (줄바꿈 우선 전환 회귀)', () => {
  it('쉼표만 있는 후보 목록은 기존대로 쪼갠다', () => {
    const row = makeOssRow({
      downloadLocation: 'https://github.com/a/b',
      downloadLocationList: 'https://npmjs.com/a,https://pypi.org/a',
    })

    expect(collectOssUrls(row)).toEqual([
      'https://github.com/a/b',
      'https://npmjs.com/a',
      'https://pypi.org/a',
    ])
  })

  it('줄바꿈이 있으면 쉼표를 URL 의 일부로 남긴다', () => {
    const row = makeOssRow({
      downloadLocation: '',
      downloadLocationList: 'https://example.com/a,b\nhttps://npmjs.com/a',
    })

    expect(collectOssUrls(row)).toEqual(['https://example.com/a,b', 'https://npmjs.com/a'])
  })
})
