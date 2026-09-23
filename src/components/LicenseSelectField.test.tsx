import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LicenseSelectField, { type LicenseSelectFieldProps } from './LicenseSelectField'
import Modal from './Modal'
import type { OsoriLicense } from '@/lib/osori-types'

// ─── Helpers ───

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

/** 빈 검색어에서 이름 사전순으로 A → B → C 순서가 되도록 고른 픽스처. */
const LICENSES: readonly OsoriLicense[] = [
  lic(1, 'AAA License', 'AAA'),
  lic(2, 'BBB License', 'BBB'),
  lic(3, 'CCC License', 'CCC'),
  lic(4, 'Server Side Public License, v 1', 'SSPL-1.0'),
]

const LICENSE_IDS = new Map(LICENSES.map((l) => [l.name.toLowerCase(), l.id]))
const lookupLicenseId = (name: string) => LICENSE_IDS.get(name.trim().toLowerCase()) ?? null

function renderField(overrides: Partial<LicenseSelectFieldProps> = {}) {
  const onChange = vi.fn()
  const props: LicenseSelectFieldProps = {
    id: 'declared',
    label: 'Declared License',
    selected: [],
    counterpartSelected: [],
    counterpartLabel: 'detected',
    licenses: LICENSES,
    lookupLicenseId,
    registryLoading: false,
    disabled: false,
    onChange,
    ...overrides,
  }
  const view = render(<LicenseSelectField {...props} />)
  return { ...view, onChange, props }
}

const combobox = () => screen.getByRole('combobox', { name: 'Declared License' })
const options = () => screen.getAllByRole('option')

/** 디바운스(150ms) 뒤 목록이 그려질 때까지 기다린다. */
async function waitForOptions(count: number) {
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(count))
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── 정상 경로 ───

describe('LicenseSelectField 검색과 선택', () => {
  it('포커스하면 마스터 목록 전건이 이름 사전순으로 열린다', async () => {
    const user = userEvent.setup()
    renderField()

    await user.click(combobox())

    await waitForOptions(4)
    expect(options().map((o) => o.textContent)).toEqual([
      'AAA LicenseAAA',
      'BBB LicenseBBB',
      'CCC LicenseCCC',
      'Server Side Public License, v 1SSPL-1.0',
    ])
    expect(screen.getByText('4건')).toBeInTheDocument()
  })

  it('검색어를 치면 결과가 좁혀진다', async () => {
    const user = userEvent.setup()
    renderField()

    await user.type(combobox(), 'BBB')

    await waitForOptions(1)
    expect(options()[0]).toHaveTextContent('BBB License')
  })

  it('옵션을 클릭하면 onChange 가 새 배열로 호출된다', async () => {
    const user = userEvent.setup()
    const selected = ['AAA License']
    const { onChange } = renderField({ selected })

    await user.type(combobox(), 'CCC')
    await waitForOptions(1)
    await user.click(options()[0])

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toEqual(['AAA License', 'CCC License'])
    // 원본 배열은 그대로다 (불변성).
    expect(selected).toEqual(['AAA License'])
    expect(onChange.mock.calls[0][0]).not.toBe(selected)
  })

  it('선택 직후 입력이 비워지고 목록은 열려 있다 (연속 선택)', async () => {
    const user = userEvent.setup()
    renderField()

    await user.type(combobox(), 'CCC')
    await waitForOptions(1)
    await user.click(options()[0])

    expect(combobox()).toHaveValue('')
    await waitForOptions(4)
  })

  it('선택된 이름을 배지로 보여주고 #id 를 붙인다', () => {
    renderField({ selected: ['AAA License', 'CCC License'] })

    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
  })
})

// ─── 경계값 ───

