import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreValidateButton from './PreValidateButton'

const idle = { current: 0, total: 0 }

describe('PreValidateButton', () => {
  it('대기 상태에서는 대상 건수를 보여준다', () => {
    render(
      <PreValidateButton running={false} progress={idle} count={12} disabled={false} onClick={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '사전 검증 (12건)' })).toBeInTheDocument()
  })

  it('진행 중에는 URL 진행률을 보여준다', () => {
    render(
      <PreValidateButton
        running
        progress={{ current: 3, total: 10 }}
        count={12}
        disabled={false}
        onClick={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /검증 중\.\.\. \(3\/10\)/ })).toBeInTheDocument()
  })

  it('클릭하면 onClick 을 호출한다', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <PreValidateButton running={false} progress={idle} count={1} disabled={false} onClick={onClick} />,
    )

    await user.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled 면 클릭해도 호출되지 않는다', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <PreValidateButton running={false} progress={idle} count={1} disabled onClick={onClick} />,
    )

    expect(screen.getByRole('button')).toBeDisabled()
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('진행 중에는 중복 실행을 막는다', () => {
    render(
      <PreValidateButton
        running
        progress={{ current: 1, total: 2 }}
        count={2}
        disabled={false}
        onClick={vi.fn()}
      />,
    )

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('대상이 0건이어도 라벨을 표시한다', () => {
    render(
      <PreValidateButton running={false} progress={idle} count={0} disabled onClick={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '사전 검증 (0건)' })).toBeInTheDocument()
  })
})
