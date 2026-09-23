import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OssList from './OssList'
import type { OsoriLicense } from '@/lib/osori-types'
import type { OssRow } from '@/lib/types'

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

const mockMapNamesToIds = vi.fn().mockReturnValue([1])

/**
 * OSORI 마스터 목록. 규칙 4 판정(hasLicense)과 모달의 검색 목록(licenses)이 **같은 출처**를 본다.
 * 둘이 갈라지면 목이 현실에 없는 상태를 만든다 — 실제로 착수 시점에 `hasLicense: () => false` 와
 * MIT 이 든 licenseMap 이 공존해 테스트 19건이 거짓으로 깨져 있었다.
 * 타입을 붙여 OsoriLicense 필수 필드 누락이 조용히 지나가지 않게 한다.
 */
const MASTER_LICENSES: readonly OsoriLicense[] = [
  { id: 1, name: 'MIT', spdx_identifier: 'MIT', obligation_disclosing_src: null, obligation_notification: null, osi_approval: null },
  { id: 2, name: 'Apache-2.0', spdx_identifier: 'Apache-2.0', obligation_disclosing_src: null, obligation_notification: null, osi_approval: null },
  // 이름 자체에 쉼표가 든 실제 마스터 항목. 직렬화 왕복이 깨지면 여기서 드러난다.
  { id: 3, name: 'Server Side Public License, v 1', spdx_identifier: 'SSPL-1.0', obligation_disclosing_src: null, obligation_notification: null, osi_approval: null },
]

let mockRegisteredLicenses: readonly OsoriLicense[] = MASTER_LICENSES
let mockLicenseMappingLoading = false
let mockLicenseMappingError: string | null = null
const mockHasLicense = (name: string) => {
  const key = name.trim().toLowerCase()
  return mockRegisteredLicenses.some(
    (l) => l.name.toLowerCase() === key || (l.spdx_identifier ?? '').toLowerCase() === key,
  )
}
vi.mock('@/hooks/useLicenseMapping', () => ({
  useLicenseMapping: () => ({
    licenses: mockRegisteredLicenses,
    licenseMap: new Map(mockRegisteredLicenses.map((l) => [l.name.toLowerCase(), l.id])),
    loading: mockLicenseMappingLoading,
    error: mockLicenseMappingError,
    mapNamesToIds: (...args: unknown[]) => mockMapNamesToIds(...args),
    hasLicense: mockHasLicense,
  }),
}))

