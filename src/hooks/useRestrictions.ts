'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { fetchRestrictions } from '@/lib/api-client'
import type { OsoriRestriction } from '@/lib/osori-types'

interface UseRestrictionsReturn {
  readonly restrictions: readonly OsoriRestriction[]
  readonly loading: boolean
  readonly error: string | null
  readonly mapNamesToIds: (names: readonly string[]) => readonly number[]
}

export function useRestrictions(): UseRestrictionsReturn {
  const { token } = useAuth()
  const [restrictions, setRestrictions] = useState<readonly OsoriRestriction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchRestrictions(token)
      .then((result) => {
        if (cancelled) return
        if (result.success && result.data) {
          setRestrictions(result.data)
        } else {
          setError(result.error ?? 'Restriction 목록 조회에 실패했습니다.')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Restriction 목록 조회 중 오류가 발생했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [token])

  const nameToIdMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of restrictions) {
      map.set(r.name.toLowerCase().trim(), r.id)
    }
    return map
  }, [restrictions])

  const mapNamesToIds = useCallback(
    (names: readonly string[]): readonly number[] => {
      const ids: number[] = []
      for (const name of names) {
        const key = name.toLowerCase().trim()
        const id = nameToIdMap.get(key)
        if (id !== undefined) {
          ids.push(id)
        }
      }
      return [...new Set(ids)]
    },
    [nameToIdMap],
  )

  return { restrictions, loading, error, mapNamesToIds }
}
