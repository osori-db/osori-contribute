'use client'

interface ErrorMessageProps {
  readonly message: string
  readonly onRetry?: () => void
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
