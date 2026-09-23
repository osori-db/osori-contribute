import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OssContributeModal from './OssContributeModal'
import type { OsoriLicense } from '@/lib/osori-types'
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

/**
 * 검색 컨트롤이 고를 수 있는 마스터 목록.
 * 이름에 쉼표가 든 실제 마스터 항목(SSPL)을 넣어 직렬화 왕복까지 모달 레벨에서 확인한다.
 */
const LICENSES: readonly OsoriLicense[] = [
  lic(1, 'MIT', 'MIT'),
  lic(2, 'Apache-2.0', 'Apache-2.0'),
  lic(3, 'Server Side Public License, v 1', 'SSPL-1.0'),
]

const licenseMap = new Map<string, number>(LICENSES.map((l) => [l.name.toLowerCase(), l.id]))

/** OSORI 마스터에 등록된 라이선스. licenseMap 과 같은 집합을 본다. */
const isRegisteredLicense = (name: string) => licenseMap.has(name.trim().toLowerCase())

interface RenderOptions {
  readonly isRegistered?: (name: string) => boolean
  readonly licenses?: readonly OsoriLicense[]
  readonly licenseMappingLoading?: boolean
}

function renderModal(row: OssRow, options: RenderOptions = {}) {
  const onSave = vi.fn()
  render(
    <OssContributeModal
      open
      onClose={vi.fn()}
      row={row}
      onSave={onSave}
      saving={false}
      licenseMap={licenseMap}
      licenses={options.licenses ?? LICENSES}
      licenseMappingLoading={options.licenseMappingLoading ?? false}
      isRegisteredLicense={options.isRegistered ?? isRegisteredLicense}
    />,
  )
  return { onSave }
}

const saveButton = () => screen.getByRole('button', { name: '저장' })
const declaredCombobox = () => screen.getByRole('combobox', { name: 'Declared License' })

