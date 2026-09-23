import { describe, it, expect } from 'vitest'
import { buildPurl, toOssCreateRequest, toOssVersionCreateRequest } from './oss-mapper'
import { parseMultiValue } from './multi-value'
import type { OssRow } from './types'

function makeOssRow(overrides: Partial<OssRow> = {}): OssRow {
  return {
    no: 1,
    ossName: 'lodash',
    nickname: null,
    homepage: 'https://lodash.com',
    downloadLocation: 'https://github.com/lodash/lodash',
    downloadLocationList: null,
    attribution: null,
    complianceNotice: null,
    complianceNoticeKo: null,
    publisher: 'John-David Dalton',
    version: '4.17.21',
    licenseCombination: null,
    declaredLicenseList: 'MIT',
    detectedLicenseList: null,
    copyright: 'Copyright JS Foundation',
    releaseDate: null,
    description: null,
    descriptionKo: null,
    ...overrides,
  }
}

describe('buildPurl', () => {
  it('GitHub URL에서 purl을 생성한다', () => {
    expect(buildPurl('https://github.com/lodash/lodash')).toBe('pkg:github/lodash/lodash')
  })

  it('GitHub URL의 .git 접미사를 제거한다', () => {
    expect(buildPurl('https://github.com/facebook/react.git')).toBe('pkg:github/facebook/react')
  })

  it('GitHub URL을 소문자로 변환한다', () => {
    expect(buildPurl('https://github.com/Facebook/React')).toBe('pkg:github/facebook/react')
  })

  it('GitHub URL에 경로 추가가 있어도 올바르게 파싱한다', () => {
    expect(buildPurl('https://github.com/owner/repo#readme')).toBe('pkg:github/owner/repo')
    expect(buildPurl('https://github.com/owner/repo?tab=readme')).toBe('pkg:github/owner/repo')
  })

  it('GitHub가 아닌 URL이면 빈 문자열을 반환한다', () => {
    expect(buildPurl('https://npmjs.com/package/lodash')).toBe('')
  })

  it('빈 문자열이면 빈 문자열을 반환한다', () => {
    expect(buildPurl('')).toBe('')
    expect(buildPurl('   ')).toBe('')
  })
})

describe('toOssCreateRequest', () => {
  it('기본 필드를 올바르게 매핑한다', () => {
    const row = makeOssRow()
    const result = toOssCreateRequest(row)

    expect(result.name).toBe('lodash')
    expect(result.download_location).toBe('https://github.com/lodash/lodash')
    expect(result.homepage).toBe('https://lodash.com')
    expect(result.publisher).toBe('John-David Dalton')
  })

  it('nickname을 배열로 분리한다', () => {
    const row = makeOssRow({ nickname: 'lodash.js\nlodash-es' })
    const result = toOssCreateRequest(row)

    expect(result.nicknameList).toEqual(['lodash.js', 'lodash-es'])
  })

  it('nickname이 null이면 빈 배열을 반환한다', () => {
    const row = makeOssRow({ nickname: null })
    const result = toOssCreateRequest(row)

    expect(result.nicknameList).toEqual([])
  })

  it('빈 homepage는 undefined로 변환한다', () => {
    const row = makeOssRow({ homepage: null })
    const result = toOssCreateRequest(row)

    expect(result.homepage).toBeUndefined()
  })

  it('complianceNotice를 compliance_notice에 매핑한다', () => {
    const row = makeOssRow({ complianceNotice: 'Required notice' })
    const result = toOssCreateRequest(row)

    expect(result.compliance_notice).toBe('Required notice')
  })

  it('complianceNoticeKo를 compliance_notice_ko에 매핑한다', () => {
    const row = makeOssRow({ complianceNoticeKo: '필수 고지사항' })
    const result = toOssCreateRequest(row)

    expect(result.compliance_notice_ko).toBe('필수 고지사항')
  })

  it('reviewed 필드가 포함되지 않는다', () => {
    const row = makeOssRow()
    const result = toOssCreateRequest(row)

    expect(result).not.toHaveProperty('reviewed')
  })

  it('필드를 trim한다', () => {
    const row = makeOssRow({
      ossName: '  lodash  ',
      downloadLocation: '  https://github.com/lodash/lodash  ',
    })
    const result = toOssCreateRequest(row)

    expect(result.name).toBe('lodash')
    expect(result.download_location).toBe('https://github.com/lodash/lodash')
  })
})