const mockFetchOssList = vi.fn()
const mockFetchOssVersions = vi.fn()
const mockFetchCreateOss = vi.fn()
const mockFetchCreateOssVersion = vi.fn()
const mockCheckUrls = vi.fn()
vi.mock('@/lib/api-client', () => ({
  fetchOssList: (...args: unknown[]) => mockFetchOssList(...args),
  fetchOssVersions: (...args: unknown[]) => mockFetchOssVersions(...args),
  fetchCreateOss: (...args: unknown[]) => mockFetchCreateOss(...args),
  fetchCreateOssVersion: (...args: unknown[]) => mockFetchCreateOssVersion(...args),
  checkUrls: (...args: unknown[]) => mockCheckUrls(...args),
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

/** 주어진 URL 을 모두 접속 성공으로 응답한다. */
function mockUrlsReachable() {
  mockCheckUrls.mockImplementation((_token: string, urls: readonly string[]) =>
    Promise.resolve({
      success: true,
      data: {
        results: urls.map((url) => ({ url, outcome: 'ok', status: 200, reason: null })),
      },
    }),
  )
}

beforeEach(() => {
  mockPush.mockReset()
  mockReplace.mockReset()
  mockSearchParams = new URLSearchParams()
  mockFetchOssList.mockReset()
  mockFetchOssVersions.mockReset()
  mockFetchCreateOss.mockReset()
  mockFetchCreateOssVersion.mockReset()
  mockCheckUrls.mockReset()
  mockMapNamesToIds.mockReturnValue([1])
  mockRegisteredLicenses = MASTER_LICENSES
  mockLicenseMappingLoading = false
  mockLicenseMappingError = null
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

  it('purl 조회 → OSS 존재 + 버전 없는 행 → 빈 버전 일치 시 "이미 존재함" 표시', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_FOUND)
    // 빈 버전(version: null)이 존재하는 응답
    mockFetchOssVersions.mockResolvedValue({
      success: true,
      data: [{ oss_version_id: 2, oss_master_id: 100, version: null, reviewed: 0 }],
    })

    const row = makeOssRow({ version: null })
    render(<OssList rows={[row]} />)

    const buttons = screen.getAllByRole('button')
    const contributeBtn = buttons.find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)

    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    expect(mockFetchOssVersions).toHaveBeenCalledTimes(1)
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

  it('버전이 빈 문자열이어도 버전 생성을 수행한다', async () => {
    const user = userEvent.setup()
    mockPreCheckNotFound()
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 400, name: 'lodash', purl: '', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({
      success: true,
      data: { oss_master_id: 400, oss_version_id: 1, version: null, reviewed: 0 },
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

    expect(mockFetchOssVersions).toHaveBeenCalledTimes(1)
    expect(mockFetchCreateOssVersion).toHaveBeenCalledTimes(1)
  })
})

describe('OssList 전체 기여', () => {
  it('전체 기여 버튼 클릭 시 모든 행을 순차 처리한다', async () => {
    const user = userEvent.setup()
    // 모든 행이 미존재 → OSS+버전 생성
    mockFetchOssList.mockResolvedValue(OSS_NOT_FOUND)
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'lodash', purl: 'pkg:github/lodash/lodash', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, oss_version_id: 1, version: '4.17.21', reviewed: 0 },
    })

    const rows = [makeOssRow(), makeOssRow({ no: 2, ossName: 'axios' })]
    render(<OssList rows={rows} />)

    await user.click(screen.getByText('전체 기여'))

    await waitFor(() => {
      const badges = screen.getAllByText('완료')
      expect(badges).toHaveLength(2)
    })

    expect(mockFetchCreateOss).toHaveBeenCalledTimes(2)
    expect(mockFetchCreateOssVersion).toHaveBeenCalledTimes(2)
  })

  it('이미 존재하는 항목은 스킵하고 "이미 존재함" 표시', async () => {
    const user = userEvent.setup()
    // purl 조회 → OSS+버전 존재
    mockFetchOssList.mockResolvedValue(OSS_FOUND)
    mockFetchOssVersions.mockResolvedValue(VERSION_FOUND)

    render(<OssList rows={[makeOssRow()]} />)

    await user.click(screen.getByText('전체 기여'))

    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    expect(mockFetchCreateOss).not.toHaveBeenCalled()
    expect(mockFetchCreateOssVersion).not.toHaveBeenCalled()
  })

  it('검증 실패 행은 에러 표시하고 다음 행 진행', async () => {
    const user = userEvent.setup()
    // 2번째 행은 정상
    mockFetchOssList.mockResolvedValue(OSS_NOT_FOUND)
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 300, name: 'axios', purl: 'pkg:github/axios/axios', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({
      success: true,
      data: { oss_master_id: 300, oss_version_id: 1, version: '1.0.0', reviewed: 0 },
    })

    const rows = [
      makeOssRow({ downloadLocation: '' }), // 검증 실패: downloadLocation 필수
      makeOssRow({ no: 2, ossName: 'axios', downloadLocation: 'https://github.com/axios/axios', version: '1.0.0' }),
    ]
    render(<OssList rows={rows} />)

    await user.click(screen.getByText('전체 기여'))

    await waitFor(() => {
      // 1번째 행 에러, 2번째 행 성공
      expect(screen.getByText(/Download location은 필수 항목입니다/)).toBeInTheDocument()
      expect(screen.getByText('완료')).toBeInTheDocument()
    })
  })

  it('OSS 생성 실패 시 에러 표시하고 다음 행 진행', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_NOT_FOUND)
    mockFetchCreateOss
      .mockResolvedValueOnce({ success: false, error: '중복된 OSS입니다.' })
      .mockResolvedValueOnce({
        success: true,
        data: { oss_master_id: 300, name: 'axios', purl: 'pkg:github/axios/axios', reviewed: 0 },
      })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({
      success: true,
      data: { oss_master_id: 300, oss_version_id: 1, version: '1.0.0', reviewed: 0 },
    })

    const rows = [
      makeOssRow(),
      makeOssRow({ no: 2, ossName: 'axios', downloadLocation: 'https://github.com/axios/axios', version: '1.0.0' }),
    ]
    render(<OssList rows={rows} />)

    await user.click(screen.getByText('전체 기여'))

    await waitFor(() => {
      expect(screen.getByText('중복된 OSS입니다.')).toBeInTheDocument()
      expect(screen.getByText('완료')).toBeInTheDocument()
    })
  })
})

