import { describe, it, expect } from 'vitest'
import {
  LICENSE_SEARCH_LIMIT,
  licenseNameKey,
  searchLicenses,
  type LicenseSearchOption,
} from './license-search'
import { validateOssRow } from './oss-validation'
import type { OsoriLicense } from './osori-types'
import type { OssRow } from './types'

function lic(id: number, name: string, spdx: string | null = null): OsoriLicense {
  return {
    id,
    name,
    spdx_identifier: spdx,
    obligation_disclosing_src: null,
    obligation_notification: null,
    osi_approval: null,
  }
}

const names = (options: readonly LicenseSearchOption[]): readonly string[] =>
  options.map((option) => option.license.name)

function search(
  licenses: readonly OsoriLicense[],
  query: string,
  overrides: Partial<Parameters<typeof searchLicenses>[0]> = {},
) {
  return searchLicenses({
    licenses,
    query,
    selectedNames: [],
    counterpartNames: [],
    ...overrides,
  })
}

describe('licenseNameKey', () => {
  it('앞뒤 공백과 대소문자를 무시한다', () => {
    expect(licenseNameKey('  MIT  ')).toBe('mit')
    expect(licenseNameKey('Apache-2.0')).toBe('apache-2.0')
    expect(licenseNameKey('mit')).toBe(licenseNameKey(' MIT '))
  })
})

describe('searchLicenses 랭킹', () => {
  // rank 0~4 가 정확히 하나씩 걸리도록 고른 픽스처. 입력 순서는 기대 순서의 역순이다.
  const RANKED = [
    lic(5, 'Unicode Permitted License'), // rank 4: 단어 중간에 'mit' 포함
    lic(4, 'CMU MIT Style License'), // rank 3: 단어 경계에서 시작
    lic(3, 'Mitre Sample License'), // rank 2: name 접두
    lic(2, 'MIT No Attribution', 'MIT-0'), // rank 1: spdx 접두
    lic(1, 'MIT', 'MIT'), // rank 0: 완전 일치
    lic(6, 'Apache License 2.0', 'Apache-2.0'), // 미매칭
  ]

  it('rank 0~4 순서대로 돌려준다', () => {
    expect(names(search(RANKED, 'mit'))).toEqual([
      'MIT',
      'MIT No Attribution',
      'Mitre Sample License',
      'CMU MIT Style License',
      'Unicode Permitted License',
    ])
  })

  it('어느 랭크에도 걸리지 않으면 결과에서 뺀다', () => {
    expect(names(search(RANKED, 'mit'))).not.toContain('Apache License 2.0')
  })

  it('매칭이 하나도 없으면 빈 배열이다', () => {
    expect(search(RANKED, 'zzz-no-such-license')).toEqual([])
  })

  it('name 이 달라도 spdx 가 완전 일치하면 rank 0 이다', () => {
    const licenses = [
      lic(1, 'Apache-2.0 Extended Edition'),
      lic(2, 'Apache License 2.0', 'Apache-2.0'),
    ]

    expect(names(search(licenses, 'apache-2.0'))).toEqual([
      'Apache License 2.0',
      'Apache-2.0 Extended Edition',
    ])
  })

  it('대소문자와 앞뒤 공백을 무시하고 검색한다', () => {
    expect(names(search(RANKED, '  MiT  '))[0]).toBe('MIT')
  })

  it('같은 랭크 안에서는 짧은 이름 먼저, 그다음 사전순이다', () => {
    const licenses = [
      lic(1, 'BSD Zebra License'),
      lic(2, 'BSD Alpha License'),
      lic(3, 'BSD 3-Clause'),
    ]

    // 'BSD Zebra License' 와 'BSD Alpha License' 는 길이가 같으므로 사전순이 결정한다.
    expect(names(search(licenses, 'bsd'))).toEqual([
      'BSD 3-Clause',
      'BSD Alpha License',
      'BSD Zebra License',
    ])
  })

  it('쉼표가 든 마스터 이름도 검색된다', () => {
    const licenses = [lic(1, 'Server Side Public License, v 1', 'SSPL-1.0'), lic(2, 'MIT', 'MIT')]

    expect(names(search(licenses, 'server side'))).toEqual(['Server Side Public License, v 1'])
    expect(names(search(licenses, 'public'))).toEqual(['Server Side Public License, v 1'])
  })
})

describe('searchLicenses 상한', () => {
  const MANY = Array.from({ length: 120 }, (_, i) => lic(i + 1, `License ${String(i).padStart(3, '0')}`))

  it('기본 상한은 LICENSE_SEARCH_LIMIT 이다', () => {
    expect(search(MANY, 'license')).toHaveLength(LICENSE_SEARCH_LIMIT)
  })

  it('상한은 정렬 뒤에 적용된다 — 입력 순서상 마지막이라도 rank 0 이면 살아남는다', () => {
    const licenses = [
      lic(1, 'MIT Variant A'),
      lic(2, 'MIT Variant B'),
      lic(3, 'MIT', 'MIT'), // 입력 마지막이지만 완전 일치
    ]

    expect(names(search(licenses, 'mit', { limit: 1 }))).toEqual(['MIT'])
  })

  it('limit 0 이면 빈 배열이다', () => {
    expect(search(MANY, 'license', { limit: 0 })).toEqual([])
  })
})

