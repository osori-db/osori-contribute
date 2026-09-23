'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FIELD_LABEL, FieldHintsView } from './FormField'
import { useDebounce } from '@/hooks/useDebounce'
import { searchLicenses } from '@/lib/license-search'
import type { LicenseOptionDisabledReason, LicenseSearchOption } from '@/lib/license-search'
import type { FieldHints } from '@/lib/oss-validation'
import type { OsoriLicense } from '@/lib/osori-types'

const SEARCH_DEBOUNCE_MS = 150

/** 비활성 사유의 한국어 문구. lib 은 사유 코드만 주고 문구는 화면이 정한다. */
const DISABLED_REASON_TEXT: Record<LicenseOptionDisabledReason, (counterpart: string) => string> = {
  'selected-here': () => '이미 선택됨',
  'selected-counterpart': (counterpart) => `${counterpart}에 이미 선택됨`,
}

/**
 * `from` 에서 `step` 방향으로 처음 만나는 선택 가능한 옵션. 없으면 -1. 순환하지 않는다.
 *
 * 비활성 옵션에 멈추지 않고 건너뛰는 이유: 화살표 이동의 목적은 "선택할 것"을 고르는 것이고,
 * 비활성 항목에 멈추면 Enter 가 아무 일도 하지 않는 막다른 칸이 생긴다. 비활성 항목의 존재와
 * 사유는 목록에 그대로 보이므로(숨기지 않는다) 건너뛰어도 정보는 잃지 않는다.
 */
function findEnabledIndex(
  options: readonly LicenseSearchOption[],
  from: number,
  step: number,
): number {
  for (let i = from; i >= 0 && i < options.length; i += step) {
    if (options[i].disabledReason === null) return i
  }
  return -1
}

interface LicenseBadgeProps {
  readonly name: string
  readonly id: number | null
  readonly loading: boolean
  readonly disabled: boolean
  readonly onRemove: () => void
}

/**
 * 선택된 이름 하나를 보여준다.
 * 마스터에 없는 이름도 지우지 않고 빨간 배지로 남긴다 — 규칙 4의 차단 사유가 화면에 보여야 한다.
 */
