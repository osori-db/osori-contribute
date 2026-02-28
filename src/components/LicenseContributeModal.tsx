'use client'

import Modal from './Modal'
import type { LicenseRow } from '@/lib/types'

interface LicenseContributeModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly row: LicenseRow
  readonly onSave: () => void
  readonly saving: boolean
}

const FIELD_LABEL = 'block text-xs font-medium text-gray-500 mb-1'
const FIELD_VALUE = 'text-sm text-gray-900'

const RESTRICTION_COLORS: Record<string, string> = {
  'Network Triggered': 'bg-amber-50 text-amber-700 border-amber-200',
  'Purpose Restriction': 'bg-red-50 text-red-700 border-red-200',
  'Internal Use Only': 'bg-purple-50 text-purple-700 border-purple-200',
}

function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
}

export default function LicenseContributeModal({
  open,
  onClose,
  row,
  onSave,
  saving,
}: LicenseContributeModalProps) {
  const restrictions = parseMultiValue(row.restriction)
  const webpageListUrls = parseMultiValue(row.webpageList)

  return (
    <Modal open={open} onClose={onClose} title="라이선스 기여하기">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={FIELD_LABEL}>License Name</label>
            <p className={FIELD_VALUE}>{row.licenseName}</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>SPDX Identifier</label>
            <p className={FIELD_VALUE}>{row.spdxIdentifier || '-'}</p>
          </div>
        </div>

        {row.nickName && (
          <div>
            <label className={FIELD_LABEL}>Nick Name</label>
            <p className={FIELD_VALUE}>{row.nickName.replace(/\r?\n/g, ', ')}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={FIELD_LABEL}>Obligation Notice</label>
            <p className={FIELD_VALUE}>
              {row.obligationNotice ? (
                <span className="inline-flex items-center gap-1 text-olive-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Yes
                </span>
              ) : (
                <span className="text-gray-400">No</span>
              )}
            </p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Obligation Disclosing Src</label>
            <p className={FIELD_VALUE}>{row.obligationDisclosingSrc}</p>
          </div>
        </div>

        <div>
          <label className={FIELD_LABEL}>Restriction</label>
          {restrictions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {restrictions.map((item, i) => {
                const color = RESTRICTION_COLORS[item] ?? 'bg-gray-50 text-gray-600 border-gray-200'
                return (
                  <span key={i} className={`inline-block px-2.5 py-1 text-xs font-medium rounded border ${color}`}>
                    {item}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">-</p>
          )}
        </div>

        <div>
          <label className={FIELD_LABEL}>Webpage</label>
          <p className={FIELD_VALUE}>{row.webpage || '-'}</p>
          {webpageListUrls.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {webpageListUrls.map((url, i) => (
                <p key={i} className="text-xs text-gray-400">{url}</p>
              ))}
            </div>
          )}
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
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-olive-500 text-white hover:bg-olive-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '처리 중...' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
