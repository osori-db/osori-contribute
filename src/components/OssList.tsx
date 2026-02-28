'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLicenseMapping } from '@/hooks/useLicenseMapping'
import { fetchCreateOss, fetchCreateOssVersion } from '@/lib/api-client'
import { toOssCreateRequest, toOssVersionCreateRequest } from '@/lib/oss-mapper'
import ContributeButton from './ContributeButton'
import OssContributeModal from './OssContributeModal'
import Pagination from './Pagination'
import type { OssRow, ContributeStatus } from '@/lib/types'

const PAGE_SIZE = 20

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
  const [currentPage, setCurrentPage] = useState(1)

  const selectedRowLicenseNames = useMemo(() => {
    if (!selectedRow) return []
    const names: string[] = []
    for (const name of parseMultiValue(selectedRow.row.declaredLicenseList)) names.push(name)
    for (const name of parseMultiValue(selectedRow.row.detectedLicenseList)) names.push(name)
    return names
  }, [selectedRow])

  const { licenseMap, loading: licenseMappingLoading, mapNamesToIds: mapLicenseNamesToIds } = useLicenseMapping(selectedRowLicenseNames)

  useEffect(() => {
    setCurrentPage(1)
  }, [rows])

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, currentPage])

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
      // 1. Create OSS master
      const ossRequest = toOssCreateRequest(row)
      const ossResult = await fetchCreateOss(token, ossRequest)
      if (!ossResult.success || !ossResult.data) {
        throw new Error('OSS 생성에 실패했습니다.')
      }
      const ossMasterId = ossResult.data.oss_master_id

      // 2. Create OSS Version (if version exists)
      if (row.version?.trim()) {
        const declaredNames = parseMultiValue(row.declaredLicenseList)
        const detectedNames = parseMultiValue(row.detectedLicenseList)
        const declaredIds = mapLicenseNamesToIds(declaredNames)
        const detectedIds = mapLicenseNamesToIds(detectedNames)

        const versionRequest = toOssVersionCreateRequest(row, ossMasterId, declaredIds, detectedIds)
        const versionResult = await fetchCreateOssVersion(token, versionRequest)
        if (!versionResult.success) {
          throw new Error('OSS Version 생성에 실패했습니다.')
        }
      }

      setStatuses((prev) => ({
        ...prev,
        [index]: 'success',
      }))
    } catch {
      setStatuses((prev) => ({ ...prev, [index]: 'error' }))
    } finally {
      setSaving(false)
      setSelectedRow(null)
    }
  }, [token, selectedRow, mapLicenseNamesToIds])

  return (
    <div className="space-y-3">
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
            {pagedRows.map((row, i) => {
              const globalIndex = (currentPage - 1) * PAGE_SIZE + i
              const status = statuses[globalIndex] ?? 'idle'
              return (
                <tr
                  key={globalIndex}
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
                      onClick={() => handleOpenModal(globalIndex, row)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        totalCount={rows.length}
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {selectedRow && (
        <OssContributeModal
          open={true}
          onClose={handleCloseModal}
          row={selectedRow.row}
          onSave={handleSave}
          saving={saving}
          licenseMap={licenseMap}
          licenseMappingLoading={licenseMappingLoading}
        />
      )}
    </div>
  )
}
