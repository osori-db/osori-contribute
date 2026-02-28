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

const mockFetchLicenses = vi.fn()
const mockFetchCreateLicense = vi.fn()
vi.mock('@/lib/api-client', () => ({
  fetchLicenses: (...args: unknown[]) => mockFetchLicenses(...args),
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
  mockFetchLicenses.mockReset()
  mockFetchCreateLicense.mockReset()
  mockMapNamesToIds.mockReturnValue([26])
})

// ─── Tests ───

describe('LicenseList 기여하기 흐름', () => {
  it('기여하기 버튼 클릭 시 모달이 열린다', async () => {
    const user = userEvent.setup()
    render(<LicenseList rows={[makeLicenseRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    expect(contributeBtn).toBeDefined()

    await user.click(contributeBtn!)
    expect(screen.getByText('라이선스 기여하기')).toBeInTheDocument()
  })

  it('SPDX 조회 → 이미 존재하면 생성 API를 호출하지 않고 성공 처리한다', async () => {
    const user = userEvent.setup()
    mockFetchLicenses.mockResolvedValue({
      success: true,
      data: [{ id: 100, name: 'Apache License 2.0' }],
    })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 모달 열기
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    // 저장 클릭
    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      // fetchLicenses가 SPDX로 호출됨
      expect(mockFetchLicenses).toHaveBeenCalledWith(
        mockToken, '', 0, 1, true, 'Apache-2.0',
      )
    })

    // 이미 존재하므로 createLicense는 호출되지 않음
    expect(mockFetchCreateLicense).not.toHaveBeenCalled()
  })

  it('SPDX 조회 → 없으면 생성 API를 호출한다', async () => {
    const user = userEvent.setup()
    mockFetchLicenses.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateLicense.mockResolvedValue({ success: true, data: { id: 200, message: 'created' } })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 모달 열기
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    // 저장 클릭
    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      // 조회 후 생성 API가 호출됨
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
    mockFetchLicenses.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateLicense.mockResolvedValue({
      success: false,
      error: '중복된 라이선스입니다.',
    })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 모달 열기
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

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
    mockFetchLicenses.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateLicense.mockRejectedValue(new Error('Network timeout'))

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 모달 열기
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    // 저장 클릭
    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeInTheDocument()
    })
  })

  it('SPDX Identifier가 없으면 조회를 건너뛰고 바로 생성한다', async () => {
    const user = userEvent.setup()
    mockFetchCreateLicense.mockResolvedValue({ success: true, data: { id: 300, message: 'created' } })

    const row = makeLicenseRow({ spdxIdentifier: '' })
    render(<LicenseList rows={[row]} />)

    // 모달 열기 — validation fail(licenseName은 있지만 webpage가 없을 수 있음)
    // 여기선 webpage가 있으므로 저장 가능
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    // 저장 클릭
    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockFetchCreateLicense).toHaveBeenCalledTimes(1)
    })

    // fetchLicenses는 호출되지 않음 (SPDX가 비어있으므로)
    expect(mockFetchLicenses).not.toHaveBeenCalled()
  })

  it('취소 버튼 클릭 시 모달이 닫히고 에러가 초기화된다', async () => {
    const user = userEvent.setup()
    mockFetchLicenses.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateLicense.mockResolvedValue({ success: false, error: '실패' })

    render(<LicenseList rows={[makeLicenseRow()]} />)

    // 모달 열기
    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

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
