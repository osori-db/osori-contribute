'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { contribute } from '@/lib/api-client'
import ContributeButton from './ContributeButton'
import LicenseContributeModal from './LicenseContributeModal'
import type { LicenseRow, ContributeStatus } from '@/lib/types'

interface LicenseListProps {
  readonly rows: readonly LicenseRow[]
}

function ObligationBadge({ value }: { readonly value: boolean }) {
  return value ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-olive-100 text-olive-600">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-400">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  )
}

function RestrictionBadges({ value }: { readonly value: string | null }) {
  if (!value) return <span className="text-gray-300">-</span>

  const colorMap: Record<string, string> = {
    'Network Triggered': 'bg-amber-50 text-amber-700 border-amber-200',
    'Purpose Restriction': 'bg-red-50 text-red-700 border-red-200',
    'Internal Use Only': 'bg-purple-50 text-purple-700 border-purple-200',
  }

  const items = value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)

  if (items.length === 0) return <span className="text-gray-300">-</span>

  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => {
        const color = colorMap[item] ?? 'bg-gray-50 text-gray-600 border-gray-200'
        return (
          <span key={i} className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${color}`}>
            {item}
          </span>
        )
      })}
    </div>
  )
}

function WebpageCell({ webpage, webpageList }: { readonly webpage: string; readonly webpageList: string | null }) {
  if (!webpage && !webpageList) return <span className="text-gray-300">-</span>

  const extraUrls = webpageList
    ? webpageList.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    : []

  return (
    <div className="flex flex-col gap-0.5">
      {webpage && (
        <span className="truncate block text-xs text-gray-600" title={webpage}>
          {webpage}
        </span>
      )}
      {extraUrls.map((url, i) => (
        <span key={i} className="truncate block text-xs text-gray-400" title={url}>
          {url}
        </span>
      ))}
    </div>
  )
}

export default function LicenseList({ rows }: LicenseListProps) {
  const { token } = useAuth()
  const [statuses, setStatuses] = useState<Record<number, ContributeStatus>>({})
  const [selectedRow, setSelectedRow] = useState<{ row: LicenseRow; index: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleOpenModal = useCallback((index: number, row: LicenseRow) => {
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
      const result = await contribute(token, 'license', {
        licenseName: row.licenseName,
        spdxIdentifier: row.spdxIdentifier,
        nickName: row.nickName,
        obligationNotice: row.obligationNotice,
        obligationDisclosingSrc: row.obligationDisclosingSrc,
        restriction: row.restriction,
        webpage: row.webpage,
        webpageList: row.webpageList,
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
        <table className="text-left" style={{ width: 1750, minWidth: 1750 }}>
          <colgroup>
            <col style={{ width: 50 }} />
            <col style={{ width: 300 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 340 }} />
            <col style={{ width: 280 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">No</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">License Name</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">SPDX Identifier</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">Notice</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">Source</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Restriction</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Webpage</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Description</th>
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
                    <div className="truncate" title={row.licenseName}>
                      {row.licenseName}
                    </div>
                    {row.nickName && (
                      <div className="text-xs text-gray-400 truncate mt-0.5" title={row.nickName}>
                        {row.nickName.replace(/\r?\n/g, ', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    <span className="truncate block" title={row.spdxIdentifier}>
                      {row.spdxIdentifier}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ObligationBadge value={row.obligationNotice} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-xs text-gray-500">{row.obligationDisclosingSrc}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <RestrictionBadges value={row.restriction} />
                  </td>
                  <td className="px-3 py-2.5">
                    <WebpageCell webpage={row.webpage} webpageList={row.webpageList} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {row.descriptionKo || <span className="text-gray-300">-</span>}
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
        <LicenseContributeModal
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
