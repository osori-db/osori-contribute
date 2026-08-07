'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PAGE_PARAM, SEARCH_PARAM } from '@/lib/view-params'

interface UseQueryParamReturn {
  readonly query: string
  readonly setQuery: (next: string) => void
}

/**
 * 검색어를 URL 쿼리 파라미터(`?q=`)로 관리한다.
 *
 * 두 탭이 동시에 마운트되어 있으므로 숨겨진 탭의 목록도 같은 값으로 걸러지지만,
 * 보이지 않으므로 문제가 되지 않는다. 탭을 전환할 때 HomeView가 값을 갈아끼운다.
 *
 * 검색은 히스토리에 쌓지 않는다(replace). 한 글자씩 되돌아가는 뒤로가기는
 * 도움이 되기보다 성가시다.
 */
export function useQueryParam(): UseQueryParamReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  const query = searchParams.get(SEARCH_PARAM) ?? ''

  const setQuery = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const trimmed = next.trim()

      if (trimmed) {
        params.set(SEARCH_PARAM, trimmed)
      } else {
        params.delete(SEARCH_PARAM)
      }
      // 결과 개수가 달라지므로 첫 페이지부터 다시 본다.
      params.delete(PAGE_PARAM)

      const queryString = params.toString()
      router.replace(queryString ? `?${queryString}` : '?', { scroll: false })
    },
    [router, searchParams],
  )

  return { query, setQuery }
}
