import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LicenseList from './LicenseList'
import type { LicenseRow } from '@/lib/types'

// ─── Mocks ───

const mockPush = vi.fn()
const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))

const mockToken = 'test-token'
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: mockToken }),
}))

const mockMapNamesToIds = vi.fn().mockReturnValue([26])
vi.mock('@/hooks/useRestrictions', () => ({
  useRestrictions: () => ({
    restrictions: [{ id: 26, name: 'Network Triggered', description: null, description_ko: null, level: 0, reviewed: 1 }],
    loading: false,
    error: null,
    mapNamesToIds: (...args: unknown[]) => mockMapNamesToIds(...args),
  }),
}))

const mockHasLicense = vi.fn().mockReturnValue(false)
vi.mock('@/hooks/useLicenseMapping', () => ({
  useLicenseMapping: () => ({
    licenses: [],
    licenseMap: new Map(),
    loading: false,
    error: null,
    mapNamesToIds: vi.fn().mockReturnValue([]),
    hasLicense: (...args: unknown[]) => mockHasLicense(...args),
  }),
}))

const mockFetchCreateLicense = vi.fn()
vi.mock('@/lib/api-client', () => ({
  fetchCreateLicense: (...args: unknown[]) => mockFetchCreateLicense(...args),
}))

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

beforeEach(() => {
  mockPush.mockReset()
  mockReplace.mockReset()
  mockSearchParams = new URLSearchParams()
  mockFetchCreateLicense.mockReset()
  mockMapNamesToIds.mockReturnValue([26])
  mockHasLicense.mockReturnValue(false)
})

// ─── Tests ───

describe('LicenseList 기여하기 흐름', () => {
  it('기여하기 클릭 시 사전 로드된 맵에 없으면 모달이 열린다', async () => {
    const user = userEvent.setup()
    mockHasLicense.mockReturnValue(false)

    render(<LicenseList rows={[makeLicenseRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    expect(contributeBtn).toBeDefined()

    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('라이선스 기여하기')).toBeInTheDocument()
    })

    // hasLicense가 SPDX로 호출됨
    expect(mockHasLicense).toHaveBeenCalledWith('Apache-2.0')
  })

  it('기여하기 클릭 시 사전 로드된 맵에 이미 존재하면 모달 없이 "이미 존재함" 표시', async () => {
    const user = userEvent.setup()
    mockHasLicense.mockReturnValue(true)

    render(<LicenseList rows={[makeLicenseRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    // "이미 존재함" 표시
    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    // 모달이 열리지 않음
    expect(screen.queryByText('라이선스 기여하기')).not.toBeInTheDocument()

    // 생성 API는 호출되지 않음
    expect(mockFetchCreateLicense).not.toHaveBeenCalled()
  })

  it('맵에 없으면 모달에서 생성 API를 호출한다', async () => {
    const user = userEvent.setup()
    mockHasLicense.mockReturnValue(false)
    mockFetchCreateLicense.mockResolvedValue({ success: true, data: { id: 200, message: 'created' } })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 기여하기 클릭 → 미존재 → 모달 열림
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('라이선스 기여하기')).toBeInTheDocument()
    })

    // 저장 클릭
    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockFetchCreateLicense).toHaveBeenCalledTimes(1)
    })

    // 생성 요청에 restriction ID 매핑이 포함됨
    const createArgs = mockFetchCreateLicense.mock.calls[0]
    expect(createArgs[0]).toBe(mockToken)
    expect(createArgs[1].name).toBe('Apache License 2.0')
    expect(createArgs[1].restrictionList).toEqual([26])
  })

  it('생성 API 실패 시 모달에 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup()
    mockHasLicense.mockReturnValue(false)
    mockFetchCreateLicense.mockResolvedValue({
      success: false,
      error: '중복된 라이선스입니다.',
    })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 모달 열기
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('라이선스 기여하기')).toBeInTheDocument()
    })

    // 저장 클릭
    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    // 에러 메시지가 모달에 표시됨
    await waitFor(() => {
      expect(screen.getByText('중복된 라이선스입니다.')).toBeInTheDocument()
    })

    // 모달이 닫히지 않음 (에러 상태)
    expect(screen.getByText('라이선스 기여하기')).toBeInTheDocument()
  })

  it('API 예외 발생 시 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup()
    mockHasLicense.mockReturnValue(false)
    mockFetchCreateLicense.mockRejectedValue(new Error('Network timeout'))

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 모달 열기
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('라이선스 기여하기')).toBeInTheDocument()
    })

    // 저장 클릭
    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeInTheDocument()
    })
  })

  it('SPDX Identifier가 없으면 저장 버튼이 비활성화된다', async () => {
    const user = userEvent.setup()

    const row = makeLicenseRow({ spdxIdentifier: '' })
    render(<LicenseList rows={[row]} />)

    // SPDX가 없으면 조회 없이 바로 모달 열림
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    // 모달에 검증 에러 메시지 표시
    expect(screen.getByText(/SPDX Identifier는 필수 항목입니다/)).toBeInTheDocument()

    // 저장 버튼이 비활성화됨
    const saveBtn = screen.getByText('저장')
    expect(saveBtn).toBeDisabled()

    // API가 호출되지 않음
    expect(mockFetchCreateLicense).not.toHaveBeenCalled()
  })

  it('취소 버튼 클릭 시 모달이 닫히고 에러가 초기화된다', async () => {
    const user = userEvent.setup()
    mockHasLicense.mockReturnValue(false)
    mockFetchCreateLicense.mockResolvedValue({ success: false, error: '실패' })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 모달 열기
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('라이선스 기여하기')).toBeInTheDocument()
    })

    // 저장 → 실패
    await user.click(screen.getByText('저장'))
    await waitFor(() => {
      expect(screen.getByText('실패')).toBeInTheDocument()
    })

    // 취소 클릭
    await user.click(screen.getByText('취소'))

    // 모달이 닫힘
    await waitFor(() => {
      expect(screen.queryByText('라이선스 기여하기')).not.toBeInTheDocument()
    })
  })
})

