import type { OssRow } from './types'

export type ValidationStatus = 'fail' | 'warn' | 'info'

export interface FieldHint {
  readonly status: ValidationStatus
  readonly message: string
}

export type FieldHints = Partial<Record<string, readonly FieldHint[]>>

function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
}

function hasVersionPrefix(version: string): boolean {
  return /^[vV](?:er(?:sion)?\.?\s*)?/i.test(version)
}

function isGitHash(version: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(version)
}

function hasSemverPreRelease(version: string): boolean {
  return /^\d+\.\d+\.\d+-.+$/.test(version)
}

function addHint(
  hints: Record<string, FieldHint[]>,
  field: string,
  status: ValidationStatus,
  message: string,
): void {
  if (!hints[field]) {
    hints[field] = []
  }
  hints[field].push({ status, message })
}

export function validateOssRow(row: OssRow): FieldHints {
  const hints: Record<string, FieldHint[]> = {}
  const declaredLicenses = parseMultiValue(row.declaredLicenseList)

  // 1. Download location 존재 여부
  if (!row.downloadLocation?.trim()) {
    addHint(hints, 'downloadLocation', 'fail', 'Download location은 필수 항목입니다.')
  }

  // 1. Declared License 존재 여부
  if (declaredLicenses.length === 0) {
    addHint(hints, 'declaredLicense', 'fail', 'Declared License는 필수 항목입니다.')
  }

  // 3. Version 표기 정제
  if (row.version) {
    const version = row.version.trim()
    if (hasVersionPrefix(version)) {
      addHint(hints, 'version', 'warn', 'v/V/ver 접두사를 제거해주세요.')
    }
    if (isGitHash(version)) {
      addHint(hints, 'version', 'fail', 'Git hash 값은 버전으로 사용할 수 없습니다.')
    }
    if (hasSemverPreRelease(version)) {
      addHint(hints, 'version', 'warn', 'Pre-release 버전입니다. 정식 릴리즈 버전을 확인해주세요.')
    }
  }

  // 5. License combination
  if (declaredLicenses.length >= 2 && !row.licenseCombination?.trim()) {
    addHint(
      hints,
      'licenseCombination',
      'fail',
      `Declared License가 ${declaredLicenses.length}개입니다. AND 또는 OR를 지정해주세요.`,
    )
  }

  // 6. Download location 대표 URL
  const downloadList = parseMultiValue(row.downloadLocationList)
  if (downloadList.length > 0 && row.downloadLocation) {
    const isGithub = row.downloadLocation.toLowerCase().includes('github.com')
    if (!isGithub) {
      addHint(hints, 'downloadLocation', 'warn', 'GitHub repository를 대표 URL로 권장합니다.')
    }
  }

  // 7. Copyright 정제
  if (row.copyright?.trim()) {
    addHint(hints, 'copyright', 'info', '대표 Copyright text만 작성했는지 확인해주세요.')
  }

  return hints
}

export function hasValidationFailure(hints: FieldHints): boolean {
  return Object.values(hints).some(
    (fieldHints) => fieldHints?.some((h) => h.status === 'fail'),
  )
}
