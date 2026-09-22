'use client'

interface PreValidateButtonProps {
  readonly running: boolean
  readonly progress: { readonly current: number; readonly total: number }
  /** 검증 대상 건수 (filteredRows.length) */
  readonly count: number
  readonly disabled: boolean
  readonly onClick: () => void
}

export default function PreValidateButton({
  running,
  progress,
  count,
  disabled,
  onClick,
}: PreValidateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || running}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {running ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          검증 중... ({progress.current}/{progress.total})
        </>
      ) : (
        `사전 검증 (${count}건)`
      )}
    </button>
  )
}
