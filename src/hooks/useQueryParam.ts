'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface UseQueryParamReturn {
  readonly query: string
  readonly setQuery: (next: string) => void
}

/**
 * 검색어를 URL 쿼리 파라미터로 관리한다.
 *
 * 파라미터 이름을 목록마다 다르게 받는 이유: 두 탭이 동시에 마운트되어 있으므로
 * 이름을 공유하면 한쪽 검색이 다른 목록까지 걸러낸다.
 *
 * 검색은 히스토리에 쌓지 않는다(replace). 한 글자씩 되돌아가는 뒤로가기는
 * 도움이 되기보다 성가시다.
 */
export function useQueryParam(paramName: string): UseQueryParamReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  const query = searchParams.get(paramName) ?? ''

  const setQuery = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const trimmed = next.trim()

      if (trimmed) {
        params.set(paramName, trimmed)
      } else {
        params.delete(paramName)
      }
      // 결과 개수가 달라지므로 첫 페이지부터 다시 본다.
      params.delete('page')

      const queryString = params.toString()
      router.replace(queryString ? `?${queryString}` : '?', { scroll: false })
    },
    [router, searchParams, paramName],
  )

  return { query, setQuery }
}