describe('searchLicenses 빈 검색어', () => {
  const licenses = [lic(1, 'Zlib'), lic(2, 'Apache License 2.0'), lic(3, 'MIT')]

  it('전건을 이름 사전순으로 돌려준다', () => {
    expect(names(search(licenses, ''))).toEqual(['Apache License 2.0', 'MIT', 'Zlib'])
  })

  it('공백만 있는 검색어도 빈 검색어로 본다', () => {
    expect(names(search(licenses, '   '))).toEqual(['Apache License 2.0', 'MIT', 'Zlib'])
  })

  it('빈 검색어에도 상한이 적용된다', () => {
    expect(names(search(licenses, '', { limit: 2 }))).toEqual(['Apache License 2.0', 'MIT'])
  })
})

describe('searchLicenses 비활성 사유', () => {
  const licenses = [lic(1, 'MIT', 'MIT'), lic(2, 'MIT No Attribution', 'MIT-0')]

  it('선택 안 된 항목은 disabledReason 이 null 이다', () => {
    expect(search(licenses, 'mit')[0].disabledReason).toBeNull()
  })

  it('이미 선택된 항목을 목록에서 빼지 않고 사유만 붙인다', () => {
    const result = search(licenses, 'mit', { selectedNames: ['MIT'] })

    expect(names(result)).toEqual(['MIT', 'MIT No Attribution'])
    expect(result[0].disabledReason).toBe('selected-here')
    expect(result[1].disabledReason).toBeNull()
  })

  it('반대편 필드에 선택된 항목은 selected-counterpart 다', () => {
    const result = search(licenses, 'mit', { counterpartNames: ['MIT'] })

    expect(result[0].disabledReason).toBe('selected-counterpart')
  })

  it('양쪽에 모두 있으면 selected-here 가 우선한다', () => {
    const result = search(licenses, 'mit', {
      selectedNames: ['MIT'],
      counterpartNames: ['MIT'],
    })

    expect(result[0].disabledReason).toBe('selected-here')
  })

  it('선택 이름 비교도 대소문자·공백을 무시한다', () => {
    const result = search(licenses, 'mit', { selectedNames: ['  mit  '] })

    expect(result[0].disabledReason).toBe('selected-here')
  })

  it('name 만 비교한다 — spdx 별칭은 중복으로 보지 않는다 (규칙과 동일한 한계)', () => {
    const result = search([lic(1, 'Apache License 2.0', 'Apache-2.0')], 'apache', {
      counterpartNames: ['Apache-2.0'],
    })

    expect(result[0].disabledReason).toBeNull()
  })
})

describe('searchLicenses 와 규칙 6(declared/detected 중복)의 정합성', () => {
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

  it('규칙이 중복이라고 보는 조합을 컨트롤도 비활성으로 본다', () => {
    const hints = validateOssRow(
      makeOssRow({ declaredLicenseList: ' mit ', detectedLicenseList: 'MIT' }),
    )
    const ruleBlocks = (hints.declaredLicense ?? []).some((hint) => hint.status === 'fail')

    const option = search([lic(1, 'MIT', 'MIT')], 'mit', { counterpartNames: ['MIT'] })[0]

    expect(ruleBlocks).toBe(true)
    expect(option.disabledReason).toBe('selected-counterpart')
  })

  it('규칙이 막지 않는 조합은 컨트롤도 막지 않는다', () => {
    const hints = validateOssRow(
      makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: 'Apache License 2.0' }),
    )
    const ruleBlocks = (hints.declaredLicense ?? []).some((hint) => hint.status === 'fail')

    const option = search([lic(1, 'MIT', 'MIT')], 'mit', {
      counterpartNames: ['Apache License 2.0'],
    })[0]

    expect(ruleBlocks).toBe(false)
    expect(option.disabledReason).toBeNull()
  })
})

describe('searchLicenses 불변성', () => {
  it('입력 배열을 변경하지 않는다', () => {
    const licenses = [lic(3, 'Zlib'), lic(1, 'MIT', 'MIT'), lic(2, 'Apache License 2.0')]
    const licensesSnapshot = [...licenses]
    const selectedNames = ['MIT']
    const selectedSnapshot = [...selectedNames]
    const counterpartNames = ['Zlib']
    const counterpartSnapshot = [...counterpartNames]

    searchLicenses({ licenses, query: '', selectedNames, counterpartNames })
    searchLicenses({ licenses, query: 'mit', selectedNames, counterpartNames })

    expect(licenses).toEqual(licensesSnapshot)
    expect(selectedNames).toEqual(selectedSnapshot)
    expect(counterpartNames).toEqual(counterpartSnapshot)
  })

  it('원본 license 객체를 그대로 참조해 돌려준다', () => {
    const mit = lic(1, 'MIT', 'MIT')

    expect(search([mit], 'mit')[0].license).toBe(mit)
  })
})
