'use client'

import { useState, useCallback } from 'react'
import { parseOssExcel } from '@/lib/oss-parser'
import { isValidExcelFile } from '@/lib/excel-parser'
import { OSS_SAMPLE_DATA } from '@/lib/oss-sample-data'
import type { OssData } from '@/lib/types'

interface UseOssDataReturn {
  readonly ossData: OssData
  readonly loading: boolean
  readonly error: string | null
  readonly handleFile: (file: File) => Promise<void>
  readonly clearData: () => void
  readonly isUsingSample: boolean
}

const SAMPLE_OSS_DATA: OssData = {
  rows: OSS_SAMPLE_DATA,
  fileName: '',
}

export function useOssData(): UseOssDataReturn {
  const [ossData, setOssData] = useState<OssData>(SAMPLE_OSS_DATA)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isUsingSample = ossData.fileName === ''

  const handleFile = useCallback(async (file: File) => {
    if (!isValidExcelFile(file)) {
      setError('지원하지 않는 파일 형식입니다. .xlsx 또는 .xls 파일을 업로드해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await parseOssExcel(file)
      setOssData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const clearData = useCallback(() => {
    setOssData(SAMPLE_OSS_DATA)
    setError(null)
  }, [])

  return { ossData, loading, error, handleFile, clearData, isUsingSample }
}
