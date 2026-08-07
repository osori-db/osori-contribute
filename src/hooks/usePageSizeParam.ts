'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const SIZE_PARAM = 'size'

export const PAGE_SIZE_OPTIONS: readonly number[] = [20, 50, 100, 200]
export const DEFAULT_PAGE_SIZE = 20

interface UsePageSizeParamReturn {
  readonly pageSize: number
  readonly setPageSize: (next: number) => void
}

/**
 * 페이지당 표시 개수를 URL 쿼리 파라미터(`?size=`)로 관리한다.
 *
 * 검색어와 달리 파라미터를 목록별로 나누지 않는다. 표시 개수는 특정 목록의 내용이
 * 아니라 보는 방식에 대한 선호이므로, 탭을 옮겨도 같은 설정이 유지되는 편이 자연스럽다.
 */
export function usePageSizeParam(): UsePageSizeParamReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 파라미터는 사용자가 직접 입력할 수 있으므로 허용된 값만 받아들인다.
  // 임의의 큰 값을 허용하면 한 번에 수만 행을 렌더하게 된다.
  const requested = Number.parseInt(searchParams.get(SIZE_PARAM) ?? '', 10)
  const pageSize = PAGE_SIZE_OPTIONS.includes(requested) ? requested : DEFAULT_PAGE_SIZE

  const setPageSize = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString())

      if (next === DEFAULT_PAGE_SIZE) {
        params.delete(SIZE_PARAM)
      } else {
        params.set(SIZE_PARAM, String(next))
      }
      // 개수가 바뀌면 같은 페이지 번호가 가리키는 항목이 달라지므로 처음부터 다시 본다.
      params.delete('page')

      const queryString = params.toString()
      router.replace(queryString ? `?${queryString}` : '?', { scroll: false })
    },
    [router, searchParams],
  )

  return { pageSize, setPageSize }
}
