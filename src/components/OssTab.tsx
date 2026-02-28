'use client'

import { useOssData } from '@/hooks/useOssData'
import ExcelUploader from './ExcelUploader'
import OssList from './OssList'
import ErrorMessage from './ErrorMessage'

export default function OssTab() {
  const { ossData, loading, error, handleFile, clearData, isUsingSample } = useOssData()

  return (
    <div className="space-y-4 py-4">
      <ExcelUploader
        onFileSelect={handleFile}
        loading={loading}
        fileName={ossData.fileName || undefined}
        onClear={clearData}
      />

      {isUsingSample && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700">
            샘플 데이터가 표시되고 있습니다. 엑셀 파일을 업로드하면 실제 데이터로 교체됩니다.
          </p>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {ossData.rows.length > 0 && (
        <OssList rows={ossData.rows} />
      )}
    </div>
  )
}
