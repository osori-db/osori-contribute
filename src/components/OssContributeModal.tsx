'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { TextAreaField, TextField } from './FormField'
import { validateOssRow, hasValidationFailure } from '@/lib/oss-validation'
import { parseMultiValue } from '@/lib/multi-value'
import type { OssRow } from '@/lib/types'

interface OssContributeModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly row: OssRow
  readonly onSave: (row: OssRow) => void
  readonly saving: boolean
  readonly saveError?: string | null
  readonly licenseMap: ReadonlyMap<string, number>
  readonly licenseMappingLoading: boolean
}

/** 빈 입력은 null로 되돌린다 — 원본 타입이 `string | null`인 필드의 의미를 유지하기 위함이다. */
function nullify(value: string): string | null {
  return value.trim() === '' ? null : value
}

function LicenseBadgeWithMapping({
  name,
  id,
  loading,
}: {
  readonly name: string
  readonly id: number | null
  readonly loading: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border bg-blue-50 text-blue-700 border-blue-200">
      {name}
      {loading ? (
        <span className="text-[10px] opacity-60">...</span>
      ) : id !== null ? (
        <span className="text-[10px] opacity-60">#{id}</span>
      ) : (
        <span className="text-[10px] text-red-500">?</span>
      )}
    </span>
  )
}

