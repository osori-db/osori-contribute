import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ValidationBadge, { ValidationHintsRow } from './ValidationBadge'
import type { FieldHints } from '@/lib/field-hints'
import type { RowValidationResult } from '@/lib/pre-validation'

function makeResult(hints: FieldHints, urlChecked = true): RowValidationResult {
  return { hints, urlChecked, checkedAt: 1_700_000_000_000 }
}

function renderHintsRow(result: RowValidationResult | undefined, colSpan = 6) {
  return render(
    <table>
      <tbody>
        <ValidationHintsRow result={result} colSpan={colSpan} />
      </tbody>
    </table>,
  )
}

describe('ValidationBadge', () => {
  it('결과가 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<ValidationBadge result={undefined} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('fail 이 없고 warn 도 없으면 통과 배지를 보여준다', () => {
    render(<ValidationBadge result={makeResult({})} />)

    expect(screen.getByText('검증 통과')).toBeInTheDocument()
  })

  it('fail 개수를 차단 배지에 적는다', () => {
    render(
      <ValidationBadge
        result={makeResult({
          downloadLocation: [{ status: 'fail', message: 'A' }],
          version: [{ status: 'fail', message: 'B' }],
        })}
      />,
    )

    expect(screen.getByText('차단 2')).toBeInTheDocument()
  })

  it('fail 이 있으면 warn 이 있어도 차단으로 표시한다', () => {
    render(
      <ValidationBadge
        result={makeResult({
          downloadLocation: [
            { status: 'fail', message: 'A' },
            { status: 'warn', message: 'B' },
          ],
        })}
      />,
    )

    expect(screen.getByText('차단 1')).toBeInTheDocument()
    expect(screen.queryByText(/확인 필요/)).not.toBeInTheDocument()
  })

  it('warn 만 있으면 확인 필요로 표시한다', () => {
    render(
      <ValidationBadge
        result={makeResult({ downloadLocation: [{ status: 'warn', message: 'A' }] })}
      />,
    )

    expect(screen.getByText('확인 필요 1')).toBeInTheDocument()
  })

  it('info 는 개수에 넣지 않는다', () => {
    render(
      <ValidationBadge result={makeResult({ copyright: [{ status: 'info', message: 'I' }] })} />,
    )

    expect(screen.getByText('검증 통과')).toBeInTheDocument()
  })

  it('URL 검사를 건너뛴 결과는 라벨 뒤에 * 를 붙인다', () => {
    render(<ValidationBadge result={makeResult({}, false)} />)

    expect(screen.getByText('검증 통과*')).toBeInTheDocument()
    expect(screen.getByTitle(/URL 접속 검사 제외/)).toBeInTheDocument()
  })

  it('툴팁에 fail·warn 메시지를 줄바꿈으로 담는다', () => {
    const { container } = render(
      <ValidationBadge
        result={makeResult({
          downloadLocation: [{ status: 'fail', message: '접속 불가' }],
          version: [{ status: 'warn', message: '접두사 제거' }],
        })}
      />,
    )

    // getByTitle 은 공백을 정규화하므로 속성을 직접 읽는다.
    expect(container.querySelector('span')).toHaveAttribute('title', '접속 불가\n접두사 제거')
  })
})

describe('ValidationHintsRow', () => {
  it('결과가 없으면 행을 만들지 않는다', () => {
    const { container } = renderHintsRow(undefined)

    expect(container.querySelector('tr')).toBeNull()
  })

  it('fail·warn 이 없으면 행을 만들지 않는다', () => {
    const { container } = renderHintsRow(makeResult({ copyright: [{ status: 'info', message: 'I' }] }))

    expect(container.querySelector('tr')).toBeNull()
  })

  it('fail 과 warn 메시지를 모두 펼친다', () => {
    renderHintsRow(
      makeResult({
        downloadLocation: [{ status: 'fail', message: '접속 불가' }],
        version: [{ status: 'warn', message: '접두사 제거' }],
      }),
    )

    expect(screen.getByText(/접속 불가/)).toBeInTheDocument()
    expect(screen.getByText(/접두사 제거/)).toBeInTheDocument()
  })

  it('표 컬럼 수에 맞춰 colSpan 을 설정한다', () => {
    const { container } = renderHintsRow(
      makeResult({ webpage: [{ status: 'fail', message: 'X' }] }),
      9,
    )

    expect(container.querySelector('td')).toHaveAttribute('colspan', '9')
  })
})
