import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomeView from './HomeView'

// ─── Mocks ───

const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}))

let mockAuthenticated = true
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated, token: 'test-token' }),
}))

vi.mock('./LicenseTab', () => ({ default: () => <div>라이선스 탭 내용</div> }))
vi.mock('./OssTab', () => ({ default: () => <div>OSS 탭 내용</div> }))
vi.mock('./AuthTokenInput', () => ({ default: () => <div>토큰 입력</div> }))
vi.mock('./Header', () => ({ default: () => <div>헤더</div> }))

beforeEach(() => {
  mockPush.mockReset()
  mockSearchParams = new URLSearchParams()
  mockAuthenticated = true
})

// ─── Tests ───

describe('HomeView 탭 URL 파라미터', () => {
  it('tab 파라미터가 없으면 라이선스 탭을 보여준다', () => {
    render(<HomeView />)

    expect(screen.getByText('라이선스 탭 내용')).toBeVisible()
    expect(screen.getByText('OSS 탭 내용')).not.toBeVisible()
  })

  it('tab=oss면 OSS 탭을 보여준다', () => {
    mockSearchParams = new URLSearchParams('tab=oss')
    render(<HomeView />)

    expect(screen.getByText('OSS 탭 내용')).toBeVisible()
    expect(screen.getByText('라이선스 탭 내용')).not.toBeVisible()
  })

  it('알 수 없는 tab 값은 라이선스 탭으로 취급한다', () => {
    mockSearchParams = new URLSearchParams('tab=drop-table')
    render(<HomeView />)

    expect(screen.getByText('라이선스 탭 내용')).toBeVisible()
  })

  it('비활성 탭도 언마운트하지 않아 데이터가 유지된다', () => {
    mockSearchParams = new URLSearchParams('tab=oss')
    render(<HomeView />)

    // 숨겨져 있을 뿐 DOM에는 남아 있어야 상태가 보존된다
    expect(screen.getByText('라이선스 탭 내용')).toBeInTheDocument()
  })

  it('탭을 바꾸면 URL에 tab 파라미터를 남긴다', async () => {
    const user = userEvent.setup()
    render(<HomeView />)

    await user.click(screen.getByRole('button', { name: 'OSS' }))

    expect(mockPush).toHaveBeenCalledWith('?tab=oss', { scroll: false })
  })

  it('탭을 바꾸면 이전 탭의 q/size/page를 물려받지 않는다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('tab=license&q=apache&size=100&page=5')
    render(<HomeView />)

    await user.click(screen.getByRole('button', { name: 'OSS' }))

    expect(mockPush).toHaveBeenCalledWith('?tab=oss', { scroll: false })
  })

  it('탭 스코프가 아닌 파라미터는 유지한다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('tab=license&debug=1')
    render(<HomeView />)

    await user.click(screen.getByRole('button', { name: 'OSS' }))

    expect(mockPush).toHaveBeenCalledWith('?tab=oss&debug=1', { scroll: false })
  })

  it('같은 탭을 다시 누르면 아무 일도 하지 않는다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('tab=license&q=apache')
    render(<HomeView />)

    await user.click(screen.getByRole('button', { name: '라이선스' }))

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('탭으로 돌아오면 마지막에 보던 q/size/page를 되돌린다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('tab=license&q=apache&size=100&page=3')
    const { rerender } = render(<HomeView />)

    // 라이선스 → OSS: 라이선스의 값이 보관되고 URL에서 사라진다
    await user.click(screen.getByRole('button', { name: 'OSS' }))
    expect(mockPush).toHaveBeenLastCalledWith('?tab=oss', { scroll: false })

    // 실제 라우팅을 흉내내어 URL을 반영한 뒤 OSS 탭에서 검색
    mockSearchParams = new URLSearchParams('tab=oss&q=react')
    rerender(<HomeView />)

    // OSS → 라이선스: 보관해둔 라이선스 값이 되돌아온다
    await user.click(screen.getByRole('button', { name: '라이선스' }))
    expect(mockPush).toHaveBeenLastCalledWith('?tab=license&q=apache&size=100&page=3', {
      scroll: false,
    })
  })

  it('인증 전에는 토큰 입력만 보여준다', () => {
    mockAuthenticated = false
    render(<HomeView />)

    expect(screen.getByText('토큰 입력')).toBeInTheDocument()
    expect(screen.queryByText('라이선스 탭 내용')).not.toBeInTheDocument()
    expect(screen.queryByText('OSS 탭 내용')).not.toBeInTheDocument()
  })
})
