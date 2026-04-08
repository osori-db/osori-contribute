import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LicenseList from './LicenseList'
import type { LicenseRow } from '@/lib/types'

// ─── Mocks ───

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
