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

    expect(screen.getByText('라이선스 탭 내용')).toBeInTheDocument()
  })

  it('tab=oss면 OSS 탭을 보여준다', () => {
    mockSearchParams = new URLSearchParams('tab=oss')
    render(<HomeView />)

    expect(screen.getByText('OSS 탭 내용')).toBeInTheDocument()
    expect(screen.queryByText('라이선스 탭 내용')).not.toBeInTheDocument()
  })

  it('알 수 없는 tab 값은 라이선스 탭으로 취급한다', () => {
    mockSearchParams = new URLSearchParams('tab=drop-table')
    render(<HomeView />)

    expect(screen.getByText('라이선스 탭 내용')).toBeInTheDocument()
  })

  it('탭을 바꾸면 URL에 tab 파라미터를 남긴다', async () => {
    const user = userEvent.setup()
    render(<HomeView />)

    await user.click(screen.getByRole('button', { name: 'OSS' }))

    expect(mockPush).toHaveBeenCalledWith('?tab=oss', { scroll: false })
  })

  it('탭을 바꾸면 이전 탭의 page 파라미터를 물려받지 않는다', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('tab=license&page=5')
    render(<HomeView />)

    await user.click(screen.getByRole('button', { name: 'OSS' }))

    expect(mockPush).toHaveBeenCalledWith('?tab=oss', { scroll: false })
  })

  it('인증 전에는 토큰 입력만 보여준다', () => {
    mockAuthenticated = false
    render(<HomeView />)

    expect(screen.getByText('토큰 입력')).toBeInTheDocument()
    expect(screen.queryByText('라이선스 탭 내용')).not.toBeInTheDocument()
  })
})
