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

const OSS_FOUND = {
  success: true,
  data: [{ oss_master_id: 100, name: 'lodash', purl: 'pkg:github/lodash/lodash', version: [] }],
}
const OSS_NOT_FOUND = { success: true, data: [] }
const VERSION_FOUND = {
  success: true,
  data: [{ oss_version_id: 1, oss_master_id: 100, version: '4.17.21', reviewed: 0 }],
}
const VERSION_NOT_FOUND = { success: true, data: [] }

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

/** 사전 조회에서 미존재로 응답하여 모달이 열리도록 mock 설정 */
function mockPreCheckNotFound() {
  mockFetchOssList.mockResolvedValue(OSS_NOT_FOUND)
}

beforeEach(() => {
  mockFetchOssList.mockReset()
  mockFetchOssVersions.mockReset()
  mockFetchCreateOss.mockReset()
  mockFetchCreateOssVersion.mockReset()
  mockMapNamesToIds.mockReturnValue([1])
})

// ─── Tests ───

describe('OssList 사전 조회', () => {
  it('purl 조회 → OSS+버전 존재 → 모달 없이 "이미 존재함" 표시', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_FOUND)
    mockFetchOssVersions.mockResolvedValue(VERSION_FOUND)

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    // 모달이 열리지 않음
    expect(screen.queryByText('OSS 기여하기')).not.toBeInTheDocument()
    expect(mockFetchCreateOss).not.toHaveBeenCalled()
    expect(mockFetchCreateOssVersion).not.toHaveBeenCalled()
  })

  it('purl 조회 → OSS 존재 + 버전 미존재 → 모달 열림', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_FOUND)
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })
  })

  it('purl 조회 → OSS 존재 + 버전 없는 행 → "이미 존재함" 표시', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_FOUND)

    const row = makeOssRow({ version: null })
    render(<OssList rows={[row]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    // 버전 필드가 없으므로 버전 조회 불필요
    expect(mockFetchOssVersions).not.toHaveBeenCalled()
  })

  it('purl 미발견 → downloadLocation 폴백 → 존재 시 "이미 존재함"', async () => {
    const user = userEvent.setup()
    // 1차 purl 조회 → 미발견, 2차 downloadLocation 조회 → 발견
    mockFetchOssList
      .mockResolvedValueOnce(OSS_NOT_FOUND)  // purl 조회
      .mockResolvedValueOnce(OSS_FOUND)      // downloadLocation 폴백
    mockFetchOssVersions.mockResolvedValue(VERSION_FOUND)

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    // purl 조회 + downloadLocation 폴백 = 2회 호출
    expect(mockFetchOssList).toHaveBeenCalledTimes(2)
  })

  it('비GitHub URL → downloadLocation으로 조회 → 존재 시 "이미 존재함"', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_FOUND)
    mockFetchOssVersions.mockResolvedValue(VERSION_FOUND)

    const row = makeOssRow({ downloadLocation: 'https://custom.com/download' })
    render(<OssList rows={[row]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    // purl 없음 → downloadLocation만 1회 호출
    expect(mockFetchOssList).toHaveBeenCalledTimes(1)
    expect(mockFetchOssList).toHaveBeenCalledWith(
      mockToken, 'https://custom.com/download', 0, 1, true,
    )
  })

  it('사전 조회 미존재 → 모달이 열린다', async () => {
    const user = userEvent.setup()
    mockPreCheckNotFound()

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })
  })
})

describe('OssList 기여하기 흐름', () => {
  it('모달에서 저장 → OSS+버전 생성', async () => {
    const user = userEvent.setup()
    mockPreCheckNotFound()
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'lodash', purl: 'pkg:github/lodash/lodash', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, oss_version_id: 1, version: '4.17.21', reviewed: 0 },
    })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })

    await user.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(mockFetchCreateOss).toHaveBeenCalledTimes(1)
      expect(mockFetchCreateOssVersion).toHaveBeenCalledTimes(1)
    })

    const versionArgs = mockFetchCreateOssVersion.mock.calls[0]
    expect(versionArgs[1].oss_master_id).toBe(200)
  })

  it('OSS 생성 실패 시 모달에 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup()
    mockPreCheckNotFound()
    mockFetchCreateOss.mockResolvedValue({
      success: false,
      error: '중복된 OSS입니다.',
    })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })

    await user.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(screen.getByText('중복된 OSS입니다.')).toBeInTheDocument()
    })

    expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
  })

  it('버전 생성 실패 시 모달에 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup()
    mockPreCheckNotFound()
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'lodash', purl: 'pkg:github/lodash/lodash', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({
      success: false,
      error: '중복된 버전입니다.',
    })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })

    await user.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(screen.getByText('중복된 버전입니다.')).toBeInTheDocument()
    })
  })

  it('취소 버튼 클릭 시 모달이 닫히고 에러가 초기화된다', async () => {
    const user = userEvent.setup()
    mockPreCheckNotFound()
    mockFetchCreateOss.mockResolvedValue({ success: false, error: '실패' })

    render(<OssList rows={[makeOssRow()]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })

    await user.click(screen.getByText('저장'))
    await waitFor(() => {
      expect(screen.getByText('실패')).toBeInTheDocument()
    })

    await user.click(screen.getByText('취소'))

    await waitFor(() => {
      expect(screen.queryByText('OSS 기여하기')).not.toBeInTheDocument()
    })
  })

  it('버전이 없으면 버전 조회/생성을 건너뛴다', async () => {
    const user = userEvent.setup()
    mockPreCheckNotFound()
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 400, name: 'lodash', purl: '', reviewed: 0 },
    })

    const row = makeOssRow({ version: null })
    render(<OssList rows={[row]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })

    await user.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(mockFetchCreateOss).toHaveBeenCalledTimes(1)
    })

    expect(mockFetchOssVersions).not.toHaveBeenCalled()
    expect(mockFetchCreateOssVersion).not.toHaveBeenCalled()
  })
})
