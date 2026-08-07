'use client'

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const PAGE_PARAM = 'page'

interface UsePageParamReturn {
  /** 1 이상, 마지막 페이지 이하로 보정된 현재 페이지 */
  readonly page: number
  /** 페이지 이동. 히스토리에 쌓여 뒤로가기로 되돌아갈 수 있다. */
  readonly setPage: (next: number) => void
  /** 목록 자체가 바뀌었을 때 1페이지로. 사용자 이동이 아니므로 히스토리를 남기지 않는다. */
  readonly resetPage: () => void
}

/** URL 파라미터는 사용자가 직접 입력할 수 있으므로 정수가 아니면 1로 취급한다. */
function parsePage(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}

/**
 * 페이지 번호를 URL 쿼리 파라미터(`?page=`)로 관리한다.
 *
 * 페이지를 로컬 상태가 아니라 URL에서 파생시키므로 뒤로/앞으로 가기가 그대로 동작하고,
 * 같은 화면을 링크로 가리킬 수 있다.
 */
export function usePageParam(totalPages: number): UsePageParamReturn {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 항목이 줄어 존재하지 않는 페이지를 가리키게 되면 마지막 페이지를 보여준다.
  const page = useMemo(() => {
    const requested = parsePage(searchParams.get(PAGE_PARAM))
    return Math.min(requested, Math.max(totalPages, 1))
  }, [searchParams, totalPages])

  const buildHref = useCallback(
    (next: number): string => {
      const params = new URLSearchParams(searchParams.toString())
      // 1페이지는 기본값이므로 파라미터를 붙이지 않아 URL을 깔끔하게 유지한다.
      if (next <= 1) {
        params.delete(PAGE_PARAM)
      } else {
        params.set(PAGE_PARAM, String(next))
      }
      const query = params.toString()
      return query ? `?${query}` : '?'
    },
    [searchParams],
  )

  const setPage = useCallback(
    (next: number) => {
      router.push(buildHref(next), { scroll: false })
    },
    [router, buildHref],
  )

  const resetPage = useCallback(() => {
    router.replace(buildHref(1), { scroll: false })
  }, [router, buildHref])

  return { page, setPage, resetPage }
}