describe('OssList 테이블 구성', () => {
  it('컬럼이 지정된 순서로 표시된다', () => {
    render(<OssList rows={[makeOssRow()]} />)

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual([
      'No',
      'OSS Name',
      'Download Location',
      'Declared License',
      'Comb.',
      '작업',
    ])
  })

  it('Version은 별도 컬럼이 아니라 OSS Name 아래에 표시된다', () => {
    render(<OssList rows={[makeOssRow({ ossName: 'lodash', version: '4.17.21' })]} />)

    expect(screen.queryByRole('columnheader', { name: 'Version' })).not.toBeInTheDocument()

    const nameCell = screen.getByText('lodash').closest('td')
    expect(nameCell).toHaveTextContent('4.17.21')
    // 이름 줄과 분리된 아래 줄에 있어야 한다
    expect(screen.getByText('lodash').parentElement).not.toHaveTextContent('4.17.21')
  })

  it('Download Location을 새 탭 링크로 렌더한다', () => {
    render(
      <OssList rows={[makeOssRow({ downloadLocation: 'https://github.com/lodash/lodash' })]} />,
    )

    const link = screen.getByRole('link', { name: 'https://github.com/lodash/lodash' })
    expect(link).toHaveAttribute('href', 'https://github.com/lodash/lodash')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('http(s)가 아닌 Download Location은 링크로 만들지 않는다', () => {
    render(
      <OssList rows={[makeOssRow({ downloadLocation: 'javascript:alert(1)', homepage: null })]} />,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
  })

  it('Homepage도 새 탭 링크로 렌더한다', () => {
    render(<OssList rows={[makeOssRow({ homepage: 'https://lodash.com' })]} />)

    const link = screen.getByRole('link', { name: 'https://lodash.com' })
    expect(link).toHaveAttribute('href', 'https://lodash.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('http(s)가 아닌 Homepage는 링크로 만들지 않는다', () => {
    render(<OssList rows={[makeOssRow({ homepage: 'javascript:alert(1)' })]} />)

    expect(screen.queryByRole('link', { name: 'javascript:alert(1)' })).not.toBeInTheDocument()
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
  })

  it('Homepage는 별도 컬럼이 아니라 Download Location 셀에 부가 정보로 표시된다', () => {
    render(
      <OssList
        rows={[
          makeOssRow({
            downloadLocation: 'https://github.com/lodash/lodash',
            homepage: 'https://lodash.com',
          }),
        ]}
      />,
    )

    expect(screen.queryByRole('columnheader', { name: 'Homepage' })).not.toBeInTheDocument()

    const locationCell = screen.getByText('https://github.com/lodash/lodash').closest('td')
    expect(locationCell).toHaveTextContent('Homepage')
    expect(locationCell).toHaveTextContent('https://lodash.com')
  })

  it('Version과 Homepage가 없으면 해당 부가 정보를 렌더하지 않는다', () => {
    render(<OssList rows={[makeOssRow({ version: null, homepage: null })]} />)

    expect(screen.queryByText('Homepage')).not.toBeInTheDocument()
  })

  it('Detected License 컬럼은 표시하지 않는다', () => {
    render(<OssList rows={[makeOssRow({ detectedLicenseList: 'Apache-2.0' })]} />)

    expect(
      screen.queryByRole('columnheader', { name: 'Detected License' }),
    ).not.toBeInTheDocument()
  })

  it('작업 컬럼은 가로 스크롤과 무관하게 고정된다', () => {
    render(<OssList rows={[makeOssRow()]} />)

    const actionHeader = screen.getByRole('columnheader', { name: '작업' })
    expect(actionHeader.className).toContain('sticky')

    const actionCell = screen.getByRole('button', { name: '기여하기' }).closest('td')
    expect(actionCell?.className).toContain('sticky')
  })
})

describe('OssList 페이지 URL 파라미터', () => {
  function makeRows(count: number): OssRow[] {
    return Array.from({ length: count }, (_, i) =>
      makeOssRow({ no: i + 1, ossName: `pkg-${i + 1}` }),
    )
  }

  it('page 파라미터가 없으면 1페이지를 보여준다', () => {
    render(<OssList rows={makeRows(25)} />)

    expect(screen.getByText('pkg-1')).toBeInTheDocument()
    expect(screen.queryByText('pkg-21')).not.toBeInTheDocument()
  })

  it('page 파라미터에 해당하는 페이지를 보여준다', () => {
    mockSearchParams = new URLSearchParams('page=2')
    render(<OssList rows={makeRows(25)} />)

    expect(screen.getByText('pkg-21')).toBeInTheDocument()
    expect(screen.queryByText('pkg-1')).not.toBeInTheDocument()
  })

  it('페이지를 이동하면 URL에 page 파라미터를 남긴다', async () => {
    const user = userEvent.setup()
    render(<OssList rows={makeRows(25)} />)

    await user.click(screen.getByRole('button', { name: '2' }))

    expect(mockPush).toHaveBeenCalledWith('?page=2', { scroll: false })
  })

  it('1페이지로 돌아가면 page 파라미터를 제거한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('page=2')
    render(<OssList rows={makeRows(25)} />)

    await user.click(screen.getByRole('button', { name: '1' }))

    expect(mockPush).toHaveBeenCalledWith('?', { scroll: false })
  })

  it('다른 파라미터는 유지한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('debug=1')
    render(<OssList rows={makeRows(25)} />)

    await user.click(screen.getByRole('button', { name: '2' }))

    expect(mockPush).toHaveBeenCalledWith('?debug=1&page=2', { scroll: false })
  })

  it('범위를 벗어난 page는 마지막 페이지로 보정한다', () => {
    mockSearchParams = new URLSearchParams('page=99')
    render(<OssList rows={makeRows(25)} />)

    expect(screen.getByText('pkg-21')).toBeInTheDocument()
  })

  it('숫자가 아닌 page는 1페이지로 취급한다', () => {
    mockSearchParams = new URLSearchParams('page=abc')
    render(<OssList rows={makeRows(25)} />)

    expect(screen.getByText('pkg-1')).toBeInTheDocument()
  })

  it('첫 렌더에서는 URL의 page를 유지한다', () => {
    mockSearchParams = new URLSearchParams('page=2')
    render(<OssList rows={makeRows(25)} />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('새 목록이 들어오면 1페이지로 되돌리되 히스토리를 남기지 않는다', () => {
    mockSearchParams = new URLSearchParams('page=2')
    const { rerender } = render(<OssList rows={makeRows(25)} />)

    rerender(<OssList rows={makeRows(30)} />)

    expect(mockReplace).toHaveBeenCalledWith('?', { scroll: false })
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('OssList 검색', () => {
  function makeNamedRows(...names: string[]): OssRow[] {
    return names.map((ossName, i) => makeOssRow({ no: i + 1, ossName }))
  }

  it('q 파라미터로 목록을 걸러낸다', () => {
    mockSearchParams = new URLSearchParams('q=ax')
    render(<OssList rows={makeNamedRows('lodash', 'axios', 'react')} />)

    expect(screen.getByText('axios')).toBeInTheDocument()
    expect(screen.queryByText('lodash')).not.toBeInTheDocument()
    expect(screen.queryByText('react')).not.toBeInTheDocument()
  })

  it('대소문자를 구분하지 않는다', () => {
    mockSearchParams = new URLSearchParams('q=LODASH')
    render(<OssList rows={makeNamedRows('Lodash', 'axios')} />)

    expect(screen.getByText('Lodash')).toBeInTheDocument()
    expect(screen.queryByText('axios')).not.toBeInTheDocument()
  })

  it('검색어를 입력하면 URL에 q 파라미터를 남긴다', async () => {
    const user = userEvent.setup()
    render(<OssList rows={makeNamedRows('lodash', 'axios')} />)

    await user.type(screen.getByLabelText('OSS Name 검색'), 'ax')

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('?q=ax', { scroll: false })
    })
  })

  it('검색어가 바뀌면 첫 페이지로 돌아간다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('page=2')
    render(<OssList rows={makeNamedRows('lodash', 'axios')} />)

    await user.type(screen.getByLabelText('OSS Name 검색'), 'ax')

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('?q=ax', { scroll: false })
    })
  })

  it('다른 파라미터는 유지한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('debug=1')
    render(<OssList rows={makeNamedRows('lodash')} />)

    await user.type(screen.getByLabelText('OSS Name 검색'), 'lo')

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('?debug=1&q=lo', { scroll: false })
    })
  })

  it('지우기 버튼은 q 파라미터를 제거한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('q=lodash')
    render(<OssList rows={makeNamedRows('lodash', 'axios')} />)

    await user.click(screen.getByRole('button', { name: '검색어 지우기' }))

    expect(mockReplace).toHaveBeenCalledWith('?', { scroll: false })
  })

  it('URL의 검색어가 입력창에 채워진다', () => {
    mockSearchParams = new URLSearchParams('q=lodash')
    render(<OssList rows={makeNamedRows('lodash', 'axios')} />)

    expect(screen.getByLabelText('OSS Name 검색')).toHaveValue('lodash')
  })

  it('검색 결과 개수를 표시한다', () => {
    mockSearchParams = new URLSearchParams('q=react')
    render(<OssList rows={makeNamedRows('react', 'react-dom', 'vue')} />)

    expect(screen.getByText('2건')).toBeInTheDocument()
  })

  it('검색 중에는 배치 버튼이 검색 결과만 처리함을 알린다', () => {
    mockSearchParams = new URLSearchParams('q=react')
    render(<OssList rows={makeNamedRows('lodash', 'axios', 'react')} />)

    expect(screen.getByRole('button', { name: '검색 결과 기여 (1건)' })).toBeInTheDocument()
  })

  it('검색어가 없으면 전체 기여 버튼을 보여준다', () => {
    render(<OssList rows={makeNamedRows('lodash', 'axios')} />)

    expect(screen.getByRole('button', { name: '전체 기여' })).toBeInTheDocument()
  })

  it('검색 중 배치 기여는 걸러진 항목만 처리한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('q=react')
    mockFetchOssList.mockResolvedValue(OSS_NOT_FOUND)
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'react', purl: '', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({ success: true, data: { oss_version_id: 1 } })

    render(<OssList rows={makeNamedRows('lodash', 'axios', 'react')} />)
    await user.click(screen.getByRole('button', { name: '검색 결과 기여 (1건)' }))

    await waitFor(() => {
      expect(screen.getByText('완료')).toBeInTheDocument()
    })
    expect(mockFetchCreateOss).toHaveBeenCalledTimes(1)
    expect(mockFetchCreateOss.mock.calls[0][1]).toMatchObject({ name: 'react' })
  })

  it('검색으로 걸러도 기여 상태가 원래 행에 유지된다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('q=axios')
    mockFetchOssList.mockResolvedValue(OSS_FOUND)
    mockFetchOssVersions.mockResolvedValue(VERSION_FOUND)

    const rows = makeNamedRows('lodash', 'axios')
    const { rerender } = render(<OssList rows={rows} />)

    await user.click(screen.getByRole('button', { name: '기여하기' }))
    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    // 검색을 지워도 axios만 "이미 존재함"이고 lodash는 기여 가능해야 한다
    mockSearchParams = new URLSearchParams()
    rerender(<OssList rows={rows} />)

    expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '기여하기' })).toBeInTheDocument()
  })
})