describe('LicenseList 수정된 행 표시', () => {
  async function openModal(user: ReturnType<typeof userEvent.setup>) {
    const contributeBtn = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)
    await waitFor(() => {
      expect(screen.getByText('라이선스 기여하기')).toBeInTheDocument()
    })
  }

  it('모달에서 값을 바꿔 저장하면 해당 행에 수정됨 표시가 붙는다', async () => {
    const user = userEvent.setup()
    mockFetchCreateLicense.mockResolvedValue({ success: true, data: { id: 200, message: 'created' } })

    render(<LicenseList rows={[makeLicenseRow()]} />)
    expect(screen.queryByText('수정됨')).not.toBeInTheDocument()

    await openModal(user)
    const spdx = screen.getByLabelText('SPDX Identifier')
    await user.clear(spdx)
    await user.type(spdx, 'MIT')
    await user.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(screen.getByText('수정됨')).toBeInTheDocument()
    })
    expect(screen.getByText('수정됨')).toHaveAttribute(
      'title',
      '수정된 항목: SPDX Identifier',
    )
  })

  it('아무것도 바꾸지 않고 저장하면 수정됨 표시가 붙지 않는다', async () => {
    const user = userEvent.setup()
    mockFetchCreateLicense.mockResolvedValue({ success: true, data: { id: 200, message: 'created' } })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    await openModal(user)
    await user.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(screen.getByText('완료')).toBeInTheDocument()
    })
    expect(screen.queryByText('수정됨')).not.toBeInTheDocument()
  })

  it('수정된 값이 생성 API 요청에 반영된다', async () => {
    const user = userEvent.setup()
    mockFetchCreateLicense.mockResolvedValue({ success: true, data: { id: 200, message: 'created' } })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    await openModal(user)
    const webpage = screen.getByLabelText('Webpage')
    await user.clear(webpage)
    await user.type(webpage, 'https://opensource.org/license/mit')
    await user.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(mockFetchCreateLicense).toHaveBeenCalled()
    })
    expect(mockFetchCreateLicense.mock.calls[0][1]).toMatchObject({
      webpage: 'https://opensource.org/license/mit',
    })
  })

  it('저장에 실패해도 수정본이 유지되어 수정됨 표시가 남는다', async () => {
    const user = userEvent.setup()
    mockFetchCreateLicense.mockResolvedValue({ success: false, error: '실패' })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    await openModal(user)
    const spdx = screen.getByLabelText('SPDX Identifier')
    await user.clear(spdx)
    await user.type(spdx, 'MIT')
    await user.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(screen.getByText('실패')).toBeInTheDocument()
    })
    await user.click(screen.getByText('취소'))

    await waitFor(() => {
      expect(screen.getByText('수정됨')).toBeInTheDocument()
    })
  })
})

