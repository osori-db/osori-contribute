'use client'

import { collectFailMessages, collectWarnMessages } from '@/lib/field-hints'
import type { RowValidationResult } from '@/lib/pre-validation'

const BADGE_BASE =
  'shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border'

const URL_SKIPPED_NOTE = 'URL 접속 검사 제외'

/** 배지와 힌트 서브행이 같은 기준으로 판단하도록 한 곳에서 집계한다. */
function summarize(result: RowValidationResult) {
  return {
    fails: collectFailMessages(result.hints),
    warns: collectWarnMessages(result.hints),
  }
}

interface ValidationBadgeProps {
  /** 없으면 아무것도 렌더하지 않는다 (미검증 행) */
  readonly result: RowValidationResult | undefined
}

export default function ValidationBadge({ result }: ValidationBadgeProps) {
  if (!result) return null

  const { fails, warns } = summarize(result)
  // URL 접속 검사를 건너뛴 결과는 라벨 뒤 *로 구분한다 — 전량 통과로 오해하면 안 된다.
  const suffix = result.urlChecked ? '' : '*'
  const title = [
    ...fails,
    ...warns,
    ...(result.urlChecked ? [] : [URL_SKIPPED_NOTE]),
  ].join('\n')

  if (fails.length > 0) {
    return (
      <span title={title} className={`${BADGE_BASE} bg-red-50 text-red-700 border-red-200`}>
        차단 {fails.length}
        {suffix}
      </span>
    )
  }

  if (warns.length > 0) {
    return (
      <span title={title} className={`${BADGE_BASE} bg-amber-50 text-amber-700 border-amber-200`}>
        확인 필요 {warns.length}
        {suffix}
      </span>
    )
  }

  return (
    <span
      title={title || '검증 통과'}
      className={`${BADGE_BASE} bg-olive-50 text-olive-700 border-olive-200`}
    >
      검증 통과{suffix}
    </span>
  )
}

interface ValidationHintsRowProps {
  readonly result: RowValidationResult | undefined
  /** 표 컬럼 수. OssList 6 / LicenseList 9 */
  readonly colSpan: number
}

/** 검증 메시지를 기존 오류 서브행과 같은 방식으로 본문 아래에 펼친다. */
export function ValidationHintsRow({ result, colSpan }: ValidationHintsRowProps) {
  if (!result) return null

  const { fails, warns } = summarize(result)
  if (fails.length === 0 && warns.length === 0) return null

  return (
    <tr className={fails.length > 0 ? 'bg-red-50' : 'bg-amber-50'}>
      <td colSpan={colSpan} className="px-3 py-1.5 space-y-0.5">
        {fails.map((message, i) => (
          <p key={`fail-${i}`} className="text-xs text-red-600">
            * {message}
          </p>
        ))}
        {warns.map((message, i) => (
          <p key={`warn-${i}`} className="text-xs text-amber-600">
            * {message}
          </p>
        ))}
      </td>
    </tr>
  )
}
