import { describe, it, expect, vi } from 'vitest'
import { validateLicenseRegistration } from './license-registry-validation'
import type { OssRow } from './types'

const REGISTERED = ['MIT', 'Apache-2.0', 'BSD-3-Clause']

/** OSORI 마스터 목록을 흉내낸다. 대소문자는 구분하지 않는다. */
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

describe('validateLicenseRegistration (규칙 4)', () => {
  it('등록된 라이선스만 있으면 힌트가 없다', () => {
    const hints = validateLicenseRegistration(
      makeOssRow({ declaredLicenseList: 'MIT, Apache-2.0', detectedLicenseList: 'MIT' }),
      isRegistered,
    )

    expect(hints).toEqual({})
  })

  it('미등록 라이선스가 섞여 있으면 declaredLicense 에 fail 을 남긴다', () => {
    const hints = validateLicenseRegistration(
      makeOssRow({ declaredLicenseList: 'MIT, FooBar-1.0' }),
      isRegistered,
    )

    expect(hints.declaredLicense).toEqual([
      { status: 'fail', message: 'OSORI에 등록되지 않은 라이선스입니다: FooBar-1.0' },
    ])
  })

  it('detected 쪽 미등록도 잡는다', () => {
    const hints = validateLicenseRegistration(
      makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: 'Unknown-9.9' }),
      isRegistered,
    )

    expect(hints.declaredLicense).toBeUndefined()
    expect(hints.detectedLicense?.[0].status).toBe('fail')
    expect(hints.detectedLicense?.[0].message).toContain('Unknown-9.9')
  })

  it('미등록 이름이 여러 개면 한 메시지에 모아 적는다', () => {
    const hints = validateLicenseRegistration(
      makeOssRow({ declaredLicenseList: 'Foo-1.0\nBar-2.0' }),
      isRegistered,
    )

    expect(hints.declaredLicense?.[0].message).toBe(
      'OSORI에 등록되지 않은 라이선스입니다: Foo-1.0, Bar-2.0',
    )
  })

  it('같은 미등록 이름이 반복되면 한 번만 적는다', () => {
    const hints = validateLicenseRegistration(
      makeOssRow({ declaredLicenseList: 'Foo-1.0, Foo-1.0' }),
      isRegistered,
    )

    expect(hints.declaredLicense?.[0].message).toBe(
      'OSORI에 등록되지 않은 라이선스입니다: Foo-1.0',
    )
  })

  it('빈 목록은 검사하지 않는다 (필수 여부는 다른 규칙 소관)', () => {
    const hints = validateLicenseRegistration(
      makeOssRow({ declaredLicenseList: null, detectedLicenseList: '' }),
      isRegistered,
    )

    expect(hints).toEqual({})
  })

  it('공백만 있는 항목은 이름으로 취급하지 않는다', () => {
    const spy = vi.fn(isRegistered)

    const hints = validateLicenseRegistration(
      makeOssRow({ declaredLicenseList: 'MIT, ,  ' }),
      spy,
    )

    expect(hints).toEqual({})
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('MIT')
  })

  it('조회 함수가 전부 false 를 돌려주면 (목록 로딩 전) 모든 이름이 미등록이 된다', () => {
    const hints = validateLicenseRegistration(
      makeOssRow({ declaredLicenseList: 'MIT' }),
      () => false,
    )

    expect(hints.declaredLicense?.[0].status).toBe('fail')
  })
})
