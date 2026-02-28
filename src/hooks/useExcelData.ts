'use client'

import { useState, useCallback } from 'react'
import { parseExcelFile, isValidExcelFile } from '@/lib/excel-parser'
import type { ExcelData } from '@/lib/types'

interface UseExcelDataReturn {
  readonly excelData: ExcelData | null
  readonly loading: boolean
  readonly error: string | null
  readonly handleFile: (file: File) => Promise<void>
  readonly clearData: () => void
}

export function useExcelData(): UseExcelDataReturn {
  const [excelData, setExcelData] = useState<ExcelData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!isValidExcelFile(file)) {
      setError('지원하지 않는 파일 형식입니다. .xlsx 또는 .xls 파일을 업로드해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await parseExcelFile(file)
      setExcelData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리에 실패했습니다.')
      setExcelData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const clearData = useCallback(() => {
    setExcelData(null)
    setError(null)
  }, [])

  return { excelData, loading, error, handleFile, clearData }
}
