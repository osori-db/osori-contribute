'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { fetchAllLicenses } from '@/lib/api-client'
import type { OsoriLicense } from '@/lib/osori-types'

interface UseLicenseMappingReturn {
  readonly licenses: readonly OsoriLicense[]
  readonly licenseMap: ReadonlyMap<string, number>
  readonly loading: boolean
  readonly error: string | null
  readonly mapNamesToIds: (names: readonly string[]) => readonly number[]
  readonly hasLicense: (spdxOrName: string) => boolean
}

/**
 * 전체 라이선스 목록을 한 번에 조회하여 name→id, spdx_identifier→id 맵을 구축한다.
 * useRestrictions 패턴과 동일하게 마운트 시 전체 목록을 가져온다.
 */
export function useLicenseMapping(): UseLicenseMappingReturn {
  const { token } = useAuth()
  const [licenses, setLicenses] = useState<readonly OsoriLicense[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchAllLicenses(token)
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setLicenses(result.data)
        } else {
          setError(result.error ?? '라이선스 목록 조회에 실패했습니다.')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('라이선스 목록 조회 중 오류가 발생했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [token])

  /** name(소문자) → id 맵 */
  const nameToIdMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const license of licenses) {
      map.set(license.name.toLowerCase().trim(), license.id)
    }
    return map
  }, [licenses])

  /** spdx_identifier → id 맵 */
  const spdxToIdMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const license of licenses) {
      if (license.spdx_identifier) {
        map.set(license.spdx_identifier.trim(), license.id)
      }
    }
    return map
  }, [licenses])

  /** name 또는 spdx_identifier → id 통합 맵 (spdx 우선) */
  const licenseMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const license of licenses) {
      map.set(license.name.toLowerCase().trim(), license.id)
      if (license.spdx_identifier) {
        map.set(license.spdx_identifier.trim(), license.id)
      }
    }
    return map
  }, [licenses])

  const mapNamesToIds = useCallback(
    (names: readonly string[]): readonly number[] => {
      const ids: number[] = []
      for (const name of names) {
        const trimmed = name.trim()
        // spdx_identifier로 먼저 찾고, 없으면 name(소문자)로 찾기
        const id = spdxToIdMap.get(trimmed) ?? nameToIdMap.get(trimmed.toLowerCase())
        if (id !== undefined) {
          ids.push(id)
        }
      }
      return [...new Set(ids)]
    },
    [spdxToIdMap, nameToIdMap],
  )

  const hasLicense = useCallback(
    (spdxOrName: string): boolean => {
      const trimmed = spdxOrName.trim()
      return spdxToIdMap.has(trimmed) || nameToIdMap.has(trimmed.toLowerCase())
    },
    [spdxToIdMap, nameToIdMap],
  )

  return { licenses, licenseMap, loading, error, mapNamesToIds, hasLicense }
}
