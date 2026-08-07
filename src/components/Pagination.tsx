'use client'

import { useMemo } from 'react'

interface PaginationProps {
  readonly totalCount: number
  readonly currentPage: number
  readonly pageSize: number
  readonly onPageChange: (page: number) => void
  /** 지정하면 페이지당 표시 개수를 고를 수 있다. */
  readonly pageSizeOptions?: readonly number[]
  readonly onPageSizeChange?: (size: number) => void
}

const MAX_VISIBLE_PAGES = 5

function getPageNumbers(currentPage: number, totalPages: number): readonly (number | '...')[] {
  if (totalPages <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const half = Math.floor(MAX_VISIBLE_PAGES / 2)
  let start = currentPage - half
  let end = currentPage + half

  if (start < 1) {
    start = 1
    end = MAX_VISIBLE_PAGES
  }

  if (end > totalPages) {
    end = totalPages
    start = totalPages - MAX_VISIBLE_PAGES + 1
  }

  const pages: (number | '...')[] = []

  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('...')
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...')
    pages.push(totalPages)
  }

  return pages
}

const BTN_BASE = 'inline-flex items-center justify-center h-8 min-w-8 px-2 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
const BTN_DEFAULT = `${BTN_BASE} border-gray-200 text-gray-600 hover:bg-gray-50`
const BTN_ACTIVE = `${BTN_BASE} border-olive-500 bg-olive-500 text-white`

export default function Pagination({
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const pages = useMemo(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  )

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalCount)

  if (totalCount === 0) return null

  return (
    <div className="flex items-center justify-between pt-3">
      <div className="flex items-center gap-3">
        <p className="text-xs text-gray-500">
          총 {totalCount.toLocaleString()}건 중 {startItem.toLocaleString()}-{endItem.toLocaleString()}
        </p>
        {pageSizeOptions && onPageSizeChange && (
          <select
            // id 대신 aria-label을 쓴다. 두 탭이 동시에 마운트되므로 id가 중복된다.
            aria-label="페이지당 표시 개수"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-gray-200 px-2 text-xs text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none focus:border-olive-500 focus:ring-2 focus:ring-olive-500/30"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}개씩
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={BTN_DEFAULT}
          aria-label="이전 페이지"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="inline-flex items-center justify-center h-8 min-w-8 text-xs text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={page === currentPage ? BTN_ACTIVE : BTN_DEFAULT}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={BTN_DEFAULT}
          aria-label="다음 페이지"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
