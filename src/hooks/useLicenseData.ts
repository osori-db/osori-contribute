'use client'

import { useState, useCallback } from 'react'
import { parseLicenseExcel } from '@/lib/license-parser'
import { isValidExcelFile } from '@/lib/excel-parser'
import { LICENSE_SAMPLE_DATA } from '@/lib/license-sample-data'
import type { LicenseData } from '@/lib/types'

interface UseLicenseDataReturn {
  readonly licenseData: LicenseData
  readonly loading: boolean
  readonly error: string | null
  readonly handleFile: (file: File) => Promise<void>
  readonly clearData: () => void
  readonly isUsingSample: boolean
}

const SAMPLE_LICENSE_DATA: LicenseData = {
  rows: LICENSE_SAMPLE_DATA,
  fileName: '',
}

export function useLicenseData(): UseLicenseDataReturn {
  const [licenseData, setLicenseData] = useState<LicenseData>(SAMPLE_LICENSE_DATA)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isUsingSample = licenseData.fileName === ''

  const handleFile = useCallback(async (file: File) => {
    if (!isValidExcelFile(file)) {
      setError('지원하지 않는 파일 형식입니다. .xlsx 또는 .xls 파일을 업로드해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await parseLicenseExcel(file)
      setLicenseData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 처리에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const clearData = useCallback(() => {
    setLicenseData(SAMPLE_LICENSE_DATA)
    setError(null)
  }, [])

  return { licenseData, loading, error, handleFile, clearData, isUsingSample }
}
