import { describe, it, expect } from 'vitest'
import { joinMultiValue, parseMultiValue } from './multi-value'

/** 실제 OSORI 마스터에 존재하는, 이름에 쉼표가 든 라이선스 5종. */
const COMMA_NAMES = [
  'Server Side Public License, v 1',
  'Mulan Permissive Software License, Version 2',
  'The X.Net, Inc. License',
  'Functional Source License, Version 1.1, ALv2 Future License',
  'Functional Source License, Version 1.1, MIT Future License',
] as const

/** 쉼표가 없는 평범한 이름들. 혼합 케이스를 만들 때 쓴다. */
const PLAIN_NAMES = ['MIT', 'Apache-2.0', 'GPL-2.0-only', 'BSD 3-Clause "New" License'] as const

describe('parseMultiValue', () => {
  it('빈 값은 빈 배열이다', () => {
    expect(parseMultiValue(null)).toEqual([])
    expect(parseMultiValue('')).toEqual([])
    expect(parseMultiValue('   ')).toEqual([])
    expect(parseMultiValue('\n\n')).toEqual([])
    expect(parseMultiValue(',,')).toEqual([])
  })

  it('단일 값은 trim 만 한다', () => {
    expect(parseMultiValue('  MIT  ')).toEqual(['MIT'])
  })

  // ── 아래 3건은 줄바꿈 우선 전환 전후로 결과가 같아야 하는 회귀 고정이다 ──

  it('쉼표만 있는 값은 쉼표로 쪼갠다 (기존 동작 유지)', () => {
    expect(parseMultiValue('MIT,Apache-2.0')).toEqual(['MIT', 'Apache-2.0'])
    expect(parseMultiValue('MIT, Apache-2.0 , GPL-2.0-only')).toEqual([
      'MIT',
      'Apache-2.0',
      'GPL-2.0-only',
    ])
  })

  it('줄바꿈만 있는 값은 줄바꿈으로 쪼갠다 (기존 동작 유지)', () => {
    expect(parseMultiValue('MIT\nApache-2.0')).toEqual(['MIT', 'Apache-2.0'])
    expect(parseMultiValue('  MIT  \n  Apache-2.0  \n')).toEqual(['MIT', 'Apache-2.0'])
  })

  it('각 조각의 앞뒤 공백을 제거하고 빈 조각을 버린다 (기존 동작 유지)', () => {
    expect(parseMultiValue('MIT,,Apache-2.0')).toEqual(['MIT', 'Apache-2.0'])
    expect(parseMultiValue('MIT\n\n  \nApache-2.0')).toEqual(['MIT', 'Apache-2.0'])
  })

  // ── 줄바꿈 우선으로 바뀌면서 달라지는 유일한 경우: 줄바꿈과 쉼표를 함께 쓴 셀 ──

  it('줄바꿈이 있으면 쉼표로는 쪼개지 않는다', () => {
    expect(parseMultiValue('Server Side Public License, v 1\nMIT')).toEqual([
      'Server Side Public License, v 1',
      'MIT',
    ])
  })

  it('줄바꿈이 없을 때만 쉼표를 구분자로 본다', () => {
    // 줄바꿈이 없으므로 쉼표 분리가 그대로 일어난다. 이 형태는 joinMultiValue 가 만들지 않는다.
    expect(parseMultiValue('Server Side Public License, v 1')).toEqual([
      'Server Side Public License',
      'v 1',
    ])
  })
})

describe('joinMultiValue', () => {
  it('여러 값을 줄바꿈으로 잇는다', () => {
    expect(joinMultiValue(['MIT', 'Apache-2.0'])).toBe('MIT\nApache-2.0')
  })

  it('쉼표가 든 이름도 쉼표가 아니라 줄바꿈으로 잇는다', () => {
    expect(joinMultiValue(['Server Side Public License, v 1', 'MIT'])).toBe(
      'Server Side Public License, v 1\nMIT',
    )
  })

  it('값이 하나뿐이고 쉼표가 없으면 후행 줄바꿈을 붙이지 않는다', () => {
    expect(joinMultiValue(['MIT'])).toBe('MIT')
  })

  it('값이 하나뿐이고 쉼표가 있으면 후행 줄바꿈으로 구분자 모드를 고정한다', () => {
    expect(joinMultiValue(['Server Side Public License, v 1'])).toBe(
      'Server Side Public License, v 1\n',
    )
  })

  it('각 값을 trim 하고 빈 값을 버린다', () => {
    expect(joinMultiValue(['  MIT  ', '', '   ', 'Apache-2.0'])).toBe('MIT\nApache-2.0')
  })

  it('남는 값이 없으면 null 이다', () => {
    expect(joinMultiValue([])).toBeNull()
    expect(joinMultiValue(['', '  '])).toBeNull()
  })

  it('입력 배열을 변경하지 않는다', () => {
    const input = ['  MIT  ', 'Apache-2.0']
    const snapshot = [...input]
    joinMultiValue(input)
    expect(input).toEqual(snapshot)
  })
})

describe('parseMultiValue(joinMultiValue(xs)) === xs 불변식', () => {
  /**
   * 속성 테스트. 후보 이름 풀에서 만든 모든 1~3개 조합을 왕복시킨다.
   * 풀에 쉼표 이름 5종을 모두 넣어, 단독 선택과 혼합 선택을 둘 다 덮는다.
   */
  const POOL = [...COMMA_NAMES, ...PLAIN_NAMES]

  function combinations(size: number): readonly (readonly string[])[] {
    if (size === 0) return [[]]
    return combinations(size - 1).flatMap((prefix) => POOL.map((name) => [...prefix, name]))
  }

  it('단독 선택이 왕복된다', () => {
    for (const xs of combinations(1)) {
      expect(parseMultiValue(joinMultiValue(xs))).toEqual(xs)
    }
  })

  it('두 개를 섞어 선택해도 왕복된다', () => {
    for (const xs of combinations(2)) {
      expect(parseMultiValue(joinMultiValue(xs))).toEqual(xs)
    }
  })

  it('세 개를 섞어 선택해도 왕복된다', () => {
    for (const xs of combinations(3)) {
      expect(parseMultiValue(joinMultiValue(xs))).toEqual(xs)
    }
  })

  it('빈 선택은 null 로 나가고 빈 배열로 돌아온다', () => {
    expect(parseMultiValue(joinMultiValue([]))).toEqual([])
  })

  it('공백이 섞여 있어도 trim 된 값으로 왕복된다', () => {
    const xs = ['  Server Side Public License, v 1 ', ' MIT ']
    expect(parseMultiValue(joinMultiValue(xs))).toEqual([
      'Server Side Public License, v 1',
      'MIT',
    ])
  })
})
