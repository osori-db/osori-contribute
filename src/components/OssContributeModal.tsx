'use client'

import { useMemo } from 'react'
import Modal from './Modal'
import { validateOssRow, hasValidationFailure } from '@/lib/oss-validation'
import type { OssRow } from '@/lib/types'
import type { FieldHint, FieldHints } from '@/lib/oss-validation'

interface OssContributeModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly row: OssRow
  readonly onSave: () => void
  readonly saving: boolean
  readonly saveError?: string | null
  readonly licenseMap: ReadonlyMap<string, number | null>
  readonly licenseMappingLoading: boolean
}

const FIELD_LABEL = 'block text-xs font-medium text-gray-500 mb-1'
const FIELD_VALUE = 'text-sm text-gray-900'

function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
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

const HINT_COLORS: Record<FieldHint['status'], string> = {
  fail: 'text-red-500',
  warn: 'text-amber-600',
  info: 'text-blue-500',
}

function FieldHintsView({ hints, field }: { readonly hints: FieldHints; readonly field: string }) {
  const fieldHints = hints[field]
  if (!fieldHints || fieldHints.length === 0) return null

  return (
    <div className="mt-1 space-y-0.5">
      {fieldHints.map((hint, i) => (
        <p key={i} className={`text-xs ${HINT_COLORS[hint.status]}`}>
          * {hint.message}
        </p>
      ))}
    </div>
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
  const declaredLicenses = parseMultiValue(row.declaredLicenseList)
  const detectedLicenses = parseMultiValue(row.detectedLicenseList)
  const downloadLocations = parseMultiValue(row.downloadLocationList)

  const hints = useMemo(() => validateOssRow(row), [row])
  const hasFail = useMemo(() => hasValidationFailure(hints), [hints])

  const declaredMapping = useMemo(() => {
    return declaredLicenses.map((name) => ({
      name,
      id: licenseMap.get(name) ?? null,
    }))
  }, [declaredLicenses, licenseMap])

  const detectedMapping = useMemo(() => {
    return detectedLicenses.map((name) => ({
      name,
      id: licenseMap.get(name) ?? null,
    }))
  }, [detectedLicenses, licenseMap])

  const unmappedLicenses = useMemo(() => {
    const all = [...declaredMapping, ...detectedMapping]
    return all.filter((l) => l.id === null)
  }, [declaredMapping, detectedMapping])

  return (
    <Modal open={open} onClose={onClose} title="OSS 기여하기">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={FIELD_LABEL}>OSS Name</label>
            <p className={FIELD_VALUE}>{row.ossName}</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Version</label>
            <p className={FIELD_VALUE}>{row.version || '-'}</p>
            <FieldHintsView hints={hints} field="version" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={FIELD_LABEL}>Nickname</label>
            <p className={FIELD_VALUE}>{row.nickname || '-'}</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Publisher</label>
            <p className={FIELD_VALUE}>{row.publisher || '-'}</p>
          </div>
        </div>

        <div>
          <label className={FIELD_LABEL}>Homepage</label>
          <p className="text-sm text-gray-900 break-all">{row.homepage || '-'}</p>
        </div>

        <div>
          <label className={FIELD_LABEL}>Download Location</label>
          <p className="text-sm text-gray-900 break-all">{row.downloadLocation || '-'}</p>
          {downloadLocations.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {downloadLocations.map((url, i) => (
                <p key={i} className="text-xs text-gray-400 break-all">{url}</p>
              ))}
            </div>
          )}
          <FieldHintsView hints={hints} field="downloadLocation" />
        </div>

        <div>
          <label className={FIELD_LABEL}>License Combination</label>
          <p className={FIELD_VALUE}>{row.licenseCombination || '-'}</p>
          <FieldHintsView hints={hints} field="licenseCombination" />
        </div>

        <div>
          <label className={FIELD_LABEL}>Declared License</label>
          {declaredMapping.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {declaredMapping.map((item, i) => (
                <LicenseBadgeWithMapping
                  key={i}
                  name={item.name}
                  id={item.id}
                  loading={licenseMappingLoading}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">-</p>
          )}
          <FieldHintsView hints={hints} field="declaredLicense" />
        </div>

        <div>
          <label className={FIELD_LABEL}>Detected License</label>
          {detectedMapping.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {detectedMapping.map((item, i) => (
                <LicenseBadgeWithMapping
                  key={i}
                  name={item.name}
                  id={item.id}
                  loading={licenseMappingLoading}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">-</p>
          )}
          <FieldHintsView hints={hints} field="detectedLicense" />
        </div>

        {!licenseMappingLoading && unmappedLicenses.length > 0 && (
          <p className="text-xs text-amber-600">
            * 매핑되지 않은 License: {[...new Set(unmappedLicenses.map((l) => l.name))].join(', ')}
          </p>
        )}

        <div>
          <label className={FIELD_LABEL}>Copyright</label>
          <p className={FIELD_VALUE}>{row.copyright || '-'}</p>
          <FieldHintsView hints={hints} field="copyright" />
        </div>

        {row.descriptionKo && (
          <div>
            <label className={FIELD_LABEL}>Description</label>
            <p className={FIELD_VALUE}>{row.descriptionKo}</p>
          </div>
        )}

        {saveError && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
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
            onClick={onSave}
            disabled={saving || hasFail || licenseMappingLoading}
            className="px-4 py-2 text-sm rounded-lg bg-olive-500 text-white hover:bg-olive-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '처리 중...' : licenseMappingLoading ? '매핑 중...' : '저장'}
          </button>
        </div>
        {hasFail && (
          <p className="text-xs text-red-500 text-right">
            필수 항목을 확인해주세요.
          </p>
        )}
      </div>
    </Modal>
  )
}
