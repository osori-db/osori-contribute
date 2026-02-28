'use client'

import { useState, useCallback, useRef } from 'react'

interface ExcelUploaderProps {
  readonly onFileSelect: (file: File) => void
  readonly loading: boolean
  readonly fileName?: string
  readonly onClear: () => void
}

export default function ExcelUploader({ onFileSelect, loading, fileName, onClear }: ExcelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [onFileSelect])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  if (fileName) {
    return (
      <div className="flex items-center justify-between bg-olive-50 border border-olive-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-olive-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-olive-700">{fileName}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          파일 제거
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragging
          ? 'border-olive-400 bg-olive-50'
          : 'border-gray-300 hover:border-olive-300 hover:bg-gray-50'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileInput}
        className="hidden"
      />
      {loading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-olive-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">파일을 처리하고 있습니다...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-600">
            엑셀 파일을 드래그하여 놓거나 <span className="text-olive-500 font-medium">클릭하여 선택</span>하세요
          </p>
          <p className="text-xs text-gray-400">.xlsx, .xls 파일만 지원합니다</p>
        </div>
      )}
    </div>
  )
}