function LicenseBadgeWithMapping({ name, id, loading, disabled, onRemove }: LicenseBadgeProps) {
  const unregistered = !loading && id === null

  return (
    <span
      title={unregistered ? 'OSORI에 등록되지 않은 이름입니다' : undefined}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${
        unregistered
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-blue-50 text-blue-700 border-blue-200'
      }`}
    >
      {name}
      {loading ? (
        <span className="text-[10px] opacity-60">...</span>
      ) : id !== null ? (
        <span className="text-[10px] opacity-60">#{id}</span>
      ) : (
        <span className="text-[10px] text-red-500">?</span>
      )}
      <button
        type="button"
        aria-label={`${name} 제거`}
        disabled={disabled}
        onClick={onRemove}
        className="ml-0.5 leading-none opacity-60 hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
      >
        &times;
      </button>
    </span>
  )
}

interface LicenseOptionListProps {
  readonly idPrefix: string
  readonly listboxId: string
  readonly options: readonly LicenseSearchOption[]
  readonly activeIndex: number
  readonly counterpartLabel: string
  readonly onSelect: (option: LicenseSearchOption) => void
}

/** 검색 결과 목록. 비활성 항목도 숨기지 않고 사유와 함께 보여준다(요구사항 5). */
function LicenseOptionList({
  ref,
  idPrefix,
  listboxId,
  options,
  activeIndex,
  counterpartLabel,
  onSelect,
}: LicenseOptionListProps & { readonly ref: React.Ref<HTMLUListElement> }) {
  return (
    <ul
      ref={ref}
      role="listbox"
      id={listboxId}
      className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      {options.map((option, index) => {
        const optionDisabled = option.disabledReason !== null
        return (
          <li
            key={option.license.id}
            id={`${idPrefix}-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            aria-disabled={optionDisabled}
            // 클릭으로 입력 포커스가 빠지면 목록이 먼저 닫혀 선택이 무산된다.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(option)}
            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm ${
              optionDisabled
                ? 'text-gray-400 cursor-not-allowed'
                : `cursor-pointer text-gray-900 ${index === activeIndex ? 'bg-olive-50' : 'hover:bg-gray-50'}`
            }`}
          >
            <span className="truncate">{option.license.name}</span>
            <span className="shrink-0 flex items-center gap-2">
              {option.license.spdx_identifier && (
                <span className="text-[11px] text-gray-400">{option.license.spdx_identifier}</span>
              )}
              {option.disabledReason && (
                <span className="text-[11px] text-gray-400">
                  {DISABLED_REASON_TEXT[option.disabledReason](counterpartLabel)}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export interface LicenseSelectFieldProps {
  /** 입력 요소의 id. 라벨 연결과 aria-controls 접두사로 쓴다. */
  readonly id: string
  /** 영문 도메인 용어 유지: "Declared License" / "Detected License" */
  readonly label: string
  /** 현재 선택된 이름들. 순서를 보존한다. parseMultiValue 결과를 그대로 받는다. */
  readonly selected: readonly string[]
  /** 반대편 필드의 선택값. 규칙 6 비활성 판정에만 쓴다. */
  readonly counterpartSelected: readonly string[]
  /** 반대편 필드 이름. 비활성 사유 문구에 넣는다. 예: "detected" */
  readonly counterpartLabel: string
  readonly licenses: readonly OsoriLicense[]
  /** 배지의 #id 조회. null 이면 미등록으로 본다. */
  readonly lookupLicenseId: (name: string) => number | null
  /** 마스터 목록 로딩 중. 배지의 id 자리를 '...' 로 둔다. */
  readonly registryLoading: boolean
  /** 저장 중 등 전체 잠금. 추가·제거 모두 막힌다. */
  readonly disabled: boolean
  readonly hints?: FieldHints
  readonly hintField?: string
  /** 선택 목록 전체를 새 배열로 돌려준다. 호출자가 joinMultiValue 로 직렬화한다. */
  readonly onChange: (next: readonly string[]) => void
}

/**
 * 마스터 목록에서 검색해 고르는 라이선스 선택 컨트롤.
 *
 * 임의 문자열 입력 경로가 없다 — 추가는 검색 결과 선택으로만 가능하다.
 * 반대편 필드에 이미 선택된 항목은 숨기지 않고 비활성으로 보여 사유를 알린다(규칙 6).
 */
export default function LicenseSelectField({
  id,
  label,
  selected,
  counterpartSelected,
  counterpartLabel,
  licenses,
  lookupLicenseId,
  registryLoading,
  disabled,
  hints,
  hintField,
  onChange,
}: LicenseSelectFieldProps) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const query = useDebounce(input, SEARCH_DEBOUNCE_MS)

  const options = useMemo(
    () =>
      searchLicenses({
        licenses,
        query,
        selectedNames: selected,
        counterpartNames: counterpartSelected,
      }),
    [licenses, query, selected, counterpartSelected],
  )

  // 결과가 바뀌면 활성 위치를 첫 선택 가능 항목으로 되돌린다 — 없어진 항목을 가리키면 안 된다.
  useEffect(() => {
    setActiveIndex(findEnabledIndex(options, 0, 1))
  }, [options])

  // 키보드로 옮긴 활성 항목이 스크롤 밖에 있으면 따라 내려간다.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    const element = listRef.current?.children[activeIndex]
    if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' })
    }
  }, [open, activeIndex])

  const registryUnavailable = registryLoading || licenses.length === 0
  // 고를 목록이 없으면 검색 자체가 의미 없다. 다만 제거는 계속 열어 둔다(§3.5).
  const inputDisabled = disabled || registryUnavailable

  const placeholder = registryLoading
    ? '라이선스 목록을 불러오는 중입니다'
    : licenses.length === 0
      ? '라이선스 목록을 불러오지 못했습니다'
      : '이름 또는 SPDX ID로 검색'

  const handleSelect = useCallback(
    (option: LicenseSearchOption) => {
      if (inputDisabled || option.disabledReason !== null) return
      onChange([...selected, option.license.name])
      setInput('')
      // 목록은 닫지 않는다 — 연속 선택을 위해 열어 둔다.
    },
    [inputDisabled, onChange, selected],
  )

  const handleRemove = useCallback(
    (index: number) => {
      if (disabled) return
      onChange(selected.filter((_, i) => i !== index))
    },
    [disabled, onChange, selected],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        // 닫혀 있으면 아무것도 하지 않는다 — Modal 의 ESC 닫기를 가로채면 안 된다.
        if (!open) return
        event.stopPropagation()
        setOpen(false)
        return
      }

      if (event.key === 'Backspace') {
        if (input === '' && selected.length > 0 && !disabled) {
          event.preventDefault()
          handleRemove(selected.length - 1)
        }
        return
      }

      if (event.key === 'Tab') {
        setOpen(false)
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (inputDisabled) return
        event.preventDefault()
        const down = event.key === 'ArrowDown'
        if (!open) {
          setOpen(true)
          setActiveIndex(
            down ? findEnabledIndex(options, 0, 1) : findEnabledIndex(options, options.length - 1, -1),
          )
          return
        }
        const next = findEnabledIndex(options, activeIndex + (down ? 1 : -1), down ? 1 : -1)
        if (next >= 0) setActiveIndex(next)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (!open || activeIndex < 0) return
        const option = options[activeIndex]
        if (option) handleSelect(option)
      }
    },
    [open, input, selected, disabled, inputDisabled, options, activeIndex, handleRemove, handleSelect],
  )

  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false)
    }
  }, [])

  const listboxId = `${id}-listbox`
  const listOpen = open && !inputDisabled

  return (
    <div ref={containerRef} onBlur={handleBlur}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {selected.map((name, i) => (
            <LicenseBadgeWithMapping
              key={`${name}-${i}`}
              name={name}
              id={lookupLicenseId(name)}
              loading={registryLoading}
              disabled={disabled}
              onRemove={() => handleRemove(i)}
            />
          ))}
        </div>
      )}

      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-300 transition-colors focus:outline-none focus:border-olive-500 focus:ring-2 focus:ring-olive-500/30 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          value={input}
          placeholder={placeholder}
          disabled={inputDisabled}
          onChange={(e) => {
            setInput(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />

        {listOpen && (
          <LicenseOptionList
            ref={listRef}
            idPrefix={id}
            listboxId={listboxId}
            options={options}
            activeIndex={activeIndex}
            counterpartLabel={counterpartLabel}
            onSelect={handleSelect}
          />
        )}
      </div>

      {listOpen && (
        <p aria-live="polite" className="mt-1 text-[11px] text-gray-400">
          {options.length > 0 ? `${options.length}건` : '검색 결과가 없습니다'}
        </p>
      )}

      {hints && <FieldHintsView hints={hints} field={hintField ?? id} />}
    </div>
  )
}
