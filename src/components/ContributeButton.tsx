'use client'

import type { ContributeStatus } from '@/lib/types'

interface ContributeButtonProps {
  readonly status: ContributeStatus
  readonly onClick: () => void
  readonly disabled?: boolean
}

export default function ContributeButton({ status, onClick, disabled = false }: ContributeButtonProps) {
  if (status === 'exists') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
        이미 존재함
      </span>
    )
  }

  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-full">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        완료
      </span>
    )
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-full hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        재시도
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || status === 'loading'}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-olive-500 rounded-full hover:bg-olive-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {status === 'loading' ? (
        <>
          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          처리중
        </>
      ) : (
        '기여하기'
      )}
    </button>
  )
}
