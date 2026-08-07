import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OssList from './OssList'
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
vi.mock('@/hooks/useLicenseMapping', () => ({
  useLicenseMapping: () => ({
    licenses: [{ id: 1, name: 'MIT', spdx_identifier: 'MIT' }],
    licenseMap: new Map([['MIT', 1], ['mit', 1]]),
    loading: false,
    error: null,
    mapNamesToIds: (...args: unknown[]) => mockMapNamesToIds(...args),
    hasLicense: () => false,
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
  mockPush.mockReset()
  mockReplace.mockReset()
  mockSearchParams = new URLSearchParams()
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
    render(<OssList rows={[makeOssRow({ downloadLocation: 'javascript:alert(1)' })]} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
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
    mockSearchParams = new URLSearchParams('tab=oss')
    render(<OssList rows={makeRows(25)} />)

    await user.click(screen.getByRole('button', { name: '2' }))

    expect(mockPush).toHaveBeenCalledWith('?tab=oss&page=2', { scroll: false })
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

  it('OSS Name으로 목록을 걸러낸다', async () => {
    const user = userEvent.setup()
    render(<OssList rows={makeNamedRows('lodash', 'axios', 'react')} />)

    await user.type(screen.getByLabelText('OSS Name 검색'), 'ax')

    expect(screen.getByText('axios')).toBeInTheDocument()
    expect(screen.queryByText('lodash')).not.toBeInTheDocument()
    expect(screen.queryByText('react')).not.toBeInTheDocument()
  })

  it('대소문자를 구분하지 않는다', async () => {
    const user = userEvent.setup()
    render(<OssList rows={makeNamedRows('Lodash', 'axios')} />)

    await user.type(screen.getByLabelText('OSS Name 검색'), 'LODASH')

    expect(screen.getByText('Lodash')).toBeInTheDocument()
    expect(screen.queryByText('axios')).not.toBeInTheDocument()
  })

  it('검색 결과 개수를 표시한다', async () => {
    const user = userEvent.setup()
    render(<OssList rows={makeNamedRows('react', 'react-dom', 'vue')} />)

    await user.type(screen.getByLabelText('OSS Name 검색'), 'react')

    expect(screen.getByText('2건')).toBeInTheDocument()
  })

  it('검색어를 지우면 전체 목록으로 돌아온다', async () => {
    const user = userEvent.setup()
    render(<OssList rows={makeNamedRows('lodash', 'axios')} />)

    const input = screen.getByLabelText('OSS Name 검색')
    await user.type(input, 'lodash')
    expect(screen.queryByText('axios')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '검색어 지우기' }))

    expect(screen.getByText('axios')).toBeInTheDocument()
    expect(screen.getByText('lodash')).toBeInTheDocument()
  })

  it('검색하면 첫 페이지로 돌아간다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('page=2')
    render(<OssList rows={makeNamedRows('lodash', 'axios')} />)

    await user.type(screen.getByLabelText('OSS Name 검색'), 'a')

    expect(mockReplace).toHaveBeenCalledWith('?', { scroll: false })
  })

  it('검색 중에는 배치 버튼이 검색 결과만 처리함을 알린다', async () => {
    const user = userEvent.setup()
    render(<OssList rows={makeNamedRows('lodash', 'axios', 'react')} />)

    expect(screen.getByRole('button', { name: '전체 기여' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('OSS Name 검색'), 'react')

    expect(screen.getByRole('button', { name: '검색 결과 기여 (1건)' })).toBeInTheDocument()
  })

  it('검색 중 배치 기여는 걸러진 항목만 처리한다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_NOT_FOUND)
    mockFetchCreateOss.mockResolvedValue({
      success: true,
      data: { oss_master_id: 200, name: 'react', purl: '', reviewed: 0 },
    })
    mockFetchOssVersions.mockResolvedValue(VERSION_NOT_FOUND)
    mockFetchCreateOssVersion.mockResolvedValue({ success: true, data: { oss_version_id: 1 } })

    render(<OssList rows={makeNamedRows('lodash', 'axios', 'react')} />)
    await user.type(screen.getByLabelText('OSS Name 검색'), 'react')
    await user.click(screen.getByRole('button', { name: '검색 결과 기여 (1건)' }))

    await waitFor(() => {
      expect(screen.getByText('완료')).toBeInTheDocument()
    })
    expect(mockFetchCreateOss).toHaveBeenCalledTimes(1)
    expect(mockFetchCreateOss.mock.calls[0][1]).toMatchObject({ name: 'react' })
  })

  it('검색으로 걸러도 기여 상태가 원래 행에 유지된다', async () => {
    const user = userEvent.setup()
    mockFetchOssList.mockResolvedValue(OSS_FOUND)
    mockFetchOssVersions.mockResolvedValue(VERSION_FOUND)

    render(<OssList rows={makeNamedRows('lodash', 'axios')} />)

    // axios만 남기고 기여하기 클릭 → "이미 존재함"
    await user.type(screen.getByLabelText('OSS Name 검색'), 'axios')
    await user.click(screen.getByRole('button', { name: '기여하기' }))
    await waitFor(() => {
      expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    })

    // 검색을 지워도 axios만 "이미 존재함"이고 lodash는 기여 가능해야 한다
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }))

    expect(screen.getByText('이미 존재함')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '기여하기' })).toBeInTheDocument()
  })
})