describe('OssList Declared License 다중값 표시', () => {
  function declaredCell(): HTMLElement {
    // 컬럼 순서: No(0), OSS Name(1), Download Location(2), Declared License(3), Comb.(4), 작업(5)
    return document.querySelectorAll('tbody tr td')[3] as HTMLElement
  }

  it('쉼표로 구분된 값을 각각 배지로 표시한다', () => {
    render(<OssList rows={[makeOssRow({ declaredLicenseList: 'MIT, Apache-2.0, BSD-3-Clause' })]} />)

    const cell = declaredCell()
    const badges = cell.querySelectorAll('span')
    expect(badges).toHaveLength(3)
    expect([...badges].map((b) => b.textContent)).toEqual(['MIT', 'Apache-2.0', 'BSD-3-Clause'])
  })

  it('줄바꿈으로 구분된 값도 각각 배지로 표시한다', () => {
    render(<OssList rows={[makeOssRow({ declaredLicenseList: 'MIT\nApache-2.0' })]} />)

    expect(declaredCell().querySelectorAll('span')).toHaveLength(2)
  })

  it('개수 제한 없이 모두 표시하며 줄바꿈으로 흐른다', () => {
    const many = 'MIT, Apache-2.0, BSD-3-Clause, GPL-2.0, LGPL-2.1, MPL-2.0, ISC'
    render(<OssList rows={[makeOssRow({ declaredLicenseList: many })]} />)

    const cell = declaredCell()
    expect(cell.querySelectorAll('span')).toHaveLength(7)
    // 잘리지 않고 여러 줄로 흐르는 구조
    expect(cell.querySelector('div')?.className).toContain('flex-wrap')
    expect(cell.className).not.toContain('truncate')
  })

  it('빈 항목과 공백은 배지로 만들지 않는다', () => {
    render(<OssList rows={[makeOssRow({ declaredLicenseList: 'MIT, ,  , Apache-2.0' })]} />)

    expect(declaredCell().querySelectorAll('span')).toHaveLength(2)
  })

  it('값이 없으면 하이픈을 표시한다', () => {
    render(<OssList rows={[makeOssRow({ declaredLicenseList: null })]} />)

    expect(declaredCell().textContent).toBe('-')
  })
})

