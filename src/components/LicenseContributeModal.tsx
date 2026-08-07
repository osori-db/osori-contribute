'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { CheckboxField, TextAreaField, TextField } from './FormField'
import { validateLicenseRow } from '@/lib/license-validation'
import { hasValidationFailure } from '@/lib/oss-validation'
import { parseMultiValue } from '@/lib/multi-value'
import type { LicenseRow } from '@/lib/types'
import type { OsoriRestriction } from '@/lib/osori-types'

interface LicenseContributeModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly row: LicenseRow
  readonly onSave: (row: LicenseRow) => void
  readonly saving: boolean
  readonly saveError?: string | null
  readonly restrictions: readonly OsoriRestriction[]
  readonly mapNamesToIds: (names: readonly string[]) => readonly number[]
}

const RESTRICTION_COLORS: Record<string, string> = {
  'Network Triggered': 'bg-amber-50 text-amber-700 border-amber-200',
  'Purpose Restriction': 'bg-red-50 text-red-700 border-red-200',
  'Internal Use Only': 'bg-purple-50 text-purple-700 border-purple-200',
}

/** 빈 입력은 null로 되돌린다 — 원본 타입이 `string | null`인 필드의 의미를 유지하기 위함이다. */
function nullify(value: string): string | null {
  return value.trim() === '' ? null : value
}

export default function LicenseContributeModal({
  open,
  onClose,
  row,
  onSave,
  saving,
  saveError,
  restrictions: osoriRestrictions,
  mapNamesToIds,
}: LicenseContributeModalProps) {
  const [draft, setDraft] = useState<LicenseRow>(row)

  // 다른 행이 선택되면 초안을 새 원본으로 되돌린다.
  useEffect(() => {
    setDraft(row)
  }, [row])

  const restrictionNames = parseMultiValue(draft.restriction)

  // 검증은 원본이 아니라 초안 기준이다 — 사용자가 고치면 즉시 반영되어야 한다.
  const hints = useMemo(() => validateLicenseRow(draft), [draft])
  const hasFail = useMemo(() => hasValidationFailure(hints), [hints])

  const restrictionMapping = useMemo(() => {
    if (restrictionNames.length === 0) return []
    const idMap = new Map<string, number>()
    for (const r of osoriRestrictions) {
      idMap.set(r.name.toLowerCase().trim(), r.id)
    }
    return restrictionNames.map((name) => ({
      name,
      id: idMap.get(name.toLowerCase().trim()) ?? null,
    }))
  }, [restrictionNames, osoriRestrictions])

  const unmappedRestrictions = restrictionMapping.filter((r) => r.id === null)

  const availableRestrictions = useMemo(
    () =>
      osoriRestrictions.filter(
        (r) => !restrictionNames.some((n) => n.toLowerCase().trim() === r.name.toLowerCase().trim()),
      ),
    [osoriRestrictions, restrictionNames],
  )

  const addRestriction = useCallback((name: string) => {
    setDraft((p) => ({
      ...p,
      restriction: p.restriction?.trim() ? `${p.restriction}, ${name}` : name,
    }))
  }, [])

  const handleSave = useCallback(() => {
    onSave(draft)
  }, [onSave, draft])

  const handleReset = useCallback(() => {
    setDraft(row)
  }, [row])

  return (
    <Modal open={open} onClose={onClose} title="라이선스 기여하기">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField
            id="license-name"
            label="License Name"
            value={draft.licenseName}
            disabled={saving}
            hints={hints}
            hintField="licenseName"
            onChange={(v) => setDraft((p) => ({ ...p, licenseName: v }))}
          />
          <TextField
            id="license-spdx"
            label="SPDX Identifier"
            value={draft.spdxIdentifier}
            disabled={saving}
            hints={hints}
            hintField="spdxIdentifier"
            onChange={(v) => setDraft((p) => ({ ...p, spdxIdentifier: v }))}
          />
        </div>

        <TextAreaField
          id="license-nickname"
          label="Nick Name"
          value={draft.nickName ?? ''}
          disabled={saving}
          help="쉼표 또는 줄바꿈으로 구분"
          onChange={(v) => setDraft((p) => ({ ...p, nickName: nullify(v) }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <CheckboxField
            id="license-obligation-notice"
            label="Obligation Notice"
            checked={draft.obligationNotice}
            disabled={saving}
            onChange={(checked) => setDraft((p) => ({ ...p, obligationNotice: checked }))}
          />
          <TextField
            id="license-obligation-disclosing-src"
            label="Obligation Disclosing Src"
            value={draft.obligationDisclosingSrc}
            disabled={saving}
            hints={hints}
            hintField="obligationDisclosingSrc"
            onChange={(v) => setDraft((p) => ({ ...p, obligationDisclosingSrc: v }))}
          />
        </div>

        <div>
          <TextAreaField
            id="license-restriction"
            label="Restriction"
            value={draft.restriction ?? ''}
            disabled={saving}
            help="쉼표 또는 줄바꿈으로 구분"
            hints={hints}
            hintField="restriction"
            onChange={(v) => setDraft((p) => ({ ...p, restriction: nullify(v) }))}
          />

          {restrictionMapping.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {restrictionMapping.map((item, i) => {
                const color =
                  RESTRICTION_COLORS[item.name] ?? 'bg-gray-50 text-gray-600 border-gray-200'
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border ${color}`}
                  >
                    {item.name}
                    {item.id !== null ? (
                      <span className="text-[10px] opacity-60">#{item.id}</span>
                    ) : (
                      <span className="text-[10px] text-red-500">?</span>
                    )}
                  </span>
                )
              })}
            </div>
          )}

          {unmappedRestrictions.length > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              * 매핑되지 않은 Restriction: {unmappedRestrictions.map((r) => r.name).join(', ')}
            </p>
          )}

          {availableRestrictions.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] text-gray-400 mb-1">추가 가능한 Restriction</p>
              <div className="flex flex-wrap gap-1.5">
                {availableRestrictions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={saving}
                    onClick={() => addRestriction(r.name)}
                    className="px-2 py-0.5 text-xs rounded border border-dashed border-gray-300 text-gray-500 hover:border-olive-400 hover:text-olive-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    + {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <TextField
          id="license-webpage"
          label="Webpage"
          value={draft.webpage}
          disabled={saving}
          hints={hints}
          hintField="webpage"
          onChange={(v) => setDraft((p) => ({ ...p, webpage: v }))}
        />

        <TextAreaField
          id="license-webpage-list"
          label="Webpage List"
          value={draft.webpageList ?? ''}
          disabled={saving}
          help="쉼표 또는 줄바꿈으로 구분"
          onChange={(v) => setDraft((p) => ({ ...p, webpageList: nullify(v) }))}
        />

        <TextAreaField
          id="license-description-ko"
          label="Description (KO)"
          value={draft.descriptionKo ?? ''}
          disabled={saving}
          onChange={(v) => setDraft((p) => ({ ...p, descriptionKo: nullify(v) }))}
        />

        {saveError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{saveError}</p>
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
              disabled={saving || hasFail}
              className="px-4 py-2 text-sm rounded-lg bg-olive-500 text-white hover:bg-olive-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '처리 중...' : '저장'}
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
