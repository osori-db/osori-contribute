'use client'

import { Fragment, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLicenseMapping } from '@/hooks/useLicenseMapping'
import { usePageParam } from '@/hooks/usePageParam'
import { useQueryParam } from '@/hooks/useQueryParam'
import { usePageSizeParam, PAGE_SIZE_OPTIONS } from '@/hooks/usePageSizeParam'
import { fetchOssList, fetchOssVersions, fetchCreateOss, fetchCreateOssVersion } from '@/lib/api-client'
import { buildPurl, toOssCreateRequest, toOssVersionCreateRequest } from '@/lib/oss-mapper'
import { validateOssRow, hasValidationFailure } from '@/lib/oss-validation'
import { isSafeHttpUrl } from '@/lib/url'
import { changedFieldKeys } from '@/lib/row-diff'
import { OSS_FIELD_LABELS, toFieldLabels } from '@/lib/field-labels'
import BatchResultModal from './BatchResultModal'
import ContributeButton from './ContributeButton'
import EditedBadge from './EditedBadge'
import OssContributeModal from './OssContributeModal'
import SearchInput from './SearchInput'
import Pagination from './Pagination'
import type { OssRow, ContributeStatus } from '@/lib/types'

/** 라이선스 목록과 동시에 마운트되므로 검색어 파라미터 이름을 분리한다. */
const SEARCH_PARAM = 'ossQ'

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
  // 모달에서 수정한 행. 표시·배치 기여가 모두 수정본을 쓰도록 원본 위에 덮어쓴다.
  const [rowOverrides, setRowOverrides] = useState<Record<number, OssRow>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [errorMessages, setErrorMessages] = useState<Record<number, string>>({})
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [batchDone, setBatchDone] = useState(false)
  const [showBatchResult, setShowBatchResult] = useState(false)

  const { licenseMap, loading: licenseMappingLoading, mapNamesToIds: mapLicenseNamesToIds } = useLicenseMapping()
  const { query, setQuery } = useQueryParam(SEARCH_PARAM)
  const { pageSize, setPageSize } = usePageSizeParam()

  const effectiveRows = useMemo(
    () => rows.map((row, i) => rowOverrides[i] ?? row),
    [rows, rowOverrides],
  )

  // 검색으로 걸러도 상태·수정본은 원본 인덱스로 관리해야 하므로 인덱스를 함께 들고 다닌다.
  const filteredRows = useMemo(() => {
    const indexed = effectiveRows.map((row, index) => ({ row, index }))
    const keyword = query.trim().toLowerCase()
    if (!keyword) return indexed
    return indexed.filter(({ row }) => row.ossName.toLowerCase().includes(keyword))
  }, [effectiveRows, query])

  const { page: currentPage, setPage, resetPage } = usePageParam(
    Math.ceil(filteredRows.length / pageSize),
  )

  // 새 파일을 올렸을 때만 초기화한다. 첫 렌더에서 초기화하면 URL의 page가 무시된다.
  const prevRowsRef = useRef(rows)
  useEffect(() => {
    if (prevRowsRef.current === rows) return
    prevRowsRef.current = rows
    setRowOverrides({})
    resetPage()
  }, [rows, resetPage])

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, pageSize])

  // 실제로 값이 달라진 행만 "수정됨"으로 표시한다.
  const editedFields = useMemo(() => {
    const result: Record<number, readonly string[]> = {}
    for (const [key, override] of Object.entries(rowOverrides)) {
      const index = Number(key)
      const original = rows[index]
      if (!original) continue
      const changed = changedFieldKeys(original, override)
      if (changed.length > 0) {
        result[index] = toFieldLabels(changed, OSS_FIELD_LABELS)
      }
    }
    return result
  }, [rowOverrides, rows])

  const handleOpenModal = useCallback(async (index: number, row: OssRow) => {
    if (!token) return

    setStatuses((prev) => ({ ...prev, [index]: 'loading' }))
    try {
      let ossMasterId: number | null = null

      // 1차: purl로 조회
      const purl = buildPurl(row.downloadLocation)
      if (purl) {
        const purlResult = await fetchOssList(token, '', 0, 1, true, purl)
        if (purlResult.success && purlResult.data && purlResult.data.length > 0) {
          ossMasterId = purlResult.data[0].oss_master_id
        }
      }

      // 2차: purl로 못 찾았으면 downloadLocation으로 재조회
      if (ossMasterId === null && row.downloadLocation?.trim()) {
        const dlResult = await fetchOssList(token, row.downloadLocation.trim(), 0, 1, true)
        if (dlResult.success && dlResult.data && dlResult.data.length > 0) {
          ossMasterId = dlResult.data[0].oss_master_id
        }
      }

      // OSS를 찾았으면 버전 존재 여부 확인
      if (ossMasterId !== null) {
        const versionToCheck = (row.version ?? '').trim()
        const versionsResult = await fetchOssVersions(token, ossMasterId)
        const versionExists = versionsResult.success
          && versionsResult.data?.some((v) => (v.version ?? '') === versionToCheck)
        if (versionExists) {
          setStatuses((prev) => ({ ...prev, [index]: 'exists' }))
          return
        }
      }
    } catch {
      // 조회 실패 시 모달로 진행
    }

    setStatuses((prev) => ({ ...prev, [index]: 'idle' }))
    setSelectedRow({ row, index })
  }, [token])

  const handleCloseModal = useCallback(() => {
    setSelectedRow(null)
    setSaveError(null)
  }, [])

  const handleSave = useCallback(async (editedRow: OssRow) => {
    if (!token || !selectedRow) return

    const { index } = selectedRow
    const row = editedRow
    // 저장 시도 시점에 수정본을 확정한다 — 실패해도 표와 배치 기여가 수정본을 쓰게 된다.
    setRowOverrides((prev) => ({ ...prev, [index]: editedRow }))
    setSaving(true)
    setSaveError(null)
    setStatuses((prev) => ({ ...prev, [index]: 'loading' }))

    try {
      let ossMasterId: number | null = null

      // 1. purl로 기존 OSS 조회
      const purl = buildPurl(row.downloadLocation)
      if (purl) {
        const searchResult = await fetchOssList(token, '', 0, 1, true, purl)
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          ossMasterId = searchResult.data[0].oss_master_id
        }
      }

      // 2. OSS가 없으면 생성
      if (ossMasterId === null) {
        const ossRequest = toOssCreateRequest(row)
        const ossResult = await fetchCreateOss(token, ossRequest)
        if (!ossResult.success || !ossResult.data) {
          const errMsg = ossResult.error ?? 'OSS 생성에 실패했습니다.'
          setSaveError(errMsg)
          setStatuses((prev) => ({ ...prev, [index]: 'error' }))
          setSaving(false)
          return
        }
        ossMasterId = ossResult.data.oss_master_id
      }

      // 3. 기존 버전 조회 → 없으면 생성
      {
        const versionToCheck = (row.version ?? '').trim()
        const versionsResult = await fetchOssVersions(token, ossMasterId)
        const versionExists = versionsResult.success
          && versionsResult.data?.some((v) => (v.version ?? '') === versionToCheck)

        if (!versionExists) {
          const declaredNames = parseMultiValue(row.declaredLicenseList)
          const detectedNames = parseMultiValue(row.detectedLicenseList)
          const declaredIds = mapLicenseNamesToIds(declaredNames)
          const detectedIds = mapLicenseNamesToIds(detectedNames)

          const versionRequest = toOssVersionCreateRequest(row, ossMasterId, declaredIds, detectedIds)
          const versionResult = await fetchCreateOssVersion(token, versionRequest)
          if (!versionResult.success) {
            const errMsg = versionResult.error ?? 'OSS Version 생성에 실패했습니다.'
            setSaveError(errMsg)
            setStatuses((prev) => ({ ...prev, [index]: 'error' }))
            setSaving(false)
            return
          }
        }
      }

      setStatuses((prev) => ({ ...prev, [index]: 'success' }))
      setSaving(false)
      setSelectedRow(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setStatuses((prev) => ({ ...prev, [index]: 'error' }))
      setSaving(false)
    }
  }, [token, selectedRow, mapLicenseNamesToIds])

  const handleBatchContribute = useCallback(async () => {
    if (!token || batchSaving) return

    setBatchSaving(true)
    setBatchDone(false)
    setBatchProgress({ current: 0, total: filteredRows.length })
    setErrorMessages({})

    // 검색 중이면 화면에 보이는 결과만 처리한다.
    // 보이지 않는 항목까지 전송하면 사용자가 의도하지 않은 대량 기여가 일어난다.
    for (const { row, index: i } of filteredRows) {
      const currentStatus = statuses[i]

      // 이미 성공했거나 존재하는 항목은 스킵
      if (currentStatus === 'success' || currentStatus === 'exists') {
        setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
        continue
      }

      // 검증
      const hints = validateOssRow(row)
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

      setStatuses((prev) => ({ ...prev, [i]: 'loading' }))

      try {
        let ossMasterId: number | null = null

        // 1. purl로 기존 OSS 조회
        const purl = buildPurl(row.downloadLocation)
        if (purl) {
          const purlResult = await fetchOssList(token, '', 0, 1, true, purl)
          if (purlResult.success && purlResult.data && purlResult.data.length > 0) {
            ossMasterId = purlResult.data[0].oss_master_id
          }
        }

        // 2. purl로 못 찾았으면 downloadLocation으로 재조회
        if (ossMasterId === null && row.downloadLocation?.trim()) {
          const dlResult = await fetchOssList(token, row.downloadLocation.trim(), 0, 1, true)
          if (dlResult.success && dlResult.data && dlResult.data.length > 0) {
            ossMasterId = dlResult.data[0].oss_master_id
          }
        }

        // 3. OSS를 찾았으면 버전 존재 여부 확인
        if (ossMasterId !== null) {
          const versionToCheck = (row.version ?? '').trim()
          const versionsResult = await fetchOssVersions(token, ossMasterId)
          const versionExists = versionsResult.success
            && versionsResult.data?.some((v) => (v.version ?? '') === versionToCheck)
          if (versionExists) {
            setStatuses((prev) => ({ ...prev, [i]: 'exists' }))
            setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
            continue
          }
        }

        // 4. OSS가 없으면 생성
        if (ossMasterId === null) {
          const ossRequest = toOssCreateRequest(row)
          const ossResult = await fetchCreateOss(token, ossRequest)
          if (!ossResult.success || !ossResult.data) {
            const errMsg = ossResult.error ?? 'OSS 생성에 실패했습니다.'
            setErrorMessages((prev) => ({ ...prev, [i]: errMsg }))
            setStatuses((prev) => ({ ...prev, [i]: 'error' }))
            setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
            continue
          }
          ossMasterId = ossResult.data.oss_master_id
        }

        // 5. 버전 생성
        {
          const declaredNames = parseMultiValue(row.declaredLicenseList)
          const detectedNames = parseMultiValue(row.detectedLicenseList)
          const declaredIds = mapLicenseNamesToIds(declaredNames)
          const detectedIds = mapLicenseNamesToIds(detectedNames)

          const versionRequest = toOssVersionCreateRequest(row, ossMasterId, declaredIds, detectedIds)
          const versionResult = await fetchCreateOssVersion(token, versionRequest)
          if (!versionResult.success) {
            const errMsg = versionResult.error ?? 'OSS Version 생성에 실패했습니다.'
            setErrorMessages((prev) => ({ ...prev, [i]: errMsg }))
            setStatuses((prev) => ({ ...prev, [i]: 'error' }))
            setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
            continue
          }
        }

        setStatuses((prev) => ({ ...prev, [i]: 'success' }))
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
        setErrorMessages((prev) => ({ ...prev, [i]: errMsg }))
        setStatuses((prev) => ({ ...prev, [i]: 'error' }))
      }

      setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }))
    }

    setBatchSaving(false)
    setBatchDone(true)
  }, [token, filteredRows, statuses, batchSaving, mapLicenseNamesToIds])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SearchInput
          id="oss-search"
          label="OSS Name 검색"
          value={query}
          onChange={setQuery}
          placeholder="OSS Name 검색"
          resultCount={filteredRows.length}
        />
        <div className="flex gap-2">
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
          disabled={batchSaving || filteredRows.length === 0}
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
          ) : query.trim() ? (
            `검색 결과 기여 (${filteredRows.length}건)`
          ) : (
            '전체 기여'
          )}
        </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 scrollbar-visible">
        <table className="text-left" style={{ width: 1268, minWidth: 1268 }}>
          <colgroup>
            <col style={{ width: 50 }} />
            <col style={{ width: 280 }} />
            <col style={{ width: 288 }} />
            <col style={{ width: 450 }} />
            <col style={{ width: 60 }} />
            {/* 가장 긴 문구인 "이미 존재함"이 아이콘과 함께 한 줄에 들어갈 폭 */}
            <col style={{ width: 140 }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">No</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">OSS Name</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Download Location</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600">Declared License</th>
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">Comb.</th>
              <th className="sticky right-0 z-10 bg-gray-50 border-l border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-600 text-center">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {pagedRows.map(({ row, index: globalIndex }) => {
              const status = statuses[globalIndex] ?? 'idle'
              const errorMsg = errorMessages[globalIndex]
              const edited = editedFields[globalIndex]
              // 처리가 끝난 행은 흐리게 보인다. 다만 sticky 작업 셀에 opacity를 주면
              // 가로 스크롤되는 셀이 비쳐 보이므로, 행이 아니라 데이터 셀에만 적용한다.
              const dim = status === 'success' || status === 'exists' ? 'opacity-40' : ''
              return (
                <Fragment key={globalIndex}>
                  <tr
                    className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${edited ? 'bg-amber-50' : 'bg-white'}`}
                  >
                    <td className={`px-3 py-2.5 text-xs text-gray-400 text-center ${dim}`}>
                      {row.no}
                    </td>
                    <td className={`px-3 py-2.5 text-sm text-gray-900 font-medium ${dim}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate" title={row.ossName}>
                          {row.ossName}
                        </span>
                        {edited && <EditedBadge fields={edited} />}
                      </div>
                      {(row.version || row.nickname) && (
                      <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                        {row.version && (
                          <span className="shrink-0 inline-block px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                            {row.version}
                          </span>
                        )}
                        {row.nickname && (
                          <span className="text-xs text-gray-400 truncate" title={row.nickname}>
                            {row.nickname}
                          </span>
                        )}
                      </div>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-xs text-gray-600 ${dim}`}>
                      {isSafeHttpUrl(row.downloadLocation) ? (
                        <a
                          href={row.downloadLocation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate block text-olive-600 hover:text-olive-700 hover:underline"
                          title={row.downloadLocation}
                        >
                          {row.downloadLocation}
                        </a>
                      ) : (
                        <span className="truncate block" title={row.downloadLocation}>
                          {row.downloadLocation || '-'}
                        </span>
                      )}
                      {row.homepage && (
                        <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                          <span className="shrink-0 inline-block px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                            Homepage
                          </span>
                          {isSafeHttpUrl(row.homepage) ? (
                            <a
                              href={row.homepage ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-400 truncate hover:text-olive-600 hover:underline"
                              title={row.homepage}
                            >
                              {row.homepage}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400 truncate" title={row.homepage}>
                              {row.homepage}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 ${dim}`}>
                      <LicenseBadges value={row.declaredLicenseList} />
                    </td>
                    <td className={`px-3 py-2.5 text-center ${dim}`}>
                      {row.licenseCombination ? (
                        <span className="inline-block px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                          {row.licenseCombination}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="sticky right-0 z-10 bg-inherit border-l border-gray-200 px-3 py-2.5 text-center">
                      <ContributeButton
                        status={status}
                        disabled={batchSaving}
                        onClick={() => handleOpenModal(globalIndex, row)}
                      />
                    </td>
                  </tr>
                  {errorMsg && (
                    <tr className="bg-red-50">
                      <td colSpan={6} className="px-3 py-1.5 text-xs text-red-600">
                        {errorMsg}
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
        totalCount={filteredRows.length}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setPage}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={setPageSize}
      />

      {selectedRow && (
        <OssContributeModal
          open={true}
          onClose={handleCloseModal}
          row={selectedRow.row}
          onSave={handleSave}
          saving={saving}
          saveError={saveError}
          licenseMap={licenseMap}
          licenseMappingLoading={licenseMappingLoading}
        />
      )}

      <BatchResultModal
        open={showBatchResult}
        onClose={() => setShowBatchResult(false)}
        rows={effectiveRows.map((r) => ({ no: r.no, name: r.ossName }))}
        statuses={statuses}
        errorMessages={errorMessages}
      />
    </div>
  )
}
