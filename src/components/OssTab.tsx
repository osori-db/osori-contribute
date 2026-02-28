'use client'

import { useOssData } from '@/hooks/useOssData'
import ExcelUploader from './ExcelUploader'
import OssList from './OssList'
import ErrorMessage from './ErrorMessage'

export default function OssTab() {
  const { ossData, loading, error, handleFile, clearData } = useOssData()

  return (
    <div className="space-y-4 py-4">
      <ExcelUploader
        onFileSelect={handleFile}
        loading={loading}
        fileName={ossData.fileName || undefined}
        onClear={clearData}
      />

      {error && <ErrorMessage message={error} />}

      {ossData.rows.length > 0 && (
        <OssList rows={ossData.rows} />
      )}
    </div>
  )
}
