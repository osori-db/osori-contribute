'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { fetchLicenses } from '@/lib/api-client'

interface UseLicenseMappingReturn {
  readonly licenseMap: ReadonlyMap<string, number | null>
  readonly loading: boolean
  readonly error: string | null
  readonly mapNamesToIds: (names: readonly string[]) => readonly number[]
}

export function useLicenseMapping(names: readonly string[]): UseLicenseMappingReturn {
  const { token } = useAuth()
  const [licenseMap, setLicenseMap] = useState<ReadonlyMap<string, number | null>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const namesKey = useMemo(() => {
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort()
    return unique.join('\0')
  }, [names])

  useEffect(() => {
    const namesToFetch = namesKey ? namesKey.split('\0') : []
    if (!token || namesToFetch.length === 0) {
      setLicenseMap(new Map())
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.allSettled(
      namesToFetch.map((name) => fetchLicenses(token, name, 0, 1, true)),
    )
      .then((results) => {
        if (cancelled) return

        const map = new Map<string, number | null>()
        results.forEach((result, i) => {
          const name = namesToFetch[i]
          if (
            result.status === 'fulfilled' &&
            result.value.success &&
            result.value.data &&
            result.value.data.length > 0
          ) {
            map.set(name, result.value.data[0].id)
          } else {
            map.set(name, null)
          }
        })

        setLicenseMap(map)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError('라이선스 매핑 조회 중 오류가 발생했습니다.')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [token, namesKey])

  const mapNamesToIds = useCallback(
    (inputNames: readonly string[]): readonly number[] => {
      const ids: number[] = []
      for (const name of inputNames) {
        const id = licenseMap.get(name.trim())
        if (id !== undefined && id !== null) {
          ids.push(id)
        }
      }
      return [...new Set(ids)]
    },
    [licenseMap],
  )

  return { licenseMap, loading, error, mapNamesToIds }
}
