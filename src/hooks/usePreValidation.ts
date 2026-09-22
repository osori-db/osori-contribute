'use client'

import { useCallback, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { checkUrls } from '@/lib/api-client'
import { MAX_URLS_PER_REQUEST } from '@/lib/url-check'
import { toRowValidationResult } from '@/lib/pre-validation'
import type { UrlCheckResult } from '@/lib/url-check'
import type { RowValidationResult, UrlCheckMap } from '@/lib/pre-validation'
import type { FieldHints } from '@/lib/field-hints'

export interface IndexedRow<T> {
  readonly row: T
  readonly index: number
}

export interface UsePreValidationOptions<T> {
  /** 규칙 1 대상 URL 추출 */
  readonly collectUrls: (row: T) => readonly string[]
  /** URL 결과를 받아 행 전체 힌트를 만든다 (pre-validation.ts 의 build*RowHints 를 감싼 것) */
  readonly buildHints: (row: T, urlResults?: UrlCheckMap) => FieldHints
}

export interface UsePreValidationReturn<T> {
  /** 전역 행 인덱스 → 결과. 검증 안 했거나 무효화된 행은 키가 없다. */
  readonly results: Readonly<Record<number, RowValidationResult>>
  readonly running: boolean
  readonly progress: { readonly current: number; readonly total: number }
  readonly error: string | null
  /** filteredRows 를 그대로 넘긴다. URL 은 전량 중복 제거 후 청크로 나눠 요청한다. */
  readonly validate: (targets: readonly IndexedRow<T>[]) => Promise<void>
  /** 행 수정 시 호출 — 해당 행 결과를 버린다 */
  readonly invalidate: (index: number) => void
  /** 새 파일 업로드 시 호출 — 결과·URL 캐시 전부 비움 */
  readonly reset: () => void
  /** 저장된 결과가 없을 때 오프라인 규칙만으로 힌트를 만든다 ([전체 기여] 경로용) */
  readonly hintsFor: (row: T, index: number) => FieldHints
}

function chunkUrls(urls: readonly string[], size: number): readonly (readonly string[])[] {
  const chunks: string[][] = []
  for (let i = 0; i < urls.length; i += size) {
    chunks.push(urls.slice(i, i + size))
  }
  return chunks
}

/**
 * 사전 검증 실행과 그 결과 보관을 담당한다.
 *
 * URL 접속 검사는 비용이 크므로 세션 내내 유지되는 캐시에 URL 단위로 모아 두고,
 * 행 수정(invalidate)·새 파일 업로드(reset)로만 결과를 버린다.
 */
export function usePreValidation<T>({
  collectUrls,
  buildHints,
}: UsePreValidationOptions<T>): UsePreValidationReturn<T> {
  const { token } = useAuth()
  const [results, setResults] = useState<Readonly<Record<number, RowValidationResult>>>({})
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  // url → 검사 결과. 같은 URL 을 여러 행이 공유하므로 요청 횟수를 크게 줄인다.
  const urlCacheRef = useRef<Map<string, UrlCheckResult>>(new Map())
  // 실행 중 재진입 차단. running 을 의존성에 넣으면 validate 참조가 매번 바뀐다.
  const runningRef = useRef(false)

  const validate = useCallback(
    async (targets: readonly IndexedRow<T>[]): Promise<void> => {
      if (runningRef.current) return
      if (!token) {
        setError('인증 토큰이 필요합니다.')
        return
      }

      runningRef.current = true
      setRunning(true)
      setError(null)

      try {
        const cache = urlCacheRef.current
        const uniqueUrls = new Set<string>()
        for (const { row } of targets) {
          for (const url of collectUrls(row)) uniqueUrls.add(url)
        }
        const pending = [...uniqueUrls].filter((url) => !cache.has(url))

        setProgress({ current: 0, total: pending.length })

        // 청크 하나가 실패해도 나머지는 계속 검사한다 — 부분 결과가 전무한 것보다 낫다.
        let failureReason: string | null = null
        for (const chunk of chunkUrls(pending, MAX_URLS_PER_REQUEST)) {
          try {
            const response = await checkUrls(token, chunk)
            if (response.success && response.data) {
              for (const result of response.data.results) {
                cache.set(result.url, result)
              }
            } else {
              failureReason = response.error ?? 'URL 검사에 실패했습니다.'
            }
          } catch (err) {
            failureReason = err instanceof Error ? err.message : 'URL 검사 중 오류가 발생했습니다.'
          }
          setProgress((prev) => ({ ...prev, current: prev.current + chunk.length }))
        }

        const next: Record<number, RowValidationResult> = {}
        for (const { row, index } of targets) {
          const resolved = new Map<string, UrlCheckResult>()
          let urlChecked = true
          for (const url of collectUrls(row)) {
            const result = cache.get(url)
            if (result) resolved.set(url, result)
            else urlChecked = false
          }
          // 한 건이라도 검사하지 못했으면 URL 규칙 전체를 건너뛴다 — 반쪽 결과로 차단하지 않는다.
          const hints = buildHints(row, urlChecked ? resolved : undefined)
          next[index] = toRowValidationResult(hints, urlChecked)
        }

        setResults((prev) => ({ ...prev, ...next }))
        if (failureReason) {
          setError(`일부 URL을 검사하지 못했습니다: ${failureReason}`)
        }
      } finally {
        runningRef.current = false
        setRunning(false)
      }
    },
    [token, collectUrls, buildHints],
  )

  const invalidate = useCallback((index: number) => {
    setResults((prev) => {
      if (!(index in prev)) return prev
      const next = { ...prev }
      delete next[index]
      return next
    })
  }, [])

  const reset = useCallback(() => {
    urlCacheRef.current = new Map()
    setResults({})
    setProgress({ current: 0, total: 0 })
    setError(null)
  }, [])

  const hintsFor = useCallback(
    (row: T, index: number): FieldHints => results[index]?.hints ?? buildHints(row, undefined),
    [results, buildHints],
  )

  return { results, running, progress, error, validate, invalidate, reset, hintsFor }
}