describe('OssList 페이지당 표시 개수', () => {
  function makeRows(count: number): OssRow[] {
    return Array.from({ length: count }, (_, i) =>
      makeOssRow({ no: i + 1, ossName: `pkg-${i + 1}` }),
    )
  }

  const sizeSelect = () => screen.getByLabelText('페이지당 표시 개수')

  it('기본값은 20개씩이다', () => {
    render(<OssList rows={makeRows(25)} />)

    expect(sizeSelect()).toHaveValue('20')
    expect(screen.getByText('pkg-20')).toBeInTheDocument()
    expect(screen.queryByText('pkg-21')).not.toBeInTheDocument()
  })

  it('size 파라미터만큼 표시한다', () => {
    mockSearchParams = new URLSearchParams('size=50')
    render(<OssList rows={makeRows(60)} />)

    expect(sizeSelect()).toHaveValue('50')
    expect(screen.getByText('pkg-50')).toBeInTheDocument()
    expect(screen.queryByText('pkg-51')).not.toBeInTheDocument()
  })

  it('개수를 바꾸면 URL에 size 파라미터를 남기고 첫 페이지로 돌아간다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('page=2')
    render(<OssList rows={makeRows(60)} />)

    await user.selectOptions(sizeSelect(), '50')

    expect(mockReplace).toHaveBeenCalledWith('?size=50', { scroll: false })
  })

  it('기본값으로 되돌리면 size 파라미터를 제거한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('size=50')
    render(<OssList rows={makeRows(60)} />)

    await user.selectOptions(sizeSelect(), '20')

    expect(mockReplace).toHaveBeenCalledWith('?', { scroll: false })
  })

  it('허용되지 않은 size는 기본값으로 취급한다', () => {
    mockSearchParams = new URLSearchParams('size=99999')
    render(<OssList rows={makeRows(25)} />)

    expect(sizeSelect()).toHaveValue('20')
    expect(screen.queryByText('pkg-21')).not.toBeInTheDocument()
  })

  it('size가 커지면 전체 페이지 수가 줄어든다', () => {
    mockSearchParams = new URLSearchParams('size=100')
    render(<OssList rows={makeRows(60)} />)

    // 60건이 한 페이지에 들어가므로 2페이지 버튼이 없다
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument()
  })

  it('다른 파라미터는 유지한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('debug=1&q=pkg')
    render(<OssList rows={makeRows(60)} />)

    await user.selectOptions(sizeSelect(), '50')

    expect(mockReplace).toHaveBeenCalledWith('?debug=1&q=pkg&size=50', { scroll: false })
  })
})

