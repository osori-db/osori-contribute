import { describe, it, expect } from 'vitest'
import { changedFieldKeys } from './row-diff'
import { LICENSE_FIELD_LABELS, OSS_FIELD_LABELS, toFieldLabels } from './field-labels'

describe('changedFieldKeys', () => {
  it('값이 같으면 빈 배열을 반환한다', () => {
    const row = { a: '1', b: null }
    expect(changedFieldKeys(row, { ...row })).toEqual([])
  })

  it('달라진 필드 키만 반환한다', () => {
    const original = { a: '1', b: 'x', c: true }
    const edited = { a: '2', b: 'x', c: false }
    expect(changedFieldKeys(original, edited)).toEqual(['a', 'c'])
  })

  it('키를 정렬해 반환한다', () => {
    const original = { z: '1', a: '1' }
    const edited = { z: '2', a: '2' }
    expect(changedFieldKeys(original, edited)).toEqual(['a', 'z'])
  })

  it('null과 빈 문자열을 다른 값으로 취급한다', () => {
    expect(changedFieldKeys({ a: null }, { a: '' })).toEqual(['a'])
  })

  it('null끼리는 같은 값으로 취급한다', () => {
    expect(changedFieldKeys({ a: null }, { a: null })).toEqual([])
  })

  it('boolean 변경을 감지한다', () => {
    expect(changedFieldKeys({ ok: true }, { ok: false })).toEqual(['ok'])
  })
})

describe('toFieldLabels', () => {
  it('필드 키를 화면 라벨로 바꾼다', () => {
    expect(toFieldLabels(['spdxIdentifier', 'webpage'], LICENSE_FIELD_LABELS)).toEqual([
      'SPDX Identifier',
      'Webpage',
    ])
  })

  it('추가 정보 섹션의 필드도 라벨을 가진다', () => {
    expect(
      toFieldLabels(
        ['description', 'attribution', 'complianceNotice', 'complianceNoticeKo', 'releaseDate'],
        OSS_FIELD_LABELS,
      ),
    ).toEqual([
      'Description',
      'Attribution',
      'Compliance Notice',
      'Compliance Notice (KO)',
      'Release Date',
    ])
  })

  it('라벨이 없는 키는 키를 그대로 쓴다', () => {
    expect(toFieldLabels(['unknownField'], OSS_FIELD_LABELS)).toEqual(['unknownField'])
  })
})
