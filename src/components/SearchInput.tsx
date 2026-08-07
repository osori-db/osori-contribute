'use client'

import { useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

/** 타이핑 한 글자마다 라우터를 전환하지 않기 위한 지연. */
const URL_SYNC_DELAY_MS = 200

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
  // 입력창은 즉시 반응해야 하므로 로컬 상태로 두고, URL 반영만 지연시킨다.
  const [text, setText] = useState(value)
  const debouncedText = useDebounce(text, URL_SYNC_DELAY_MS)

  // 이미 바깥(URL)에 반영된 값. 같은 값을 다시 보내 무한 루프가 나지 않게 한다.
  const appliedRef = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // 페이지 진입이나 외부 URL 변경으로 값이 바뀌면 입력창을 맞춘다.
  useEffect(() => {
    if (value === appliedRef.current) return
    appliedRef.current = value
    setText(value)
  }, [value])

  useEffect(() => {
    if (debouncedText === appliedRef.current) return
    appliedRef.current = debouncedText
    onChangeRef.current(debouncedText)
  }, [debouncedText])

  const handleClear = () => {
    // 지우기는 지연 없이 즉시 반영한다.
    setText('')
    appliedRef.current = ''
    onChange('')
  }

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
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          className="w-64 rounded-lg border border-gray-300 pl-8 pr-8 py-2 text-sm text-gray-900 placeholder:text-gray-300 transition-colors focus:outline-none focus:border-olive-500 focus:ring-2 focus:ring-olive-500/30"
        />
        {text && (
          <button
            type="button"
            onClick={handleClear}
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