/** 검색 → 디바운스 대기 → 옵션 클릭. 자유 입력 경로가 없으므로 추가는 항상 이 흐름이다. */
async function pickLicense(
  user: ReturnType<typeof userEvent.setup>,
  combobox: HTMLElement,
  query: string,
  optionName: string,
) {
  await user.type(combobox, query)
  const option = await screen.findByRole('option', { name: new RegExp(optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
  await user.click(option)
}

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

  // textarea 자유 입력이 사라졌으므로 "배지 제거 → 검색 → 옵션 선택" 흐름으로 바꿨다.
  it('Declared License 배지를 제거하고 다시 고르면 매핑 배지가 갱신된다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow())

    expect(screen.getByText('#1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'MIT 제거' }))
    expect(screen.queryByText('#1')).not.toBeInTheDocument()

    await pickLicense(user, declaredCombobox(), 'Apache', 'Apache-2.0')

    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.queryByText(/매핑되지 않은 License/)).not.toBeInTheDocument()
  })

  it('엑셀에서 온 미등록 이름은 자동 삭제되지 않고 경고와 함께 남는다', () => {
    renderModal(makeOssRow({ declaredLicenseList: 'Unknown-License' }))

    expect(screen.getByText('Unknown-License')).toBeInTheDocument()
    expect(screen.getByText(/매핑되지 않은 License: Unknown-License/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unknown-License 제거' })).toBeInTheDocument()
  })

  it('반대편 필드에 선택된 라이선스는 검색 결과에 보이되 고를 수 없다 (규칙 6 선제 차단)', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: null }))

    const detected = screen.getByRole('combobox', { name: 'Detected License' })
    await user.type(detected, 'MIT')

    const option = await screen.findByRole('option', { name: /MIT/ })
    expect(option).toHaveAttribute('aria-disabled', 'true')
    expect(option).toHaveTextContent('declared에 이미 선택됨')
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

// 경로 1: 모달 개별 저장에도 사전 검증 규칙이 걸린다.
describe('OssContributeModal 사전 검증 규칙', () => {
  it('규칙 2 — 스킴 없는 Download Location 은 저장을 막는다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow())

    const download = screen.getByLabelText('Download Location')
    await user.clear(download)
    await user.type(download, 'github.com/lodash/lodash')

    expect(
      screen.getByText(/Download location은 http\/https URL이어야 합니다\./),
    ).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('규칙 4 — 미등록 라이선스는 저장을 막는다', () => {
    renderModal(makeOssRow({ declaredLicenseList: 'MIT, FooBar-1.0' }))

    expect(
      screen.getByText(/OSORI에 등록되지 않은 라이선스입니다: FooBar-1\.0/),
    ).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('규칙 6 — declared 와 detected 중복은 저장을 막는다 (대소문자·공백 무시)', () => {
    renderModal(makeOssRow({ declaredLicenseList: 'MIT', detectedLicenseList: 'mit ' }))

    expect(
      screen.getAllByText(/declared와 detected에 같은 라이선스가 중복 등록되었습니다: MIT/),
    ).toHaveLength(2)
    expect(saveButton()).toBeDisabled()
  })

  it('규칙 5 — git hash version 은 저장을 막는다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow())

    await user.clear(screen.getByLabelText('Version'))
    await user.type(screen.getByLabelText('Version'), 'a1b2c3d')

    expect(screen.getByText(/Git hash 값은 버전으로 사용할 수 없습니다\./)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  // R6: 미등록 배지가 남아 있으면 저장이 막힌 채로 유지되고, 제거해야 열린다.
  it('규칙 4 위반 배지를 제거하고 등록된 라이선스를 고르면 저장이 다시 열린다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow({ declaredLicenseList: 'FooBar-1.0' }))

    expect(saveButton()).toBeDisabled()

    // 등록된 이름을 추가해도 미등록 배지가 남아 있는 한 저장은 계속 막혀 있다.
    await pickLicense(user, declaredCombobox(), 'MIT', 'MIT')
    expect(saveButton()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'FooBar-1.0 제거' }))

    expect(saveButton()).toBeEnabled()
  })

  it('미등록 배지만 제거해도 저장이 열린다', async () => {
    const user = userEvent.setup()
    renderModal(makeOssRow({ declaredLicenseList: 'MIT\nFooBar-1.0', licenseCombination: 'AND' }))

    expect(saveButton()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'FooBar-1.0 제거' }))

    expect(saveButton()).toBeEnabled()
  })

  it('URL 접속 검사는 모달에서 수행하지 않는다 (오프라인 규칙만)', () => {
    renderModal(makeOssRow({ downloadLocation: 'https://github.com/lodash/lodash' }))

    expect(screen.queryByText(/URL에 접속할 수 없습니다/)).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  it('downloadLocationList 후보 URL 아래에 힌트 자리를 둔다', () => {
    renderModal(
      makeOssRow({
        downloadLocation: 'https://npmjs.com/package/lodash',
        downloadLocationList: 'https://github.com/lodash/lodash',
      }),
    )

    // 대표 URL 이 GitHub 이 아닐 때의 권고 힌트는 downloadLocation 필드에 붙는다.
    expect(screen.getByText(/GitHub repository를 대표 URL로 권장합니다\./)).toBeInTheDocument()
  })
})

describe('OssContributeModal 추가 정보', () => {
  it('펼친 필드를 편집하면 저장 시 함께 전달된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow())

    expect(screen.queryByLabelText('Attribution')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /추가 정보/ }))
    await user.type(screen.getByLabelText('Attribution'), 'Copyright notice')
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].attribution).toBe('Copyright notice')
  })
})

// ─── 제약 A: 선택 결과의 직렬화 형식 ───

describe('OssContributeModal 라이선스 직렬화', () => {
  it('여러 건을 고르면 쉼표가 아니라 줄바꿈으로 이어 저장한다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(
      makeOssRow({ declaredLicenseList: null, licenseCombination: 'AND' }),
    )

    await pickLicense(user, declaredCombobox(), 'MIT', 'MIT')
    await pickLicense(user, declaredCombobox(), 'Apache', 'Apache-2.0')
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].declaredLicenseList).toBe('MIT\nApache-2.0')
  })

  it('이름에 쉼표가 든 라이선스를 단독으로 고르면 후행 줄바꿈으로 구분자 모드를 고정한다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow({ declaredLicenseList: null }))

    await pickLicense(user, declaredCombobox(), 'Server Side', 'Server Side Public License, v 1')

    // 쪼개지지 않고 배지 하나로 남는다 — 쪼개졌다면 미등록 배지 2개가 되어 저장이 막힌다.
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.queryByText(/매핑되지 않은 License/)).not.toBeInTheDocument()

    await user.click(saveButton())
    expect(onSave.mock.calls[0][0].declaredLicenseList).toBe('Server Side Public License, v 1\n')
  })

  it('쉼표가 든 이름을 다른 이름과 함께 골라도 각각 한 건으로 유지된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(
      makeOssRow({ declaredLicenseList: null, licenseCombination: 'OR' }),
    )

    await pickLicense(user, declaredCombobox(), 'Server Side', 'Server Side Public License, v 1')
    await pickLicense(user, declaredCombobox(), 'MIT', 'MIT')

    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()

    await user.click(saveButton())
    expect(onSave.mock.calls[0][0].declaredLicenseList).toBe(
      'Server Side Public License, v 1\nMIT',
    )
  })

  it('마지막 배지를 제거하면 빈 문자열이 아니라 null 로 저장된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow({ detectedLicenseList: 'Apache-2.0' }))

    await user.click(screen.getByRole('button', { name: 'Apache-2.0 제거' }))
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].detectedLicenseList).toBeNull()
  })
})