describe('OssList 사전 검증', () => {
  const preValidateButton = () => screen.getByRole('button', { name: /사전 검증/ })

  it('툴바에 대상 건수를 표시하는 [사전 검증] 버튼이 있다', () => {
    render(<OssList rows={[makeOssRow(), makeOssRow({ no: 2, ossName: 'axios' })]} />)

    expect(screen.getByRole('button', { name: '사전 검증 (2건)' })).toBeInTheDocument()
  })

  it('검색 중이면 걸러진 건수만 대상으로 잡는다', () => {
    mockSearchParams = new URLSearchParams('q=axios')
    render(<OssList rows={[makeOssRow(), makeOssRow({ no: 2, ossName: 'axios' })]} />)

    expect(screen.getByRole('button', { name: '사전 검증 (1건)' })).toBeInTheDocument()
  })

  it('검증 전에는 배지를 표시하지 않는다', () => {
    render(<OssList rows={[makeOssRow()]} />)

    expect(screen.queryByText(/검증 통과|차단|확인 필요/)).not.toBeInTheDocument()
  })

  it('URL 이 모두 접속되면 통과 배지를 표시한다', async () => {
    const user = userEvent.setup()
    mockUrlsReachable()
    render(<OssList rows={[makeOssRow()]} />)

    await user.click(preValidateButton())

    await waitFor(() => {
      expect(screen.getByText('검증 통과')).toBeInTheDocument()
    })
    expect(mockCheckUrls).toHaveBeenCalledWith('test-token', ['https://github.com/lodash/lodash'])
  })

  it('규칙 1 — 404 URL 은 차단 배지와 사유를 표시한다', async () => {
    const user = userEvent.setup()
    mockCheckUrls.mockImplementation((_token: string, urls: readonly string[]) =>
      Promise.resolve({
        success: true,
        data: {
          results: urls.map((url) => ({
            url,
            outcome: 'unreachable',
            status: 404,
            reason: 'HTTP 404',
          })),
        },
      }),
    )
    render(<OssList rows={[makeOssRow()]} />)

    await user.click(preValidateButton())

    await waitFor(() => {
      expect(screen.getByText('차단 1')).toBeInTheDocument()
    })
    expect(screen.getByText(/URL에 접속할 수 없습니다\(404\)/)).toBeInTheDocument()
  })

  it('규칙 1 — 403 은 차단하지 않고 확인 필요로 표시한다', async () => {
    const user = userEvent.setup()
    mockCheckUrls.mockImplementation((_token: string, urls: readonly string[]) =>
      Promise.resolve({
        success: true,
        data: {
          results: urls.map((url) => ({
            url,
            outcome: 'forbidden',
            status: 403,
            reason: '접근이 거부되었습니다(403)',
          })),
        },
      }),
    )
    render(<OssList rows={[makeOssRow()]} />)

    await user.click(preValidateButton())

    await waitFor(() => {
      expect(screen.getByText('확인 필요 1')).toBeInTheDocument()
    })
  })

  it('오프라인 규칙 위반은 URL 검사 없이도 차단으로 잡힌다', async () => {
    const user = userEvent.setup()
    mockUrlsReachable()
    render(<OssList rows={[makeOssRow({ declaredLicenseList: 'FooBar-1.0' })]} />)

    await user.click(preValidateButton())

    await waitFor(() => {
      expect(screen.getByText('차단 1')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/OSORI에 등록되지 않은 라이선스입니다: FooBar-1\.0/),
    ).toBeInTheDocument()
  })

  it('URL 검사에 실패하면 사유를 알리고 배지에 * 를 붙인다', async () => {
    const user = userEvent.setup()
    mockCheckUrls.mockResolvedValue({ success: false, error: '서버 오류' })
    render(<OssList rows={[makeOssRow()]} />)

    await user.click(preValidateButton())

    await waitFor(() => {
      expect(screen.getByText('검증 통과*')).toBeInTheDocument()
    })
    expect(screen.getByText(/일부 URL을 검사하지 못했습니다: 서버 오류/)).toBeInTheDocument()
  })

  it('검증 결과가 있는 행은 [전체 기여]가 그 결과를 재사용한다', async () => {
    const user = userEvent.setup()
    mockCheckUrls.mockImplementation((_token: string, urls: readonly string[]) =>
      Promise.resolve({
        success: true,
        data: {
          results: urls.map((url) => ({
            url,
            outcome: 'unreachable',
            status: 500,
            reason: 'HTTP 500',
          })),
        },
      }),
    )
    mockFetchOssList.mockResolvedValue(OSS_NOT_FOUND)
    render(<OssList rows={[makeOssRow()]} />)

    await user.click(preValidateButton())
    await waitFor(() => {
      expect(screen.getByText('차단 1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '전체 기여' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /재시도/ })).toBeInTheDocument()
    })
    // 배치 오류 서브행과 검증 힌트 서브행에 같은 사유가 각각 표시된다.
    expect(screen.getAllByText(/URL에 접속할 수 없습니다\(500\)/)).toHaveLength(2)
    // URL 접속 실패로 차단되었으므로 생성 API 는 호출되지 않는다.
    expect(mockFetchCreateOss).not.toHaveBeenCalled()
  })

  it('라이선스 목록 로딩 중에는 [사전 검증]과 [전체 기여]를 모두 막는다', () => {
    mockLicenseMappingLoading = true
    render(<OssList rows={[makeOssRow()]} />)

    expect(preValidateButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: '전체 기여' })).toBeDisabled()
  })

  it('라이선스 목록 조회에 실패하면 규칙 4 판정이 불가능하므로 버튼을 막고 사유를 알린다', () => {
    // 마스터 목록이 비면 hasLicense 가 전부 false 를 돌려줘 정상 행까지 차단된다.
    mockLicenseMappingError = '라이선스 목록 조회에 실패했습니다.'
    mockRegisteredLicenses = []
    render(<OssList rows={[makeOssRow()]} />)

    expect(preValidateButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: '전체 기여' })).toBeDisabled()
    expect(
      screen.getByText(/라이선스 목록을 불러오지 못해 등록 여부를 확인할 수 없습니다/),
    ).toBeInTheDocument()
  })

  it('라이선스 목록 조회에 실패하면 개별 기여 버튼도 막는다', () => {
    mockLicenseMappingError = '라이선스 목록 조회에 실패했습니다.'
    mockRegisteredLicenses = []
    render(<OssList rows={[makeOssRow()]} />)

    expect(screen.getByRole('button', { name: /기여하기/ })).toBeDisabled()
  })

  it('조회에 성공하면 사유 안내를 띄우지 않는다', () => {
    render(<OssList rows={[makeOssRow()]} />)

    expect(
      screen.queryByText(/라이선스 목록을 불러오지 못해/),
    ).not.toBeInTheDocument()
  })

  it('로딩 중에는 규칙 4가 "미등록" 이라고 단정하지 않는다', async () => {
    // 마스터가 아직 없을 뿐인데 미등록으로 몰면 정상 행에 틀린 사유가 붙는다.
    // 저장은 모달이 licenseMappingLoading 으로 따로 잠근다.
    const user = userEvent.setup()
    mockLicenseMappingLoading = true
    mockRegisteredLicenses = []
    mockPreCheckNotFound()
    render(<OssList rows={[makeOssRow()]} />)

    await user.click(screen.getByRole('button', { name: /기여하기/ }))
    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })

    expect(screen.queryByText(/OSORI에 등록되지 않은 라이선스입니다/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '매핑 중...' })).toBeDisabled()
  })

  it('조회에 실패해도 규칙 4가 "미등록" 이라고 단정하지 않는다', async () => {
    // 툴바 버튼이 막혀 있어 화면으로는 확인할 수 없으므로, error 유무만 다른 두 조건을 대조한다.
    const user = userEvent.setup()
    mockUrlsReachable()
    mockRegisteredLicenses = []
    render(<OssList rows={[makeOssRow()]} />)

    await user.click(preValidateButton())
    await waitFor(() => {
      expect(screen.getByText('차단 1')).toBeInTheDocument()
    })

    // 같은 데이터라도 조회 실패 상태에서는 규칙 4가 꺼져 진입 경로 자체가 닫힌다.
    cleanup()
    mockLicenseMappingError = '라이선스 목록 조회에 실패했습니다.'
    render(<OssList rows={[makeOssRow()]} />)

    expect(preValidateButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: /기여하기/ })).toBeDisabled()
    expect(screen.queryByText('차단 1')).not.toBeInTheDocument()
  })

  it('조회에 성공했다면 마스터가 비어 있어도 규칙 4는 정상 동작한다', async () => {
    // error 게이트가 규칙 4 자체를 무력화하지 않았는지 확인한다.
    const user = userEvent.setup()
    mockUrlsReachable()
    mockRegisteredLicenses = []
    render(<OssList rows={[makeOssRow()]} />)

    expect(preValidateButton()).toBeEnabled()
    await user.click(preValidateButton())

    await waitFor(() => {
      expect(screen.getByText('차단 1')).toBeInTheDocument()
    })
    expect(
      screen.getByText(/OSORI에 등록되지 않은 라이선스입니다: MIT/),
    ).toBeInTheDocument()
  })

  it('대상 행이 없으면 버튼을 막는다', () => {
    mockSearchParams = new URLSearchParams('q=nothing-matches')
    render(<OssList rows={[makeOssRow()]} />)

    expect(preValidateButton()).toBeDisabled()
  })

  it('행을 수정하면 그 행의 검증 결과를 버린다', async () => {
    const user = userEvent.setup()
    mockUrlsReachable()
    mockPreCheckNotFound()
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'lodash', purl: '', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({ success: true, data: { oss_version_id: 1 } })

    render(<OssList rows={[makeOssRow()]} />)

    await user.click(preValidateButton())
    await waitFor(() => {
      expect(screen.getByText('검증 통과')).toBeInTheDocument()
    })

    const contributeBtn = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('기여하기'))
    await user.click(contributeBtn!)
    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(screen.queryByText('검증 통과')).not.toBeInTheDocument()
    })
  })
})

