'use client'

interface EditedBadgeProps {
  /** 수정된 항목의 화면 라벨. 툴팁으로 노출된다. */
  readonly fields: readonly string[]
}

export default function EditedBadge({ fields }: EditedBadgeProps) {
  return (
    <span
      title={`수정된 항목: ${fields.join(', ')}`}
      className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-amber-50 text-amber-700 border-amber-200"
    >
      수정됨
    </span>
  )
}
