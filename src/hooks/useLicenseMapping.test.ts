import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLicenseMapping } from './useLicenseMapping'

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

// Mock fetchLicenses
const mockFetchLicenses = vi.fn()
vi.mock('@/lib/api-client', () => ({
  fetchLicenses: (...args: unknown[]) => mockFetchLicenses(...args),
}))

beforeEach(() => {
  mockFetchLicenses.mockReset()
})

describe('useLicenseMapping', () => {
  it('빈 이름 배열이면 API를 호출하지 않는다', () => {
    renderHook(() => useLicenseMapping([]))

    expect(mockFetchLicenses).not.toHaveBeenCalled()
  })

  it('각 고유 라이선스 이름에 대해 API를 호출한다', async () => {
    mockFetchLicenses.mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'MIT' }],
    })

    renderHook(() => useLicenseMapping(['MIT', 'Apache-2.0']))

    await waitFor(() => {
      expect(mockFetchLicenses).toHaveBeenCalledTimes(2)
    })

    expect(mockFetchLicenses).toHaveBeenCalledWith('test-token', 'Apache-2.0', 0, 1, true)
    expect(mockFetchLicenses).toHaveBeenCalledWith('test-token', 'MIT', 0, 1, true)
  })

  it('중복된 이름은 한번만 조회한다', async () => {
    mockFetchLicenses.mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'MIT' }],
    })

    renderHook(() => useLicenseMapping(['MIT', 'MIT', 'MIT']))

    await waitFor(() => {
      expect(mockFetchLicenses).toHaveBeenCalledTimes(1)
    })
  })

  it('조회 결과를 licenseMap에 매핑한다', async () => {
    mockFetchLicenses
      .mockResolvedValueOnce({ success: true, data: [{ id: 10, name: 'Apache-2.0' }] })
      .mockResolvedValueOnce({ success: true, data: [{ id: 5, name: 'MIT' }] })

    const { result } = renderHook(() => useLicenseMapping(['Apache-2.0', 'MIT']))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.licenseMap.get('Apache-2.0')).toBe(10)
    expect(result.current.licenseMap.get('MIT')).toBe(5)
  })

  it('조회 결과가 없으면 null로 매핑한다', async () => {
    mockFetchLicenses.mockResolvedValue({ success: true, data: [] })

    const { result } = renderHook(() => useLicenseMapping(['Unknown-License']))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.licenseMap.get('Unknown-License')).toBeNull()
  })

  it('mapNamesToIds가 매핑된 ID만 반환한다', async () => {
    mockFetchLicenses
      .mockResolvedValueOnce({ success: true, data: [{ id: 10, name: 'Apache-2.0' }] })
      .mockResolvedValueOnce({ success: true, data: [] }) // MIT not found

    const { result } = renderHook(() => useLicenseMapping(['Apache-2.0', 'MIT']))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const ids = result.current.mapNamesToIds(['Apache-2.0', 'MIT'])
    expect(ids).toEqual([10])
  })

  it('API 실패 시 해당 이름을 null로 매핑한다', async () => {
    // 이름은 정렬됨: GPL-3.0, MIT 순서
    mockFetchLicenses
      .mockRejectedValueOnce(new Error('Network error'))  // GPL-3.0
      .mockResolvedValueOnce({ success: true, data: [{ id: 5, name: 'MIT' }] })  // MIT

    const { result } = renderHook(() => useLicenseMapping(['GPL-3.0', 'MIT']))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.licenseMap.get('GPL-3.0')).toBeNull()
    expect(result.current.licenseMap.get('MIT')).toBe(5)
  })

  it('로딩 상태가 올바르게 전환된다', async () => {
    mockFetchLicenses.mockResolvedValue({ success: true, data: [{ id: 1, name: 'MIT' }] })

    const { result } = renderHook(() => useLicenseMapping(['MIT']))

    // 처음에는 로딩 중
    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })
})
