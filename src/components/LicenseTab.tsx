'use client'

import { useLicenseData } from '@/hooks/useLicenseData'
import ExcelUploader from './ExcelUploader'
import LicenseList from './LicenseList'
import ErrorMessage from './ErrorMessage'

export default function LicenseTab() {
  const { licenseData, loading, error, handleFile, clearData } = useLicenseData()

  return (
    <div className="space-y-4 py-4">
      <ExcelUploader
        onFileSelect={handleFile}
        loading={loading}
        fileName={licenseData.fileName || undefined}
        onClear={clearData}
      />

      {error && <ErrorMessage message={error} />}

      {licenseData.rows.length > 0 && (
        <LicenseList rows={licenseData.rows} />
      )}
    </div>
  )
}
