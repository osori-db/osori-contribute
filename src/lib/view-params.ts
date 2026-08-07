import type { ContributeType } from './types'

/** 탭은 경로로 구분한다. `/license`, `/oss` */
export const TAB_PATHS: Readonly<Record<ContributeType, string>> = {
  license: '/license',
  oss: '/oss',
}

export const DEFAULT_TAB: ContributeType = 'license'
export const DEFAULT_TAB_PATH = TAB_PATHS[DEFAULT_TAB]

/** 경로에서 탭을 읽는다. 알 수 없는 경로는 기본 탭으로 취급한다. */
export function parseTabFromPathname(pathname: string): ContributeType {
  return pathname === TAB_PATHS.oss ? 'oss' : DEFAULT_TAB
}

/**
 * URL 쿼리 파라미터 이름.
 *
 * 목록 상태(검색어·표시 개수·페이지)는 탭마다 다르지만 파라미터 이름은 공유한다.
 * URL에는 항상 **보고 있는 탭의 값만** 남고, 탭을 전환할 때 HomeView가 떠나는 탭의
 * 값을 기억했다가 돌아올 때 복원한다. 덕분에 `/oss?q=react&size=100` 처럼
 * 어느 탭을 보든 같은 모양의 URL이 유지된다.
 */
export const SEARCH_PARAM = 'q'
export const SIZE_PARAM = 'size'
export const PAGE_PARAM = 'page'

/** 탭을 전환할 때 값을 갈아끼워야 하는 파라미터들. */
export const TAB_SCOPED_PARAMS: readonly string[] = [SEARCH_PARAM, SIZE_PARAM, PAGE_PARAM]