describe('LicenseSelectField 경계 상태', () => {
  it('선택이 없으면 배지 영역과 제거 버튼이 없다', () => {
    renderField({ selected: [] })

    expect(screen.queryByRole('button', { name: /제거$/ })).not.toBeInTheDocument()
  })

  it('검색 결과가 0건이면 안내 문구를 띄운다', async () => {
    const user = userEvent.setup()
    renderField()

    await user.type(combobox(), 'zzz-no-such-license')

    await waitFor(() => expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument())
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('마스터 목록이 비어 있으면 검색 입력이 비활성이고 안내 placeholder 가 뜬다', () => {
    renderField({ licenses: [], selected: ['Unknown-License'] })

    expect(combobox()).toBeDisabled()
    expect(combobox()).toHaveAttribute('placeholder', '라이선스 목록을 불러오지 못했습니다')
  })

  it('마스터 목록이 비어 있어도 기존 배지는 보이고 제거할 수 있다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ licenses: [], selected: ['Unknown-License'] })

    expect(screen.getByText('Unknown-License')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unknown-License 제거' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('로딩 중에는 검색이 막히고 배지 id 자리를 ... 로 둔다', () => {
    renderField({ registryLoading: true, selected: ['AAA License'] })

    expect(combobox()).toBeDisabled()
    expect(combobox()).toHaveAttribute('placeholder', '라이선스 목록을 불러오는 중입니다')
    expect(screen.getByText('...')).toBeInTheDocument()
    expect(screen.queryByText('#1')).not.toBeInTheDocument()
  })

  it('로딩 중에도 배지 제거는 허용한다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ registryLoading: true, selected: ['AAA License'] })

    await user.click(screen.getByRole('button', { name: 'AAA License 제거' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('disabled 면 검색도 제거도 막힌다', () => {
    renderField({ disabled: true, selected: ['AAA License'] })

    expect(combobox()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'AAA License 제거' })).toBeDisabled()
  })

  it('같은 이름이 두 번 들어 있어도 클릭한 위치 하나만 제거한다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ selected: ['AAA License', 'BBB License', 'AAA License'] })

    const removeButtons = screen.getAllByRole('button', { name: 'AAA License 제거' })
    await user.click(removeButtons[1])

    expect(onChange).toHaveBeenCalledWith(['AAA License', 'BBB License'])
  })
})

// ─── 미등록 이름 (요구사항 4) ───

describe('LicenseSelectField 미등록 배지', () => {
  it('마스터에 없는 이름도 지우지 않고 경고 배지로 남긴다', () => {
    renderField({ selected: ['FooBar-1.0'] })

    const badge = screen.getByText('FooBar-1.0').closest('span')
    expect(badge).toHaveAttribute('title', 'OSORI에 등록되지 않은 이름입니다')
    expect(within(badge as HTMLElement).getByText('?')).toBeInTheDocument()
  })

  it('미등록 배지는 제거 버튼으로만 사라진다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ selected: ['FooBar-1.0', 'AAA License'] })

    await user.click(screen.getByRole('button', { name: 'FooBar-1.0 제거' }))

    expect(onChange).toHaveBeenCalledWith(['AAA License'])
  })
})

// ─── 실패·차단 경로 ───

describe('LicenseSelectField 선택 차단', () => {
  it('반대편 필드에 선택된 항목은 보이되 비활성이고 사유가 붙는다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ counterpartSelected: ['BBB License'] })

    await user.click(combobox())
    await waitForOptions(4)

    const blocked = options()[1]
    expect(blocked).toHaveTextContent('BBB License')
    expect(blocked).toHaveAttribute('aria-disabled', 'true')
    expect(blocked).toHaveTextContent('detected에 이미 선택됨')

    await user.click(blocked)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('같은 필드에 이미 선택된 항목은 사유 문구가 다르다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ selected: ['BBB License'] })

    await user.click(combobox())
    await waitForOptions(4)

    const blocked = options()[1]
    expect(blocked).toHaveAttribute('aria-disabled', 'true')
    expect(blocked).toHaveTextContent('이미 선택됨')
    expect(blocked).not.toHaveTextContent('detected에 이미 선택됨')

    await user.click(blocked)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('마스터에 없는 문자열은 Enter 로도 추가되지 않는다 (자유 입력 경로 없음)', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField()

    await user.type(combobox(), 'Totally-Made-Up-License')
    await waitFor(() => expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument())
    await user.keyboard('{Enter}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('검색어와 부분 일치하는 항목이 있어도 입력한 문자열 자체는 추가되지 않는다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField()

    await user.type(combobox(), 'AAA Licen')
    await waitForOptions(1)
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith(['AAA License'])
  })
})

// ─── 키보드 ───

describe('LicenseSelectField 키보드 조작', () => {
  it('ArrowDown 으로 내려가 Enter 로 선택한다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField()

    await user.click(combobox())
    await waitForOptions(4)
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith(['BBB License'])
  })

  it('ArrowUp 으로 올라간다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField()

    await user.click(combobox())
    await waitForOptions(4)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}')

    expect(onChange).toHaveBeenCalledWith(['BBB License'])
  })

  it('ArrowDown 이 비활성 옵션을 건너뛴다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ counterpartSelected: ['BBB License'] })

    await user.click(combobox())
    await waitForOptions(4)
    // 활성 시작 위치는 0(AAA). 1(BBB)은 비활성이므로 2(CCC)로 건너뛴다.
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith(['CCC License'])
  })

  it('첫 활성 위치도 비활성 옵션을 건너뛴다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ counterpartSelected: ['AAA License'] })

    await user.click(combobox())
    await waitForOptions(4)
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith(['BBB License'])
  })

  it('끝에서 더 내려가도 순환하지 않는다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField()

    await user.click(combobox())
    await waitForOptions(4)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith(['Server Side Public License, v 1'])
  })

  it('입력이 비어 있을 때 Backspace 는 마지막 배지를 제거한다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ selected: ['AAA License', 'BBB License'] })

    await user.click(combobox())
    await user.keyboard('{Backspace}')

    expect(onChange).toHaveBeenCalledWith(['AAA License'])
  })

  it('입력에 글자가 있으면 Backspace 는 배지를 건드리지 않는다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ selected: ['AAA License'] })

    await user.type(combobox(), 'CC')
    await user.keyboard('{Backspace}')

    expect(onChange).not.toHaveBeenCalled()
    expect(combobox()).toHaveValue('C')
  })

  it('선택이 없으면 Backspace 가 아무 일도 하지 않는다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ selected: [] })

    await user.click(combobox())
    await user.keyboard('{Backspace}')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('Tab 을 누르면 목록이 닫힌다', async () => {
    const user = userEvent.setup()
    renderField()

    await user.click(combobox())
    await waitForOptions(4)
    await user.tab()

    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0))
  })
})

