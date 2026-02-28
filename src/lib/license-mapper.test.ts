import { describe, it, expect } from 'vitest'
import { toLicenseCreateRequest } from './license-mapper'
import type { LicenseRow } from './types'

function makeLicenseRow(overrides: Partial<LicenseRow> = {}): LicenseRow {
  return {
    no: 1,
    licenseName: 'Apache License 2.0',
    spdxIdentifier: 'Apache-2.0',
    nickName: null,
    obligationNotice: true,
    obligationDisclosingSrc: 'NONE',
    restriction: null,
    webpage: 'https://www.apache.org/licenses/LICENSE-2.0',
    webpageList: null,
    descriptionKo: null,
    ...overrides,
  }
}

describe('toLicenseCreateRequest', () => {
  it('기본 필드를 올바르게 매핑한다', () => {
    const row = makeLicenseRow()
    const result = toLicenseCreateRequest(row, [])

    expect(result.name).toBe('Apache License 2.0')
    expect(result.spdx_identifier).toBe('Apache-2.0')
    expect(result.obligation_notification).toBe(true)
    expect(result.obligation_disclosing_src).toBe('NONE')
    expect(result.webpage).toBe('https://www.apache.org/licenses/LICENSE-2.0')
    expect(result.restrictionList).toEqual([])
  })

  it('restrictionIds를 restrictionList에 매핑한다', () => {
    const row = makeLicenseRow()
    const result = toLicenseCreateRequest(row, [26, 31])

    expect(result.restrictionList).toEqual([26, 31])
  })

  it('nickName을 줄바꿈/콤마로 분리하여 배열로 변환한다', () => {
    const row = makeLicenseRow({ nickName: 'Apache 2.0\nASL 2.0,ASF License' })
    const result = toLicenseCreateRequest(row, [])

    expect(result.nicknameList).toEqual(['Apache 2.0', 'ASL 2.0', 'ASF License'])
  })

  it('webpageList를 줄바꿈/콤마로 분리하여 배열로 변환한다', () => {
    const row = makeLicenseRow({
      webpageList: 'https://url1.com\nhttps://url2.com',
    })
    const result = toLicenseCreateRequest(row, [])

    expect(result.webpageList).toEqual(['https://url1.com', 'https://url2.com'])
  })

  it('빈 spdxIdentifier는 undefined로 변환한다', () => {
    const row = makeLicenseRow({ spdxIdentifier: '  ' })
    const result = toLicenseCreateRequest(row, [])

    expect(result.spdx_identifier).toBeUndefined()
  })

  it('빈 descriptionKo는 undefined로 변환한다', () => {
    const row = makeLicenseRow({ descriptionKo: null })
    const result = toLicenseCreateRequest(row, [])

    expect(result.description_ko).toBeUndefined()
  })

  it('descriptionKo가 있으면 trim하여 변환한다', () => {
    const row = makeLicenseRow({ descriptionKo: '  설명 텍스트  ' })
    const result = toLicenseCreateRequest(row, [])

    expect(result.description_ko).toBe('설명 텍스트')
  })

  it('licenseName을 trim한다', () => {
    const row = makeLicenseRow({ licenseName: '  MIT License  ' })
    const result = toLicenseCreateRequest(row, [])

    expect(result.name).toBe('MIT License')
  })

  it('nickName이 null이면 빈 배열을 반환한다', () => {
    const row = makeLicenseRow({ nickName: null })
    const result = toLicenseCreateRequest(row, [])

    expect(result.nicknameList).toEqual([])
  })

  it('reviewed 필드가 포함되지 않는다', () => {
    const row = makeLicenseRow()
    const result = toLicenseCreateRequest(row, [])

    expect(result).not.toHaveProperty('reviewed')
  })
})