describe('toOssVersionCreateRequest', () => {
  it('기본 필드를 올바르게 매핑한다', () => {
    const row = makeOssRow()
    const result = toOssVersionCreateRequest(row, 100, [1], [])

    expect(result.version).toBe('4.17.21')
    expect(result.oss_master_id).toBe(100)
    expect(result.copyright).toBe('Copyright JS Foundation')
    expect(result.declaredLicenseList).toEqual([1])
    expect(result.detectedLicenseList).toBeUndefined()
  })

  it('declaredLicenseIds가 비어있으면 undefined로 설정한다', () => {
    const row = makeOssRow()
    const result = toOssVersionCreateRequest(row, 100, [], [2])

    expect(result.declaredLicenseList).toBeUndefined()
    expect(result.detectedLicenseList).toEqual([2])
  })

  it('licenseCombination을 license_combination에 매핑한다', () => {
    const row = makeOssRow({ licenseCombination: 'AND' })
    const result = toOssVersionCreateRequest(row, 100, [1, 2], [])

    expect(result.license_combination).toBe('AND')
  })

  it('releaseDate를 release_date에 매핑한다', () => {
    const row = makeOssRow({ releaseDate: '2023-01-15' })
    const result = toOssVersionCreateRequest(row, 100, [], [])

    expect(result.release_date).toBe('2023-01-15')
  })

  it('version이 null이면 빈 문자열로 변환한다', () => {
    const row = makeOssRow({ version: null })
    const result = toOssVersionCreateRequest(row, 100, [], [])

    expect(result.version).toBe('')
  })

  it('descriptionKo를 description_ko에 매핑한다', () => {
    const row = makeOssRow({ descriptionKo: '자바스크립트 유틸리티 라이브러리' })
    const result = toOssVersionCreateRequest(row, 100, [], [])

    expect(result.description_ko).toBe('자바스크립트 유틸리티 라이브러리')
  })

  it('reviewed 필드가 포함되지 않는다', () => {
    const row = makeOssRow()
    const result = toOssVersionCreateRequest(row, 100, [], [])

    expect(result).not.toHaveProperty('reviewed')
  })
})

/**
 * oss-mapper 는 한때 `/[\n,]/` 로 쪼개는 로컬 복제본을 갖고 있었다. 공유 parseMultiValue 가
 * 줄바꿈 우선으로 바뀌면서 두 구현의 알고리즘이 갈라졌고(혼용 셀에서만 결과가 달랐다),
 * 지금은 공유 함수로 통합됐다. 아래는 그 통합을 고정한다 — 판정·표시에 쓰는 파서와
 * 전송 payload 를 만드는 파서가 다시 갈라지면 여기서 걸린다.
 */
describe('toOssCreateRequest 다중값 분리 (줄바꿈 우선 전환 회귀)', () => {
  it('쉼표만 있는 nickname 은 공유 파서와 같은 결과다', () => {
    const result = toOssCreateRequest(makeOssRow({ nickname: 'lodash.js, lodash-es' }))

    expect(result.nicknameList).toEqual(['lodash.js', 'lodash-es'])
    expect(result.nicknameList).toEqual(parseMultiValue('lodash.js, lodash-es'))
  })

  it('줄바꿈만 있는 nickname 도 공유 파서와 같은 결과다', () => {
    const result = toOssCreateRequest(makeOssRow({ nickname: 'lodash.js\nlodash-es' }))

    expect(result.nicknameList).toEqual(['lodash.js', 'lodash-es'])
    expect(result.nicknameList).toEqual(parseMultiValue('lodash.js\nlodash-es'))
  })

  it('혼용 셀도 공유 파서와 같게 해석한다 (로컬 복제본 제거 회귀)', () => {
    // 로컬 복제본이 살아 있던 시절에는 ['a','b','c'] 로 더 잘게 쪼개졌다.
    const mixed = 'a, b\nc'

    expect(toOssCreateRequest(makeOssRow({ nickname: mixed })).nicknameList).toEqual(['a, b', 'c'])
    expect(toOssCreateRequest(makeOssRow({ nickname: mixed })).nicknameList).toEqual(
      parseMultiValue(mixed),
    )
  })

  it('이름에 쉼표가 든 값도 줄바꿈이 있으면 통째로 보낸다', () => {
    const value = 'Server Side Public License, v 1\nMIT'

    expect(toOssCreateRequest(makeOssRow({ nickname: value })).nicknameList).toEqual([
      'Server Side Public License, v 1',
      'MIT',
    ])
  })
})
