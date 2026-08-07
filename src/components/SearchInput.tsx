'use client'

interface SearchInputProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly resultCount?: number
}

export default function SearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  resultCount,
}: SearchInputProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
          />
        </svg>
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-64 rounded-lg border border-gray-300 pl-8 pr-8 py-2 text-sm text-gray-900 placeholder:text-gray-300 transition-colors focus:outline-none focus:border-olive-500 focus:ring-2 focus:ring-olive-500/30"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="검색어 지우기"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            &times;
          </button>
        )}
      </div>
      {value && resultCount !== undefined && (
        <span className="text-xs text-gray-500">{resultCount}건</span>
      )}
    </div>
  )
}
