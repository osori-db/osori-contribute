import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLicenseMapping } from './useLicenseMapping'

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

// Mock fetchAllLicenses
const mockFetchAllLicenses = vi.fn()
vi.mock('@/lib/api-client', () => ({
  fetchAllLicenses: (...args: unknown[]) => mockFetchAllLicenses(...args),
}))

beforeEach(() => {
  mockFetchAllLicenses.mockReset()
})

describe('useLicenseMapping', () => {
  it('마운트 시 전체 라이선스 목록을 조회한다', async () => {
    mockFetchAllLicenses.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'MIT', spdx_identifier: 'MIT' },
        { id: 10, name: 'Apache License 2.0', spdx_identifier: 'Apache-2.0' },
      ],
    })

    const { result } = renderHook(() => useLicenseMapping())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFetchAllLicenses).toHaveBeenCalledTimes(1)
    expect(mockFetchAllLicenses).toHaveBeenCalledWith('test-token')
  })

  it('name과 spdx_identifier 모두로 매핑된 licenseMap을 구축한다', async () => {
    mockFetchAllLicenses.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'MIT', spdx_identifier: 'MIT' },
        { id: 10, name: 'Apache License 2.0', spdx_identifier: 'Apache-2.0' },
      ],
    })

    const { result } = renderHook(() => useLicenseMapping())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // spdx_identifier로 조회
    expect(result.current.licenseMap.get('Apache-2.0')).toBe(10)
    expect(result.current.licenseMap.get('MIT')).toBe(1)
    // name(소문자)으로 조회
    expect(result.current.licenseMap.get('apache license 2.0')).toBe(10)
    expect(result.current.licenseMap.get('mit')).toBe(1)
  })

  it('mapNamesToIds가 spdx_identifier 우선으로 ID를 반환한다', async () => {
    mockFetchAllLicenses.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'MIT', spdx_identifier: 'MIT' },
        { id: 10, name: 'Apache License 2.0', spdx_identifier: 'Apache-2.0' },
      ],
    })

    const { result } = renderHook(() => useLicenseMapping())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const ids = result.current.mapNamesToIds(['Apache-2.0', 'MIT'])
    expect(ids).toEqual([10, 1])
  })

  it('mapNamesToIds가 매핑되지 않은 이름은 무시한다', async () => {
    mockFetchAllLicenses.mockResolvedValue({
      success: true,
      data: [
        { id: 10, name: 'Apache License 2.0', spdx_identifier: 'Apache-2.0' },
      ],
    })

    const { result } = renderHook(() => useLicenseMapping())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const ids = result.current.mapNamesToIds(['Apache-2.0', 'Unknown-License'])
    expect(ids).toEqual([10])
  })

  it('hasLicense가 spdx_identifier로 존재 여부를 확인한다', async () => {
    mockFetchAllLicenses.mockResolvedValue({
      success: true,
      data: [
        { id: 10, name: 'Apache License 2.0', spdx_identifier: 'Apache-2.0' },
      ],
    })

    const { result } = renderHook(() => useLicenseMapping())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.hasLicense('Apache-2.0')).toBe(true)
    expect(result.current.hasLicense('GPL-3.0')).toBe(false)
  })

  it('hasLicense가 name으로도 존재 여부를 확인한다', async () => {
    mockFetchAllLicenses.mockResolvedValue({
      success: true,
      data: [
        { id: 10, name: 'Apache License 2.0', spdx_identifier: 'Apache-2.0' },
      ],
    })

    const { result } = renderHook(() => useLicenseMapping())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.hasLicense('Apache License 2.0')).toBe(true)
    expect(result.current.hasLicense('apache license 2.0')).toBe(true)
  })

  it('API 실패 시 에러 메시지를 설정한다', async () => {
    mockFetchAllLicenses.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useLicenseMapping())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('라이선스 목록 조회 중 오류가 발생했습니다.')
  })

  it('로딩 상태가 올바르게 전환된다', async () => {
    mockFetchAllLicenses.mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'MIT', spdx_identifier: 'MIT' }],
    })

    const { result } = renderHook(() => useLicenseMapping())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('spdx_identifier가 없는 라이선스는 name으로만 매핑된다', async () => {
    mockFetchAllLicenses.mockResolvedValue({
      success: true,
      data: [
        { id: 5, name: 'Custom License', spdx_identifier: null },
      ],
    })

    const { result } = renderHook(() => useLicenseMapping())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.licenseMap.get('custom license')).toBe(5)
    expect(result.current.hasLicense('Custom License')).toBe(true)
  })
})
