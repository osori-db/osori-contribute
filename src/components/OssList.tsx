'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { contribute } from '@/lib/api-client'
import ContributeButton from './ContributeButton'
import OssContributeModal from './OssContributeModal'
import type { OssRow, ContributeStatus } from '@/lib/types'

interface OssListProps {
  readonly rows: readonly OssRow[]
}

function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
}

function LicenseBadges({ value }: { readonly value: string | null }) {
  const items = parseMultiValue(value)
  if (items.length === 0) return <span className="text-gray-300">-</span>

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span key={i} className="inline-block px-1.5 py-0.5 text-xs font-medium rounded border bg-blue-50 text-blue-700 border-blue-200">
          {item}
        </span>
      ))}
    </div>
  )
}

export default function OssList({ rows }: OssListProps) {
  const { token } = useAuth()
  const [statuses, setStatuses] = useState<Record<number, ContributeStatus>>({})
  const [selectedRow, setSelectedRow] = useState<{ row: OssRow; index: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleOpenModal = useCallback((index: number, row: OssRow) => {
    setSelectedRow({ row, index })
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedRow(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!token || !selectedRow) return

    const { row, index } = selectedRow
    setSaving(true)
    setStatuses((prev) => ({ ...prev, [index]: 'loading' }))

    try {
      const result = await contribute(token, 'oss', {
        ossName: row.ossName,
        nickname: row.nickname,
        homepage: row.homepage,
        downloadLocation: row.downloadLocation,
        downloadLocationList: row.downloadLocationList,
        version: row.version,
        licenseCombination: row.licenseCombination,
        declaredLicenseList: row.declaredLicenseList,
        detectedLicenseList: row.detectedLicenseList,
        copyright: row.copyright,
        publisher: row.publisher,
        description: row.description,
        descriptionKo: row.descriptionKo,
      })
      setStatuses((prev) => ({
        ...prev,
        [index]: result.success ? 'success' : 'error',
      }))
    } catch {
      setStatuses((prev) => ({ ...prev, [index]: 'error' }))
    } finally {
      setSaving(false)
      setSelectedRow(null)
    }
  }, [token, selectedRow])

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        총 {rows.length.toLocaleString()}건
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 scrollbar-visible">
        <table className="text-left" style={{ width: 1600, minWidth: 1600 }}>
          <colgroup>
            <col style={{ width: 50 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 300 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 280 }} />
            <col style={{ width: 280 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">No</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">OSS Name</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Version</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Download Location</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">Comb.</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Declared License</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Detected License</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Homepage</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">작업</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((row, index) => {
              const status = statuses[index] ?? 'idle'
              return (
                <tr
                  key={index}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2.5 text-xs text-gray-400 text-center">
                    {row.no}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-900 font-medium">
                    <div className="truncate" title={row.ossName}>
                      {row.ossName}
                    </div>
                    {row.nickname && (
                      <div className="text-xs text-gray-400 truncate mt-0.5" title={row.nickname}>
                        {row.nickname}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {row.version || <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    <span className="truncate block" title={row.downloadLocation}>
                      {row.downloadLocation || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {row.licenseCombination ? (
                      <span className="inline-block px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                        {row.licenseCombination}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <LicenseBadges value={row.declaredLicenseList} />
                  </td>
                  <td className="px-3 py-2.5">
                    <LicenseBadges value={row.detectedLicenseList} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    <span className="truncate block" title={row.homepage ?? ''}>
                      {row.homepage || <span className="text-gray-300">-</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ContributeButton
                      status={status}
                      onClick={() => handleOpenModal(index, row)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedRow && (
        <OssContributeModal
          open={true}
          onClose={handleCloseModal}
          row={selectedRow.row}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}