/**
 * 모달의 선택 결과가 기여 payload 까지 한 이름으로 도달하는지 본다.
 *
 * 모달은 joinMultiValue 로 직렬화하고, OssList 는 parseMultiValue 로 되읽어
 * mapNamesToIds 에 넘긴다. 두 함수가 어긋나면 이름에 쉼표가 든 라이선스가
 * 전송 직전에 둘로 쪼개져 조용히 누락된다 — 규칙 4로도 잡히지 않는 경로다.
 */
describe('OssList 라이선스 직렬화 왕복', () => {
  it('이름에 쉼표가 든 라이선스를 골라 저장하면 한 이름으로 매핑에 넘긴다', async () => {
    const user = userEvent.setup()
    mockPreCheckNotFound()
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'lodash', purl: '', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({ success: true, data: { oss_version_id: 1 } })

    render(<OssList rows={[makeOssRow()]} />)

    await user.click(screen.getByRole('button', { name: /기여하기/ }))
    await waitFor(() => {
      expect(screen.getByText('OSS 기여하기')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'MIT 제거' }))
    const combobox = screen.getByRole('combobox', { name: 'Declared License' })
    await user.type(combobox, 'Server Side')
    await user.click(await screen.findByRole('option', { name: /Server Side Public License, v 1/ }))

    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(mockFetchCreateOssVersion).toHaveBeenCalled()
    })
    // 쉼표로 쪼개졌다면 ['Server Side Public License', 'v 1'] 이 넘어간다.
    expect(mockMapNamesToIds).toHaveBeenCalledWith(['Server Side Public License, v 1'])
  })

  it('배치 기여도 같은 파서로 읽어 한 이름으로 넘긴다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_NOT_FOUND)
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'lodash', purl: '', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({ success: true, data: { oss_version_id: 1 } })

    // 모달이 저장한 형태(후행 줄바꿈으로 구분자 모드를 고정한 값)를 그대로 재현한다.
    render(
      <OssList rows={[makeOssRow({ declaredLicenseList: 'Server Side Public License, v 1\n' })]} />,
    )

    await user.click(screen.getByRole('button', { name: '전체 기여' }))

    await waitFor(() => {
      expect(screen.getByText('완료')).toBeInTheDocument()
    })
    expect(mockMapNamesToIds).toHaveBeenCalledWith(['Server Side Public License, v 1'])
  })
})