describe('LicenseList 검색', () => {
  function makeNamedRows(...names: string[]): LicenseRow[] {
    return names.map((licenseName, i) =>
      makeLicenseRow({ no: i + 1, licenseName, spdxIdentifier: `SPDX-${i + 1}` }),
    )
  }

  it('q 파라미터로 목록을 걸러낸다', () => {
    mockSearchParams = new URLSearchParams('q=mit')
    render(<LicenseList rows={makeNamedRows('Apache License 2.0', 'MIT License', 'GPL-3.0')} />)

    expect(screen.getByText('MIT License')).toBeInTheDocument()
    expect(screen.queryByText('Apache License 2.0')).not.toBeInTheDocument()
    expect(screen.queryByText('GPL-3.0')).not.toBeInTheDocument()
  })

  it('검색어를 입력하면 URL에 q 파라미터를 남긴다', async () => {
    const user = userEvent.setup()
    render(<LicenseList rows={makeNamedRows('MIT License')} />)

    await user.type(screen.getByLabelText('License Name 검색'), 'mit')

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('?q=mit', { scroll: false })
    })
  })

  it('검색 결과 개수를 표시하고 배치 버튼 문구가 바뀐다', () => {
    mockSearchParams = new URLSearchParams('q=License')
    render(<LicenseList rows={makeNamedRows('Apache License 2.0', 'MIT License', 'GPL-3.0')} />)

    expect(screen.getByText('2건')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '검색 결과 기여 (2건)' })).toBeInTheDocument()
  })
})

describe('LicenseList 테이블 구성', () => {
  it('작업 컬럼은 가로 스크롤과 무관하게 고정된다', () => {
    render(<LicenseList rows={[makeLicenseRow()]} />)

    const actionHeader = screen.getByRole('columnheader', { name: '작업' })
    expect(actionHeader.className).toContain('sticky')

    const actionCell = screen.getByRole('button', { name: '기여하기' }).closest('td')
    expect(actionCell?.className).toContain('sticky')
    // 고정 셀에 opacity가 걸리면 뒤 내용이 비쳐 보이므로 흐림은 데이터 셀에만 적용한다
    expect(actionCell?.className).not.toContain('opacity')
  })

  it('처리가 끝난 행은 데이터 셀만 흐려지고 작업 셀은 선명하다', async () => {
    const user = userEvent.setup()
    mockHasLicense.mockReturnValue(true)

    render(<LicenseList rows={[makeLicenseRow()]} />)
    await user.click(screen.getByRole('button', { name: '기여하기' }))

    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    const cells = document.querySelectorAll('tbody tr td')
    expect(cells[0].className).toContain('opacity-40')
    expect(cells[cells.length - 1].className).not.toContain('opacity-40')
  })
})

describe('LicenseList Webpage 링크', () => {
  it('Webpage를 새 탭 링크로 렌더한다', () => {
    render(
      <LicenseList rows={[makeLicenseRow({ webpage: 'https://opensource.org/license/mit' })]} />,
    )

    const link = screen.getByRole('link', { name: 'https://opensource.org/license/mit' })
    expect(link).toHaveAttribute('href', 'https://opensource.org/license/mit')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('webpageList의 추가 URL도 링크로 렌더한다', () => {
    render(
      <LicenseList
        rows={[
          makeLicenseRow({
            webpage: 'https://opensource.org/license/mit',
            webpageList: 'https://spdx.org/licenses/MIT.html, https://mit-license.org',
          }),
        ]}
      />,
    )

    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'https://mit-license.org' })).toBeInTheDocument()
  })

  it('http(s)가 아닌 Webpage는 링크로 만들지 않는다', () => {
    render(<LicenseList rows={[makeLicenseRow({ webpage: 'javascript:alert(1)' })]} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
  })
})

describe('LicenseList 페이지당 표시 개수', () => {
  function makeRows(count: number): LicenseRow[] {
    return Array.from({ length: count }, (_, i) =>
      makeLicenseRow({ no: i + 1, licenseName: `lic-${i + 1}`, spdxIdentifier: `SPDX-${i + 1}` }),
    )
  }

  const sizeSelect = () => screen.getByLabelText('페이지당 표시 개수')

  it('size 파라미터만큼 표시한다', () => {
    mockSearchParams = new URLSearchParams('size=50')
    render(<LicenseList rows={makeRows(60)} />)

    expect(sizeSelect()).toHaveValue('50')
    expect(screen.getByText('lic-50')).toBeInTheDocument()
    expect(screen.queryByText('lic-51')).not.toBeInTheDocument()
  })

  it('개수를 바꾸면 size 파라미터를 남긴다', async () => {
    const user = userEvent.setup()
    render(<LicenseList rows={makeRows(60)} />)

    await user.selectOptions(sizeSelect(), '50')

    expect(mockReplace).toHaveBeenCalledWith('?size=50', { scroll: false })
  })

  it('tab 등 다른 파라미터는 유지한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('tab=license')
    render(<LicenseList rows={makeRows(60)} />)

    await user.selectOptions(sizeSelect(), '100')

    expect(mockReplace).toHaveBeenCalledWith('?tab=license&size=100', { scroll: false })
  })
})
