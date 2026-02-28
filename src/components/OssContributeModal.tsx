'use client'

import { useMemo } from 'react'
import Modal from './Modal'
import { validateOssRow, hasValidationFailure } from '@/lib/oss-validation'
import type { OssRow } from '@/lib/types'
import type { FieldHint, OssFieldHints } from '@/lib/oss-validation'

interface OssContributeModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly row: OssRow
  readonly onSave: () => void
  readonly saving: boolean
}

const FIELD_LABEL = 'block text-xs font-medium text-gray-500 mb-1'
const FIELD_VALUE = 'text-sm text-gray-900'

function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
}

function LicenseBadge({ value }: { readonly value: string }) {
  return (
    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded border bg-blue-50 text-blue-700 border-blue-200">
      {value}
    </span>
  )
}

const HINT_COLORS: Record<FieldHint['status'], string> = {
  fail: 'text-red-500',
  warn: 'text-amber-600',
  info: 'text-blue-500',
}

function FieldHints({ hints, field }: { readonly hints: OssFieldHints; readonly field: string }) {
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
}: OssContributeModalProps) {
  const declaredLicenses = parseMultiValue(row.declaredLicenseList)
  const detectedLicenses = parseMultiValue(row.detectedLicenseList)
  const downloadLocations = parseMultiValue(row.downloadLocationList)

  const hints = useMemo(() => validateOssRow(row), [row])
  const hasFail = useMemo(() => hasValidationFailure(hints), [hints])

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
            <FieldHints hints={hints} field="version" />
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
          <FieldHints hints={hints} field="downloadLocation" />
        </div>

        <div>
          <label className={FIELD_LABEL}>License Combination</label>
          <p className={FIELD_VALUE}>{row.licenseCombination || '-'}</p>
          <FieldHints hints={hints} field="licenseCombination" />
        </div>

        <div>
          <label className={FIELD_LABEL}>Declared License</label>
          {declaredLicenses.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {declaredLicenses.map((lic, i) => (
                <LicenseBadge key={i} value={lic} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">-</p>
          )}
          <FieldHints hints={hints} field="declaredLicense" />
        </div>

        <div>
          <label className={FIELD_LABEL}>Detected License</label>
          {detectedLicenses.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {detectedLicenses.map((lic, i) => (
                <LicenseBadge key={i} value={lic} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">-</p>
          )}
          <FieldHints hints={hints} field="detectedLicense" />
        </div>

        <div>
          <label className={FIELD_LABEL}>Copyright</label>
          <p className={FIELD_VALUE}>{row.copyright || '-'}</p>
          <FieldHints hints={hints} field="copyright" />
        </div>

        {row.descriptionKo && (
          <div>
            <label className={FIELD_LABEL}>Description</label>
            <p className={FIELD_VALUE}>{row.descriptionKo}</p>
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
            disabled={saving || hasFail}
            className="px-4 py-2 text-sm rounded-lg bg-olive-500 text-white hover:bg-olive-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '처리 중...' : '저장'}
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
