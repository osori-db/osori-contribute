import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LicenseContributeModal from './LicenseContributeModal'
import type { LicenseRow } from '@/lib/types'
import type { OsoriRestriction } from '@/lib/osori-types'

// ─── Helpers ───

function makeLicenseRow(overrides: Partial<LicenseRow> = {}): LicenseRow {
  return {
    no: 1,
    licenseName: 'Apache License 2.0',
    spdxIdentifier: 'Apache-2.0',
    nickName: null,
    obligationNotice: true,
    obligationDisclosingSrc: 'NONE',
    restriction: 'Network Triggered',
    webpage: 'https://www.apache.org/licenses/LICENSE-2.0',
    webpageList: null,
    descriptionKo: null,
    ...overrides,
  }
}

const restrictions: readonly OsoriRestriction[] = [
  { id: 26, name: 'Network Triggered', description: null, description_ko: null, level: 0, reviewed: 1 },
  { id: 27, name: 'Internal Use Only', description: null, description_ko: null, level: 0, reviewed: 1 },
]

function renderModal(row: LicenseRow, onSave = vi.fn()) {
  render(
    <LicenseContributeModal
      open
      onClose={vi.fn()}
      row={row}
      onSave={onSave}
      saving={false}
      restrictions={restrictions}
      mapNamesToIds={vi.fn().mockReturnValue([26])}
    />,
  )
  return { onSave }
}

const saveButton = () => screen.getByRole('button', { name: '저장' })

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tests ───

describe('LicenseContributeModal 편집', () => {
  it('원본 값이 입력 필드에 채워진다', () => {
    renderModal(makeLicenseRow())

    expect(screen.getByLabelText('License Name')).toHaveValue('Apache License 2.0')
    expect(screen.getByLabelText('SPDX Identifier')).toHaveValue('Apache-2.0')
    expect(screen.getByLabelText('Obligation Notice')).toBeChecked()
  })

  it('값을 수정하고 저장하면 수정된 row가 onSave로 전달된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeLicenseRow())

    const spdx = screen.getByLabelText('SPDX Identifier')
    await user.clear(spdx)
    await user.type(spdx, 'MIT')
    await user.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ spdxIdentifier: 'MIT' })
  })

  it('Obligation Notice 체크박스를 토글할 수 있다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeLicenseRow())

    await user.click(screen.getByLabelText('Obligation Notice'))
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].obligationNotice).toBe(false)
  })

  it('nullable 필드를 비우면 null로 전달된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeLicenseRow({ nickName: 'ASL 2.0' }))

    await user.clear(screen.getByLabelText('Nick Name'))
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].nickName).toBeNull()
  })

  it('원본을 변경하지 않는다 (불변성)', async () => {
    const user = userEvent.setup()
    const row = makeLicenseRow()
    const { onSave } = renderModal(row)

    await user.clear(screen.getByLabelText('License Name'))
    await user.type(screen.getByLabelText('License Name'), 'MIT License')
    await user.click(saveButton())

    expect(row.licenseName).toBe('Apache License 2.0')
    expect(onSave.mock.calls[0][0]).not.toBe(row)
  })

  it('필수 항목을 비우면 저장이 잠기고, 다시 채우면 열린다', async () => {
    const user = userEvent.setup()
    renderModal(makeLicenseRow())

    const webpage = screen.getByLabelText('Webpage')
    await user.clear(webpage)
    expect(saveButton()).toBeDisabled()
    expect(
      screen.getByText(/License text를 확인할 수 있는 URL을 입력해주세요\./),
    ).toBeInTheDocument()

    await user.type(webpage, 'https://opensource.org/license/mit')
    expect(saveButton()).toBeEnabled()
  })

  it('추가 가능한 Restriction을 클릭하면 Restriction 입력에 더해진다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeLicenseRow())

    await user.click(screen.getByRole('button', { name: '+ Internal Use Only' }))
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].restriction).toBe('Network Triggered, Internal Use Only')
  })

  it('이미 지정된 Restriction은 추가 후보에서 사라진다', async () => {
    const user = userEvent.setup()
    renderModal(makeLicenseRow())

    expect(screen.queryByRole('button', { name: '+ Network Triggered' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Internal Use Only' }))
    expect(screen.queryByRole('button', { name: '+ Internal Use Only' })).not.toBeInTheDocument()
  })

  it('원래대로를 누르면 편집 내용이 원본으로 되돌아간다', async () => {
    const user = userEvent.setup()
    renderModal(makeLicenseRow())

    await user.clear(screen.getByLabelText('SPDX Identifier'))
    await user.type(screen.getByLabelText('SPDX Identifier'), 'MIT')
    expect(screen.getByLabelText('SPDX Identifier')).toHaveValue('MIT')

    await user.click(screen.getByRole('button', { name: '원래대로' }))
    expect(screen.getByLabelText('SPDX Identifier')).toHaveValue('Apache-2.0')
  })
})
