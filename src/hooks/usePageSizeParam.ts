'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export const PAGE_SIZE_OPTIONS: readonly number[] = [20, 50, 100, 200]
export const DEFAULT_PAGE_SIZE = 20

interface UsePageSizeParamReturn {
  readonly pageSize: number
  readonly setPageSize: (next: number) => void
}

/**
 * 페이지당 표시 개수를 URL 쿼리 파라미터로 관리한다.
 *
 * 파라미터 이름을 목록마다 다르게 받는 이유: 두 탭이 동시에 마운트되어 있으므로
 * 이름을 공유하면 한쪽에서 바꾼 개수가 다른 탭에도 그대로 적용된다.
 */
export function usePageSizeParam(paramName: string): UsePageSizeParamReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 파라미터는 사용자가 직접 입력할 수 있으므로 허용된 값만 받아들인다.
  // 임의의 큰 값을 허용하면 한 번에 수만 행을 렌더하게 된다.
  const requested = Number.parseInt(searchParams.get(paramName) ?? '', 10)
  const pageSize = PAGE_SIZE_OPTIONS.includes(requested) ? requested : DEFAULT_PAGE_SIZE

  const setPageSize = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString())

      if (next === DEFAULT_PAGE_SIZE) {
        params.delete(paramName)
      } else {
        params.set(paramName, String(next))
      }
      // 개수가 바뀌면 같은 페이지 번호가 가리키는 항목이 달라지므로 처음부터 다시 본다.
      params.delete('page')

      const queryString = params.toString()
      router.replace(queryString ? `?${queryString}` : '?', { scroll: false })
    },
    [router, searchParams, paramName],
  )

  return { pageSize, setPageSize }
}
