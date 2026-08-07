'use client'

import { useEffect, useState } from 'react'

/**
 * 값이 delay 동안 더 바뀌지 않을 때만 갱신된 값을 돌려준다.
 *
 * 입력창처럼 타이핑마다 값이 바뀌는 곳에서, 매 글자마다 라우터 전환이나 재계산을
 * 일으키지 않기 위해 사용한다.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
