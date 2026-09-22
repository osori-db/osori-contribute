import { describe, it, expect } from 'vitest'
import { validateOssRow, hasValidationFailure } from './oss-validation'
import type { OssRow } from './types'

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

const messages = (hints: ReturnType<typeof validateOssRow>, field: string) =>
  (hints[field] ?? []).map((h) => `${h.status}:${h.message}`)

describe('validateOssRow 필수 항목', () => {
  it('정상 행은 fail 이 없다', () => {
    expect(hasValidationFailure(validateOssRow(makeOssRow()))).toBe(false)
  })

  it('downloadLocation 이 비면 fail', () => {
    const hints = validateOssRow(makeOssRow({ downloadLocation: '' }))

    expect(messages(hints, 'downloadLocation')).toContain(
      'fail:Download location은 필수 항목입니다.',
    )
  })

  it('declaredLicenseList 가 비면 fail', () => {
    const hints = validateOssRow(makeOssRow({ declaredLicenseList: null }))

    expect(messages(hints, 'declaredLicense')).toContain('fail:Declared License는 필수 항목입니다.')
  })

  it('Declared License 가 2개 이상인데 조합이 없으면 fail', () => {
    const hints = validateOssRow(
      makeOssRow({ declaredLicenseList: 'MIT, Apache-2.0', licenseCombination: null }),
    )

    expect(hints.licenseCombination?.[0].status).toBe('fail')
  })
})

describe('validateOssRow 규칙 2 — download location URL 형식', () => {
  it('스킴이 없는 값은 fail 이다', () => {
    const hints = validateOssRow(makeOssRow({ downloadLocation: 'github.com/foo/bar' }))

    expect(messages(hints, 'downloadLocation')).toContain(
      'fail:Download location은 http/https URL이어야 합니다.',
    )
    expect(hasValidationFailure(hints)).toBe(true)
  })

  it('http/https 가 아닌 스킴은 fail 이다', () => {
    const hints = validateOssRow(makeOssRow({ downloadLocation: 'ftp://example.com/pkg.tar.gz' }))

    expect(hasValidationFailure(hints)).toBe(true)
  })

  it('http URL 은 통과한다', () => {
    const hints = validateOssRow(makeOssRow({ downloadLocation: 'http://example.com/pkg' }))

    expect(
      messages(hints, 'downloadLocation').some((m) => m.startsWith('fail:')),
    ).toBe(false)
  })

  it('필수 검사와 형식 검사를 중복으로 내지 않는다', () => {
    const hints = validateOssRow(makeOssRow({ downloadLocation: '   ' }))

    expect(messages(hints, 'downloadLocation')).toEqual([
      'fail:Download location은 필수 항목입니다.',
    ])
  })
})

describe('validateOssRow 규칙 3·5 — version (기존 동작 회귀)', () => {
  it('git hash 는 fail 이다', () => {
    const hints = validateOssRow(makeOssRow({ version: 'a1b2c3d' }))

    expect(messages(hints, 'version')).toContain('fail:Git hash 값은 버전으로 사용할 수 없습니다.')
  })

  it('40자 git hash 도 fail 이다', () => {
    const hints = validateOssRow(makeOssRow({ version: 'a'.repeat(40) }))

    expect(hasValidationFailure(hints)).toBe(true)
  })

  it('v 접두사는 warn 이다 (차단하지 않는다)', () => {
    const hints = validateOssRow(makeOssRow({ version: 'v1.0.0' }))

    expect(messages(hints, 'version')).toContain('warn:v/V/ver 접두사를 제거해주세요.')
    expect(hasValidationFailure(hints)).toBe(false)
  })

  it('pre-release 는 warn 이다', () => {
    const hints = validateOssRow(makeOssRow({ version: '1.0.0-beta.1' }))

    expect(messages(hints, 'version')).toContain(
      'warn:Pre-release 버전입니다. 정식 릴리즈 버전을 확인해주세요.',
    )
    expect(hasValidationFailure(hints)).toBe(false)
  })

  it('정상 semver 는 힌트가 없다', () => {
    expect(validateOssRow(makeOssRow({ version: '4.17.21' })).version).toBeUndefined()
  })

  it('version 이 없으면 검사하지 않는다', () => {
    expect(validateOssRow(makeOssRow({ version: null })).version).toBeUndefined()
  })
})

describe('validateOssRow 규칙 6 — declared / detected 중복', () => {
  it('같은 이름이 양쪽에 있으면 두 필드 모두 fail', () => {
    const hints = validateOssRow(
      makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: 'MIT' }),
    )

    expect(hints.declaredLicense?.some((h) => h.status === 'fail')).toBe(true)
    expect(hints.detectedLicense?.some((h) => h.status === 'fail')).toBe(true)
  })

  it('대소문자와 공백 차이는 같은 이름으로 본다', () => {
    const hints = validateOssRow(
      makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: 'mit ' }),
    )

    expect(hasValidationFailure(hints)).toBe(true)
    expect(hints.declaredLicense?.[0].message).toBe(
      'declared와 detected에 같은 라이선스가 중복 등록되었습니다: MIT',
    )
  })

  it('겹치는 이름만 메시지에 담는다', () => {
    const hints = validateOssRow(
      makeOssRow({
        declaredLicenseList: 'MIT, Apache-2.0',
        detectedLicenseList: 'Apache-2.0, BSD-3-Clause',
      }),
    )

    expect(hints.declaredLicense?.[0].message).toContain('Apache-2.0')
    expect(hints.declaredLicense?.[0].message).not.toContain('MIT')
  })

  it('겹치지 않으면 fail 이 없다', () => {
    const hints = validateOssRow(
      makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: 'Apache-2.0' }),
    )

    expect(hasValidationFailure(hints)).toBe(false)
  })

  it('detected 가 비어 있으면 검사하지 않는다', () => {
    const hints = validateOssRow(
      makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: null }),
    )

    expect(hasValidationFailure(hints)).toBe(false)
  })
})

describe('validateOssRow 권고 힌트', () => {
  it('후보 목록이 있는데 대표 URL 이 GitHub 이 아니면 warn', () => {
    const hints = validateOssRow(
      makeOssRow({
        downloadLocation: 'https://npmjs.com/package/lodash',
        downloadLocationList: 'https://github.com/lodash/lodash',
      }),
    )

    expect(messages(hints, 'downloadLocation')).toContain(
      'warn:GitHub repository를 대표 URL로 권장합니다.',
    )
  })

  it('copyright 이 있으면 info 를 남긴다', () => {
    const hints = validateOssRow(makeOssRow({ copyright: 'Copyright JS Foundation' }))

    expect(hints.copyright?.[0].status).toBe('info')
    expect(hasValidationFailure(hints)).toBe(false)
  })
})