// ─── §3.5: 마스터 목록을 못 쓰는 상태 ───

describe('OssContributeModal 마스터 목록 부재', () => {
  it('로딩 중에는 검색이 막히고 저장 버튼이 "매핑 중..." 으로 잠긴다', () => {
    renderModal(makeOssRow(), { licenses: [], licenseMappingLoading: true })

    expect(declaredCombobox()).toBeDisabled()
    expect(screen.getByRole('button', { name: '매핑 중...' })).toBeDisabled()
  })

  it('조회 실패로 목록이 비어도 배지 제거는 가능하다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow({ detectedLicenseList: 'Apache-2.0' }), {
      licenses: [],
    })

    expect(declaredCombobox()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Apache-2.0 제거' }))
    await user.click(saveButton())

    expect(onSave.mock.calls[0][0].detectedLicenseList).toBeNull()
  })
})

/**
 * License Combination 은 AND / OR 둘 중 하나이거나 비어 있다(실데이터 3835행 기준
 * AND 57 · OR 52 · 빈 값 3726). 자유 입력이면 오타가 그대로 전송되므로 라디오로 고정한다.
 *
 * 라디오는 스스로 해제할 수 없어서 "선택 안 함" 을 선택지로 둔다. 이게 없으면 한 번 고른 뒤
 * 다시 비울 수 없는데, Declared License 가 하나뿐인 대다수 행에서는 비어 있는 것이 정상이다.
 */
describe('OssContributeModal License Combination 라디오', () => {
  const combinationRadio = (name: string) => screen.getByRole('radio', { name })

  it('선택 안 함 / AND / OR 세 가지를 라디오로 제공한다', () => {
    renderModal(makeOssRow({ licenseCombination: null }))

    expect(screen.getByRole('radiogroup', { name: 'License Combination' })).toBeInTheDocument()
    expect(combinationRadio('선택 안 함')).toBeChecked()
    expect(combinationRadio('AND')).not.toBeChecked()
    expect(combinationRadio('OR')).not.toBeChecked()
  })

  it('기존 값이 있으면 해당 라디오가 선택된 상태로 열린다', () => {
    renderModal(makeOssRow({ licenseCombination: 'OR' }))

    expect(combinationRadio('OR')).toBeChecked()
    expect(combinationRadio('선택 안 함')).not.toBeChecked()
  })

  it('AND 를 고르면 그 값이 저장된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow({ licenseCombination: null }))

    await user.click(combinationRadio('AND'))
    await user.click(saveButton())

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ licenseCombination: 'AND' }))
  })

  it('선택 안 함 으로 되돌리면 null 이 전달된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderModal(makeOssRow({ licenseCombination: 'AND' }))

    await user.click(combinationRadio('선택 안 함'))
    await user.click(saveButton())

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ licenseCombination: null }))
  })

  it('자유 입력 칸은 사라진다', () => {
    renderModal(makeOssRow({ licenseCombination: 'AND' }))

    expect(screen.queryByRole('textbox', { name: 'License Combination' })).not.toBeInTheDocument()
  })

  it('앞뒤 공백이 있는 값도 해당 라디오로 인식한다', () => {
    renderModal(makeOssRow({ licenseCombination: '  AND  ' }))

    expect(combinationRadio('AND')).toBeChecked()
  })

  it('AND/OR 가 아닌 엑셀 값은 지우지 않고 선택지로 남긴다', () => {
    // 조용히 null 로 만들면 사용자는 엑셀에 뭐가 적혀 있었는지 알 수 없다.
    renderModal(makeOssRow({ licenseCombination: 'and/or' }))

    expect(combinationRadio('and/or (엑셀 값)')).toBeChecked()
    expect(combinationRadio('AND')).not.toBeChecked()
  })

  it('Declared License 가 2개인데 선택 안 함 이면 규칙 5 로 저장이 막힌다', () => {
    renderModal(
      makeOssRow({ declaredLicenseList: 'MIT License\nApache License 2.0', licenseCombination: null }),
    )

    expect(saveButton()).toBeDisabled()
    expect(screen.getByText(/AND 또는 OR를 지정해주세요/)).toBeInTheDocument()
  })
})