// ─── ARIA (제약 E) ───

describe('LicenseSelectField 접근성', () => {
  it('combobox 의 aria 속성이 열림 상태를 반영한다', async () => {
    const user = userEvent.setup()
    renderField()

    const input = combobox()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveAttribute('aria-controls', 'declared-listbox')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).not.toHaveAttribute('aria-activedescendant')

    await user.click(input)
    await waitForOptions(4)

    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', 'declared-option-0')
  })

  it('aria-activedescendant 가 활성 옵션 id 를 따라간다', async () => {
    const user = userEvent.setup()
    renderField()

    await user.click(combobox())
    await waitForOptions(4)
    await user.keyboard('{ArrowDown}')

    expect(combobox()).toHaveAttribute('aria-activedescendant', 'declared-option-1')
    expect(screen.getByRole('listbox')).toHaveAttribute('id', 'declared-listbox')
    expect(options()[1]).toHaveAttribute('id', 'declared-option-1')
  })

  it('hintField 키의 검증 힌트를 렌더한다', () => {
    renderField({
      hints: { declaredLicense: [{ status: 'fail', message: '테스트 힌트' }] },
      hintField: 'declaredLicense',
    })

    expect(screen.getByText('* 테스트 힌트')).toBeInTheDocument()
  })

  it('hintField 가 없으면 id 를 힌트 키로 쓴다', () => {
    renderField({ hints: { declared: [{ status: 'warn', message: 'id 기반 힌트' }] } })

    expect(screen.getByText('* id 기반 힌트')).toBeInTheDocument()
  })
})

// ─── R2: ESC 가 모달까지 전파되는지 ───

describe('LicenseSelectField 와 Modal 의 ESC 충돌 (R2)', () => {
  function renderInModal(onClose = vi.fn()) {
    const onChange = vi.fn()
    render(
      <Modal open onClose={onClose} title="OSS 기여하기">
        <LicenseSelectField
          id="declared"
          label="Declared License"
          selected={[]}
          counterpartSelected={[]}
          counterpartLabel="detected"
          licenses={LICENSES}
          lookupLicenseId={lookupLicenseId}
          registryLoading={false}
          disabled={false}
          onChange={onChange}
        />
      </Modal>,
    )
    return { onClose, onChange }
  }

  it('목록이 열린 상태의 ESC 는 목록만 닫고 모달을 닫지 않는다', async () => {
    const user = userEvent.setup()
    const { onClose } = renderInModal()

    await user.click(combobox())
    await waitForOptions(4)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('목록이 닫힌 상태의 ESC 는 모달을 닫는다', async () => {
    const user = userEvent.setup()
    const { onClose } = renderInModal()

    await user.click(combobox())
    await waitForOptions(4)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0))

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('컨트롤에 포커스가 없어도 ESC 는 모달을 닫는다', async () => {
    const user = userEvent.setup()
    const { onClose } = renderInModal()

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
