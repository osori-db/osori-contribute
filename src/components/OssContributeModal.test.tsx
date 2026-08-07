import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OssContributeModal from './OssContributeModal'
import type { OssRow } from '@/lib/types'

// ─── Helpers ───

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

const licenseMap = new Map<string, number>([['MIT', 1]])

function renderModal(row: OssRow, onSave = vi.fn()) {
  render(
    <OssContributeModal
      open
      onClose={vi.fn()}
      row={row}
      onSave={onSave}
      saving={false}
      licenseMap={licenseMap}
      licenseMappingLoading={false}
    />,
  )
  return { onSave }
}

const saveButton = () => screen.getByRole('button', { name: '저장' })

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Tests ───

describe('OssContributeModal 편집', () => {
  it('원본 값이 입력 필드에 채워진다', () => {
    renderModal(makeOssRow())

    expect(screen.getByLabelText('OSS Name')).toHaveValue('lodash')
    expect(screen.getByLabelText('Version')).toHaveValue('4.17.21')
    expect(screen.getByLabelText('Download Location')).toHaveValue(
      'https://github.com/lodash/lodash',
    )
  })

  it('값을 수정하고 저장하면 수정된 row가 onSave로 전달된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow())

    const version = screen.getByLabelText('Version')
    await user.clear(version)
    await user.type(version, '5.0.0')
    await user.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ ossName: 'lodash', version: '5.0.0' })
  })

  it('nullable 필드를 비우면 빈 문자열이 아니라 null로 전달된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow({ publisher: 'Some Publisher' }))

    await user.clear(screen.getByLabelText('Publisher'))
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].publisher).toBeNull()
  })

  it('원본을 변경하지 않는다 (불변성)', async () => {
    const user = userEvent.setup()
    const row = makeOssRow()
    const { onSave } = renderModal(row)

    await user.clear(screen.getByLabelText('Version'))
    await user.type(screen.getByLabelText('Version'), '9.9.9')
    await user.click(saveButton())

    expect(row.version).toBe('4.17.21')
    expect(onSave.mock.calls[0][0]).not.toBe(row)
  })

  it('필수 항목을 비우면 저장이 잠기고, 다시 채우면 열린다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow())

    const download = screen.getByLabelText('Download Location')
    await user.clear(download)
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText(/Download location은 필수 항목입니다\./)).toBeInTheDocument()

    await user.type(download, 'https://github.com/lodash/lodash')
    expect(saveButton()).toBeEnabled()
  })

  it('검증 힌트가 초안 기준으로 다시 계산된다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow({ version: '1.0.0' }))

    expect(screen.queryByText(/v\/V\/ver 접두사를 제거해주세요\./)).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Version'))
    await user.type(screen.getByLabelText('Version'), 'v1.0.0')

    expect(screen.getByText(/v\/V\/ver 접두사를 제거해주세요\./)).toBeInTheDocument()
  })

  it('Declared License를 수정하면 매핑 배지가 갱신된다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow())

    expect(screen.getByText('#1')).toBeInTheDocument()

    const declared = screen.getByLabelText('Declared License')
    await user.clear(declared)
    await user.type(declared, 'Unknown-License')

    expect(screen.queryByText('#1')).not.toBeInTheDocument()
    expect(screen.getByText(/매핑되지 않은 License: Unknown-License/)).toBeInTheDocument()
  })

  it('원래대로를 누르면 편집 내용이 원본으로 되돌아간다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow())

    await user.clear(screen.getByLabelText('Version'))
    await user.type(screen.getByLabelText('Version'), '9.9.9')
    expect(screen.getByLabelText('Version')).toHaveValue('9.9.9')

    await user.click(screen.getByRole('button', { name: '원래대로' }))
    expect(screen.getByLabelText('Version')).toHaveValue('4.17.21')
  })

  it('추가 정보를 펼치면 전송되지만 숨겨져 있던 필드를 편집할 수 있다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow())

    expect(screen.queryByLabelText('Attribution')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /추가 정보/ }))
    await user.type(screen.getByLabelText('Attribution'), 'Copyright notice')
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].attribution).toBe('Copyright notice')
  })
})
