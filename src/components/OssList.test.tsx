import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OssList from './OssList'
import type { OssRow } from '@/lib/types'

// ─── Mocks ───

const mockToken = 'test-token'
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: mockToken }),
}))

const mockMapNamesToIds = vi.fn().mockReturnValue([1])
vi.mock('@/hooks/useLicenseMapping', () => ({
  useLicenseMapping: () => ({
    licenseMap: new Map([['MIT', 1]]),
    loading: false,
    error: null,
    mapNamesToIds: (...args: unknown[]) => mockMapNamesToIds(...args),
  }),
}))

const mockFetchOssList = vi.fn()
const mockFetchOssVersions = vi.fn()
const mockFetchCreateOss = vi.fn()
const mockFetchCreateOssVersion = vi.fn()
vi.mock('@/lib/api-client', () => ({
  fetchOssList: (...args: unknown[]) => mockFetchOssList(...args),
  fetchOssVersions: (...args: unknown[]) => mockFetchOssVersions(...args),
  fetchCreateOss: (...args: unknown[]) => mockFetchCreateOss(...args),
  fetchCreateOssVersion: (...args: unknown[]) => mockFetchCreateOssVersion(...args),
}))

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
    publisher: 'John-David Dalton',
    version: '4.17.21',
    licenseCombination: null,
    declaredLicenseList: 'MIT',
    detectedLicenseList: null,
    copyright: 'Copyright JS Foundation',
    releaseDate: null,
    description: null,
    descriptionKo: null,
    ...overrides,
  }
}

beforeEach(() => {
  mockFetchOssList.mockReset()
  mockFetchOssVersions.mockReset()
  mockFetchCreateOss.mockReset()
  mockFetchCreateOssVersion.mockReset()
  mockMapNamesToIds.mockReturnValue([1])
})

// ─── Tests ───

describe('OssList 기여하기 흐름', () => {
  it('기여하기 버튼 클릭 시 모달이 열린다', async () => {
    const user = userEvent.setup()
    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    expect(contributeBtn).toBeDefined()

    await user.click(contributeBtn!)
    expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
  })

  it('purl 조회 → OSS 존재 + 버전 존재하면 생성 API를 호출하지 않는다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue({
      success: true,
      data: [{ oss_master_id: 100, name: 'lodash', purl: 'pkg:github/lodash/lodash', version: [] }],
    })
    mockFetchOssVersions.mockResolvedValue({
      success: true,
      data: [{ oss_version_id: 1, oss_master_id: 100, version: '4.17.21', reviewed: 0 }],
    })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockFetchOssList).toHaveBeenCalledWith(
        mockToken, '', 0, 1, true, 'pkg:github/lodash/lodash',
      )
    })

    // OSS와 버전 모두 존재하므로 생성 API 미호출
    expect(mockFetchCreateOss).not.toHaveBeenCalled()
    expect(mockFetchCreateOssVersion).not.toHaveBeenCalled()
  })

  it('purl 조회 → OSS 존재 + 버전 없으면 버전 생성 API를 호출한다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue({
      success: true,
      data: [{ oss_master_id: 100, name: 'lodash', purl: 'pkg:github/lodash/lodash', version: [] }],
    })
    mockFetchOssVersions.mockResolvedValue({
      success: true,
      data: [], // 버전 없음
    })
    mockFetchCreateOssVersion.mockResolvedValue({
      success: true,
      data: { oss_master_id: 100, oss_version_id: 1, version: '4.17.21', reviewed: 0 },
    })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockFetchCreateOssVersion).toHaveBeenCalledTimes(1)
    })

    // OSS 생성은 호출되지 않음
    expect(mockFetchCreateOss).not.toHaveBeenCalled()

    // 버전 생성 요청에 oss_master_id가 포함됨
    const createArgs = mockFetchCreateOssVersion.mock.calls[0]
    expect(createArgs[1].oss_master_id).toBe(100)
    expect(createArgs[1].version).toBe('4.17.21')
  })

  it('purl 조회 → OSS 없으면 OSS 생성 후 버전 생성한다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'lodash', purl: 'pkg:github/lodash/lodash', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateOssVersion.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, oss_version_id: 1, version: '4.17.21', reviewed: 0 },
    })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockFetchCreateOss).toHaveBeenCalledTimes(1)
      expect(mockFetchCreateOssVersion).toHaveBeenCalledTimes(1)
    })

    // OSS 생성 → 반환된 oss_master_id로 버전 생성
    const versionArgs = mockFetchCreateOssVersion.mock.calls[0]
    expect(versionArgs[1].oss_master_id).toBe(200)
  })

  it('OSS 생성 실패 시 모달에 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateOss.mockResolvedValue({
      success: false,
      error: '중복된 OSS입니다.',
    })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('중복된 OSS입니다.')).toBeInTheDocument()
    })

    // 모달이 닫히지 않음
    expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
  })

  it('버전 생성 실패 시 모달에 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'lodash', purl: 'pkg:github/lodash/lodash', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateOssVersion.mockResolvedValue({
      success: false,
      error: '중복된 버전입니다.',
    })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('중복된 버전입니다.')).toBeInTheDocument()
    })
  })

  it('API 예외 발생 시 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockRejectedValue(new Error('Network error'))

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('GitHub가 아닌 downloadLocation이면 purl 없이 바로 OSS 생성한다', async () => {
    const user = userEvent.setup()
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 300, name: 'custom-lib', purl: '', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateOssVersion.mockResolvedValue({
      success: true,
      data: { oss_master_id: 300, oss_version_id: 1, version: '1.0.0', reviewed: 0 },
    })

    const row = makeOssRow({
      ossName: 'custom-lib',
      downloadLocation: 'https://custom.com/download',
      version: '1.0.0',
    })
    render(<OssList rows={[row]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockFetchCreateOss).toHaveBeenCalledTimes(1)
    })

    // purl 생성 불가 → fetchOssList 미호출
    expect(mockFetchOssList).not.toHaveBeenCalled()
  })

  it('취소 버튼 클릭 시 모달이 닫히고 에러가 초기화된다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateOss.mockResolvedValue({ success: false, error: '실패' })

    render(<OssList rows={[makeOssRow()]} />)

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
      expect(screen.queryByText('OSS 기여하기')).not.toBeInTheDocument()
    })
  })

  it('버전이 없으면 버전 조회/생성을 건너뛴다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue({ success: true, data: [] })
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 400, name: 'no-version-lib', purl: '', reviewed: 0 },
    })

    const row = makeOssRow({ version: null })
    render(<OssList rows={[row]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    const saveBtn = screen.getByText('저장')
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockFetchCreateOss).toHaveBeenCalledTimes(1)
    })

    // 버전이 없으므로 버전 관련 API 미호출
    expect(mockFetchOssVersions).not.toHaveBeenCalled()
    expect(mockFetchCreateOssVersion).not.toHaveBeenCalled()
  })
})
