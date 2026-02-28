'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export default function AuthTokenInput() {
  const { setToken } = useAuth()
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (trimmed) {
      setToken(trimmed)
      setInputValue('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-olive-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">OSORI Contribute</h1>
            <p className="text-gray-500 mt-2 text-sm">
              오픈소스 기여를 위해 인증 토큰을 입력해주세요.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="API 인증 토큰"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-olive-400 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-full px-4 py-3 bg-olive-500 text-white text-sm font-medium rounded-lg hover:bg-olive-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              로그인
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
