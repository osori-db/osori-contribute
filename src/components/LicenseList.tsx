'use client'

import { Fragment, useState, useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRestrictions } from '@/hooks/useRestrictions'
import { useLicenseMapping } from '@/hooks/useLicenseMapping'
import { fetchCreateLicense } from '@/lib/api-client'
import { toLicenseCreateRequest } from '@/lib/license-mapper'
import { validateLicenseRow } from '@/lib/license-validation'
import { hasValidationFailure } from '@/lib/oss-validation'
import BatchResultModal from './BatchResultModal'
import ContributeButton from './ContributeButton'
import LicenseContributeModal from './LicenseContributeModal'
import Pagination from './Pagination'
import type { LicenseRow, ContributeStatus } from '@/lib/types'

const PAGE_SIZE = 20

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

function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
}

export default function LicenseList({ rows }: LicenseListProps) {
  const { token } = useAuth()
  const { restrictions, mapNamesToIds } = useRestrictions()
  const { hasLicense, loading: licenseMapLoading } = useLicenseMapping()
  const [statuses, setStatuses] = useState<Record<number, ContributeStatus>>({})
  const [selectedRow, setSelectedRow] = useState<{ row: LicenseRow; index: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [errorMessages, setErrorMessages] = useState<Record<number, string>>({})
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [batchDone, setBatchDone] = useState(false)
  const [showBatchResult, setShowBatchResult] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [rows])

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, currentPage])

  const handleOpenModal = useCallback((index: number, row: LicenseRow) => {
    if (!token) return

    // SPDX Identifier가 있으면 사전 로드된 맵에서 존재 여부 확인
    if (row.spdxIdentifier?.trim() && hasLicense(row.spdxIdentifier)) {
      setStatuses((prev) => ({ ...prev, [index]: 'exists' }))
      return
    }

    setSelectedRow({ row, index })
  }, [token, hasLicense])

  const handleCloseModal = useCallback(() => {
    setSelectedRow(null)
    setSaveError(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!token || !selectedRow) return

    const { row, index } = selectedRow
    setSaving(true)
    setSaveError(null)
    setStatuses((prev) => ({ ...prev, [index]: 'loading' }))

    try {
      // 모달 열기 전에 SPDX 조회를 완료했으므로 바로 생성
      const restrictionNames = parseMultiValue(row.restriction)
      const restrictionIds = mapNamesToIds(restrictionNames)
      const request = toLicenseCreateRequest(row, restrictionIds)
      const result = await fetchCreateLicense(token, request)

      if (result.success) {
        setStatuses((prev) => ({ ...prev, [index]: 'success' }))
        setSaving(false)
        setSelectedRow(null)
      } else {
        setSaveError(result.error ?? '라이선스 생성에 실패했습니다.')
        setStatuses((prev) => ({ ...prev, [index]: 'error' }))
        setSaving(false)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setStatuses((prev) => ({ ...prev, [index]: 'error' }))
      setSaving(false)
    }
  }, [token, selectedRow, mapNamesToIds])

  const handleBatchContribute = useCallback(async () => {
    if (!token || batchSaving) return

    setBatchSaving(true)
    setBatchDone(false)
    setBatchProgress({ current: 0, total: rows.length })
    setErrorMessages({})

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const currentStatus = statuses[i]

      // 이미 성공했거나 존재하는 항목은 스킵
      if (currentStatus === 'success' || currentStatus === 'exists') {
        setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
        continue
      }

      // 검증
      const hints = validateLicenseRow(row)
      if (hasValidationFailure(hints)) {
        const failMessages = Object.values(hints)
          .flat()
          .filter((h) => h && h.status === 'fail')
          .map((h) => h!.message)
        setErrorMessages((prev) => ({ ...prev, [i]: failMessages.join(', ') }))
        setStatuses((prev) => ({ ...prev, [i]: 'error' }))
        setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
        continue
      }

      // SPDX Identifier로 사전 로드된 맵에서 존재 여부 확인
      if (row.spdxIdentifier?.trim() && hasLicense(row.spdxIdentifier)) {
        setStatuses((prev) => ({ ...prev, [i]: 'exists' }))
        setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
        continue
      }

      setStatuses((prev) => ({ ...prev, [i]: 'loading' }))

      try {
        // 생성
        const restrictionNames = parseMultiValue(row.restriction)
        const restrictionIds = mapNamesToIds(restrictionNames)
        const request = toLicenseCreateRequest(row, restrictionIds)
        const result = await fetchCreateLicense(token, request)

        if (result.success) {
          setStatuses((prev) => ({ ...prev, [i]: 'success' }))
        } else {
          const errMsg = result.error ?? '라이선스 생성에 실패했습니다.'
          setErrorMessages((prev) => ({ ...prev, [i]: errMsg }))
          setStatuses((prev) => ({ ...prev, [i]: 'error' }))
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
        setErrorMessages((prev) => ({ ...prev, [i]: errMsg }))
        setStatuses((prev) => ({ ...prev, [i]: 'error' }))
      }

      setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
    }

    setBatchSaving(false)
    setBatchDone(true)
  }, [token, rows, statuses, batchSaving, mapNamesToIds, hasLicense])

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        {batchDone && !batchSaving && (
          <button
            type="button"
            onClick={() => setShowBatchResult(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            기여 결과 보기
          </button>
        )}
        <button
          type="button"
          onClick={handleBatchContribute}
          disabled={batchSaving || rows.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-olive-600 rounded-lg hover:bg-olive-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {batchSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              처리 중... ({batchProgress.current}/{batchProgress.total})
            </>
          ) : (
            '전체 기여'
          )}
        </button>
      </div>

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
            {pagedRows.map((row, i) => {
              const globalIndex = (currentPage - 1) * PAGE_SIZE + i
              const status = statuses[globalIndex] ?? 'idle'
              return (
                <Fragment key={globalIndex}>
                  <tr
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${status === 'success' || status === 'exists' ? 'opacity-40' : ''}`}
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
                        onClick={() => handleOpenModal(globalIndex, row)}
                        disabled={batchSaving}
                      />
                    </td>
                  </tr>
                  {errorMessages[globalIndex] && status === 'error' && (
                    <tr className="bg-red-50">
                      <td colSpan={9} className="px-3 py-1 text-xs text-red-500">
                        {errorMessages[globalIndex]}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
        <LicenseContributeModal
          open={true}
          onClose={handleCloseModal}
          row={selectedRow.row}
          onSave={handleSave}
          saving={saving}
          saveError={saveError}
          restrictions={restrictions}
          mapNamesToIds={mapNamesToIds}
        />
      )}

      <BatchResultModal
        open={showBatchResult}
        onClose={() => setShowBatchResult(false)}
        rows={rows.map((r) => ({ no: r.no, name: r.licenseName }))}
        statuses={statuses}
        errorMessages={errorMessages}
      />
    </div>
  )
}
