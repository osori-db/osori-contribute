import { describe, it, expect } from 'vitest'
import {
  addHint,
  collectFailMessages,
  collectWarnMessages,
  hasValidationFailure,
  mergeFieldHints,
  type FieldHints,
  type HintAccumulator,
} from './field-hints'

describe('addHint', () => {
  it('없던 필드에 힌트를 새로 만든다', () => {
    const acc: HintAccumulator = {}

    addHint(acc, 'version', 'warn', '접두사를 제거해주세요.')

    expect(acc).toEqual({ version: [{ status: 'warn', message: '접두사를 제거해주세요.' }] })
  })

  it('같은 필드에 여러 힌트를 순서대로 쌓는다', () => {
    const acc: HintAccumulator = {}

    addHint(acc, 'version', 'warn', '첫 번째')
    addHint(acc, 'version', 'fail', '두 번째')

    expect(acc.version.map((h) => h.message)).toEqual(['첫 번째', '두 번째'])
  })
})

describe('mergeFieldHints', () => {
  it('서로 다른 필드의 힌트를 하나로 합친다', () => {
    const a: FieldHints = { version: [{ status: 'warn', message: 'A' }] }
    const b: FieldHints = { downloadLocation: [{ status: 'fail', message: 'B' }] }

    expect(mergeFieldHints(a, b)).toEqual({
      version: [{ status: 'warn', message: 'A' }],
      downloadLocation: [{ status: 'fail', message: 'B' }],
    })
  })

  it('같은 필드의 힌트는 인자 순서대로 이어붙인다', () => {
    const a: FieldHints = { version: [{ status: 'warn', message: '먼저' }] }
    const b: FieldHints = { version: [{ status: 'fail', message: '나중' }] }

    expect(mergeFieldHints(a, b).version?.map((h) => h.message)).toEqual(['먼저', '나중'])
  })

  it('입력 객체와 그 배열을 변경하지 않는다 (불변성)', () => {
    const a: FieldHints = { version: [{ status: 'warn', message: 'A' }] }
    const b: FieldHints = { version: [{ status: 'fail', message: 'B' }] }
    const snapshotA = JSON.parse(JSON.stringify(a))
    const snapshotB = JSON.parse(JSON.stringify(b))

    const merged = mergeFieldHints(a, b)

    expect(a).toEqual(snapshotA)
    expect(b).toEqual(snapshotB)
    expect(a.version).toHaveLength(1)
    expect(merged.version).not.toBe(a.version)
    expect(merged).not.toBe(a)
  })

  it('병합 결과를 변경해도 원본 배열에 영향이 없다', () => {
    const a: FieldHints = { version: [{ status: 'warn', message: 'A' }] }

    const merged = mergeFieldHints(a) as Record<string, { status: string; message: string }[]>
    merged.version.push({ status: 'fail', message: '나중에 추가' })

    expect(a.version).toHaveLength(1)
  })

  it('빈 배열인 필드는 결과에 남기지 않는다', () => {
    expect(mergeFieldHints({ version: [] })).toEqual({})
  })

  it('인자가 없으면 빈 객체를 돌려준다', () => {
    expect(mergeFieldHints()).toEqual({})
  })
})

describe('hasValidationFailure', () => {
  it('fail 이 하나라도 있으면 true', () => {
    expect(
      hasValidationFailure({
        version: [{ status: 'warn', message: 'W' }],
        downloadLocation: [{ status: 'fail', message: 'F' }],
      }),
    ).toBe(true)
  })

  it('warn·info 만 있으면 false', () => {
    expect(
      hasValidationFailure({
        version: [{ status: 'warn', message: 'W' }],
        copyright: [{ status: 'info', message: 'I' }],
      }),
    ).toBe(false)
  })

  it('빈 힌트는 false', () => {
    expect(hasValidationFailure({})).toBe(false)
  })
})

describe('collectFailMessages / collectWarnMessages', () => {
  const hints: FieldHints = {
    downloadLocation: [
      { status: 'fail', message: '필수입니다' },
      { status: 'warn', message: 'GitHub 권장' },
    ],
    version: [{ status: 'fail', message: 'Git hash 불가' }],
    copyright: [{ status: 'info', message: '확인해주세요' }],
  }

  it('fail 메시지만 뽑는다', () => {
    expect(collectFailMessages(hints)).toEqual(['필수입니다', 'Git hash 불가'])
  })

  it('warn 메시지만 뽑는다', () => {
    expect(collectWarnMessages(hints)).toEqual(['GitHub 권장'])
  })

  it('해당 상태가 없으면 빈 배열', () => {
    expect(collectFailMessages({ copyright: [{ status: 'info', message: 'I' }] })).toEqual([])
    expect(collectWarnMessages({})).toEqual([])
  })
})