export default function OssContributeModal({
  open,
  onClose,
  row,
  onSave,
  saving,
  saveError,
  licenseMap,
  licenseMappingLoading,
}: OssContributeModalProps) {
  const [draft, setDraft] = useState<OssRow>(row)
  const [showExtra, setShowExtra] = useState(false)

  // 다른 행이 선택되면 초안을 새 원본으로 되돌린다.
  useEffect(() => {
    setDraft(row)
  }, [row])

  const declaredLicenses = parseMultiValue(draft.declaredLicenseList)
  const detectedLicenses = parseMultiValue(draft.detectedLicenseList)
  const downloadLocations = parseMultiValue(draft.downloadLocationList)

  // 검증은 원본이 아니라 초안 기준이다 — 사용자가 고치면 즉시 반영되어야 한다.
  const hints = useMemo(() => validateOssRow(draft), [draft])
  const hasFail = useMemo(() => hasValidationFailure(hints), [hints])

  const lookupLicenseId = useCallback(
    (name: string): number | null => {
      const trimmed = name.trim()
      return licenseMap.get(trimmed) ?? licenseMap.get(trimmed.toLowerCase()) ?? null
    },
    [licenseMap],
  )

  const declaredMapping = useMemo(
    () => declaredLicenses.map((name) => ({ name, id: lookupLicenseId(name) })),
    [declaredLicenses, lookupLicenseId],
  )

  const detectedMapping = useMemo(
    () => detectedLicenses.map((name) => ({ name, id: lookupLicenseId(name) })),
    [detectedLicenses, lookupLicenseId],
  )

  const unmappedLicenses = useMemo(
    () => [...declaredMapping, ...detectedMapping].filter((l) => l.id === null),
    [declaredMapping, detectedMapping],
  )

  const handleSave = useCallback(() => {
    onSave(draft)
  }, [onSave, draft])

  const handleReset = useCallback(() => {
    setDraft(row)
  }, [row])

  return (
    <Modal open={open} onClose={onClose} title="OSS 기여하기">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField
            id="oss-name"
            label="OSS Name"
            value={draft.ossName}
            disabled={saving}
            onChange={(v) => setDraft((p) => ({ ...p, ossName: v }))}
          />
          <TextField
            id="oss-version"
            label="Version"
            value={draft.version ?? ''}
            disabled={saving}
            hints={hints}
            hintField="version"
            onChange={(v) => setDraft((p) => ({ ...p, version: nullify(v) }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TextField
            id="oss-nickname"
            label="Nickname"
            value={draft.nickname ?? ''}
            disabled={saving}
            help="쉼표 또는 줄바꿈으로 구분"
            onChange={(v) => setDraft((p) => ({ ...p, nickname: nullify(v) }))}
          />
          <TextField
            id="oss-publisher"
            label="Publisher"
            value={draft.publisher ?? ''}
            disabled={saving}
            onChange={(v) => setDraft((p) => ({ ...p, publisher: nullify(v) }))}
          />
        </div>

        <TextField
          id="oss-homepage"
          label="Homepage"
          value={draft.homepage ?? ''}
          disabled={saving}
          onChange={(v) => setDraft((p) => ({ ...p, homepage: nullify(v) }))}
        />

        <div>
          <TextField
            id="oss-download-location"
            label="Download Location"
            value={draft.downloadLocation}
            disabled={saving}
            hints={hints}
            hintField="downloadLocation"
            onChange={(v) => setDraft((p) => ({ ...p, downloadLocation: v }))}
          />
          {downloadLocations.length > 0 && (
            <div className="mt-1 space-y-0.5">
              <p className="text-[11px] text-gray-400">시트의 다른 후보 URL</p>
              {downloadLocations.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={saving}
                  onClick={() => setDraft((p) => ({ ...p, downloadLocation: url }))}
                  className="block text-xs text-gray-400 hover:text-olive-600 break-all text-left disabled:cursor-not-allowed"
                >
                  {url}
                </button>
              ))}
            </div>
          )}
        </div>

        <TextField
          id="oss-license-combination"
          label="License Combination"
          value={draft.licenseCombination ?? ''}
          disabled={saving}
          placeholder="AND 또는 OR"
          hints={hints}
          hintField="licenseCombination"
          onChange={(v) => setDraft((p) => ({ ...p, licenseCombination: nullify(v) }))}
        />

        <div>
          <TextAreaField
            id="oss-declared-license"
            label="Declared License"
            value={draft.declaredLicenseList ?? ''}
            disabled={saving}
            help="쉼표 또는 줄바꿈으로 구분"
            hints={hints}
            hintField="declaredLicense"
            onChange={(v) => setDraft((p) => ({ ...p, declaredLicenseList: nullify(v) }))}
          />
          {declaredMapping.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {declaredMapping.map((item, i) => (
                <LicenseBadgeWithMapping
                  key={i}
                  name={item.name}
                  id={item.id}
                  loading={licenseMappingLoading}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <TextAreaField
            id="oss-detected-license"
            label="Detected License"
            value={draft.detectedLicenseList ?? ''}
            disabled={saving}
            help="쉼표 또는 줄바꿈으로 구분"
            hints={hints}
            hintField="detectedLicense"
            onChange={(v) => setDraft((p) => ({ ...p, detectedLicenseList: nullify(v) }))}
          />
          {detectedMapping.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {detectedMapping.map((item, i) => (
                <LicenseBadgeWithMapping
                  key={i}
                  name={item.name}
                  id={item.id}
                  loading={licenseMappingLoading}
                />
              ))}
            </div>
          )}
        </div>

        {!licenseMappingLoading && unmappedLicenses.length > 0 && (
          <p className="text-xs text-amber-600">
            * 매핑되지 않은 License: {[...new Set(unmappedLicenses.map((l) => l.name))].join(', ')}
          </p>
        )}

        <TextAreaField
          id="oss-copyright"
          label="Copyright"
          value={draft.copyright ?? ''}
          disabled={saving}
          hints={hints}
          hintField="copyright"
          onChange={(v) => setDraft((p) => ({ ...p, copyright: nullify(v) }))}
        />

        <TextAreaField
          id="oss-description-ko"
          label="Description (KO)"
          value={draft.descriptionKo ?? ''}
          disabled={saving}
          onChange={(v) => setDraft((p) => ({ ...p, descriptionKo: nullify(v) }))}
        />

        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            aria-expanded={showExtra}
          >
            {showExtra ? '− ' : '+ '}추가 정보 (OSORI로 함께 전송됨)
          </button>

          {showExtra && (
            <div className="mt-3 space-y-4">
              <TextAreaField
                id="oss-description"
                label="Description"
                value={draft.description ?? ''}
                disabled={saving}
                onChange={(v) => setDraft((p) => ({ ...p, description: nullify(v) }))}
              />
              <TextAreaField
                id="oss-attribution"
                label="Attribution"
                value={draft.attribution ?? ''}
                disabled={saving}
                onChange={(v) => setDraft((p) => ({ ...p, attribution: nullify(v) }))}
              />
              <TextAreaField
                id="oss-compliance-notice"
                label="Compliance Notice"
                value={draft.complianceNotice ?? ''}
                disabled={saving}
                onChange={(v) => setDraft((p) => ({ ...p, complianceNotice: nullify(v) }))}
              />
              <TextAreaField
                id="oss-compliance-notice-ko"
                label="Compliance Notice (KO)"
                value={draft.complianceNoticeKo ?? ''}
                disabled={saving}
                onChange={(v) => setDraft((p) => ({ ...p, complianceNoticeKo: nullify(v) }))}
              />
              <TextField
                id="oss-release-date"
                label="Release Date"
                value={draft.releaseDate ?? ''}
                disabled={saving}
                placeholder="YYYY-MM-DD"
                onChange={(v) => setDraft((p) => ({ ...p, releaseDate: nullify(v) }))}
              />
            </div>
          )}
        </div>

        {saveError && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {saveError}
          </div>
        )}

        <div className="flex justify-between items-center gap-2 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
          >
            원래대로
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || hasFail || licenseMappingLoading}
              className="px-4 py-2 text-sm rounded-lg bg-olive-500 text-white hover:bg-olive-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '처리 중...' : licenseMappingLoading ? '매핑 중...' : '저장'}
            </button>
          </div>
        </div>
        {hasFail && (
          <p className="text-xs text-red-500 text-right">필수 항목을 확인해주세요.</p>
        )}
      </div>
    </Modal>
  )
}
