'use client'

import { useExcelData } from '@/hooks/useExcelData'
import ExcelUploader from './ExcelUploader'
import DataList from './DataList'
import ErrorMessage from './ErrorMessage'

export default function OssTab() {
  const { excelData, loading, error, handleFile, clearData } = useExcelData()

  return (
    <div className="space-y-4 py-4">
      <ExcelUploader
        onFileSelect={handleFile}
        loading={loading}
        fileName={excelData?.fileName}
        onClear={clearData}
      />

      {error && <ErrorMessage message={error} />}

      {excelData && (
        <DataList data={excelData} type="oss" />
      )}
    </div>
  )
}
