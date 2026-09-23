'use client'

import type { ReactNode } from 'react'
import type { FieldHint, FieldHints } from '@/lib/oss-validation'

export const FIELD_LABEL = 'block text-xs font-medium text-gray-500 mb-1'
export const FIELD_VALUE = 'text-sm text-gray-900'

const INPUT_BASE =
  'w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 ' +
  'placeholder:text-gray-300 transition-colors ' +
  'focus:outline-none focus:border-olive-500 focus:ring-2 focus:ring-olive-500/30 ' +
  'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed'

const HINT_COLORS: Record<FieldHint['status'], string> = {
  fail: 'text-red-500',
  warn: 'text-amber-600',
  info: 'text-blue-500',
}

export function FieldHintsView({
  hints,
  field,
}: {
  readonly hints: FieldHints
  readonly field: string
}) {
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

interface FieldShellProps {
  readonly id: string
  readonly label: string
  readonly hints?: FieldHints
  readonly hintField?: string
  readonly help?: string
  readonly children: ReactNode
}

function FieldShell({ id, label, hints, hintField, help, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      {children}
      {help && <p className="mt-1 text-xs text-gray-400">{help}</p>}
      {hints && <FieldHintsView hints={hints} field={hintField ?? id} />}
    </div>
  )
}

interface TextFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly disabled?: boolean
  readonly placeholder?: string
  readonly hints?: FieldHints
  readonly hintField?: string
  readonly help?: string
}

export function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  hints,
  hintField,
  help,
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} hints={hints} hintField={hintField} help={help}>
      <input
        id={id}
        type="text"
        className={INPUT_BASE}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}

interface TextAreaFieldProps extends TextFieldProps {
  readonly rows?: number
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  hints,
  hintField,
  help,
  rows = 2,
}: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} hints={hints} hintField={hintField} help={help}>
      <textarea
        id={id}
        rows={rows}
        className={`${INPUT_BASE} resize-y`}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}

export interface RadioOption {
  /** null 은 "고르지 않음" 이다. 저장 시 그대로 null 로 전달된다. */
  readonly value: string | null
  readonly label: string
}

interface RadioFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string | null
  readonly options: readonly RadioOption[]
  readonly onChange: (value: string | null) => void
  readonly disabled?: boolean
  readonly hints?: FieldHints
  readonly hintField?: string
  readonly help?: string
}

/**
 * 값이 정해진 몇 개 중 하나인 필드. null 을 선택지로 다룬다.
 *
 * 라디오는 스스로 해제할 수 없으므로, 값을 비울 수 있으려면 "선택 안 함" 같은 항목이
 * 목록에 있어야 한다. 그것 없이 두면 한 번 고른 뒤 되돌릴 방법이 없다.
 *
 * 그룹 전체를 가리키는 단일 컨트롤이 없어 `label htmlFor` 대신
 * `role="radiogroup"` + `aria-labelledby` 로 이름을 붙인다.
 */
export function RadioField({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  hints,
  hintField,
  help,
}: RadioFieldProps) {
  return (
    <div>
      <span id={`${id}-label`} className={FIELD_LABEL}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
      >
        {options.map((option, index) => {
          // 값에 공백·슬래시가 들어올 수 있어 값 대신 순번으로 id 를 만든다.
          const optionId = `${id}-option-${index}`
          return (
            <label
              key={optionId}
              htmlFor={optionId}
              className="inline-flex items-center gap-1.5 cursor-pointer has-disabled:cursor-not-allowed"
            >
              <input
                id={optionId}
                type="radio"
                name={id}
                className="w-4 h-4 border-gray-300 text-olive-600 focus:ring-olive-500/40 disabled:cursor-not-allowed"
                checked={value === option.value}
                disabled={disabled}
                onChange={() => onChange(option.value)}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          )
        })}
      </div>
      {help && <p className="mt-1 text-xs text-gray-400">{help}</p>}
      {hints && <FieldHintsView hints={hints} field={hintField ?? id} />}
    </div>
  )
}

interface CheckboxFieldProps {
  readonly id: string
  readonly label: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly disabled?: boolean
}

export function CheckboxField({ id, label, checked, onChange, disabled }: CheckboxFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={`${FIELD_LABEL} cursor-pointer`}>
        {label}
      </label>
      <span className="inline-flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-olive-600 focus:ring-olive-500/40 disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm text-gray-700">{checked ? 'Yes' : 'No'}</span>
      </span>
    </div>
  )
}
