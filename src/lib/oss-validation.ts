import type { OssRow } from './types'
import { addHint, type FieldHints, type HintAccumulator } from './field-hints'
import { parseMultiValue } from './multi-value'
import { isSafeHttpUrl } from './url'

// 타입과 판정 헬퍼의 정규 위치는 field-hints.ts 다. 기존 import 사이트 호환을 위해 여기서 re-export 한다.
export type { ValidationStatus, FieldHint, FieldHints } from './field-hints'
export { hasValidationFailure } from './field-hints'

function hasVersionPrefix(version: string): boolean {
  return /^[vV](?:er(?:sion)?\.?\s*)?/i.test(version)
}

/**
 * 순수 숫자는 16진수로도 유효하므로 `a-f` 를 최소 하나 요구한다.
 * 이 조건이 없으면 `20240226`(ca-certificates 의 실제 버전) 같은 날짜형 버전이
 * git hash 로 오인된다 — 실데이터에서 차단 84건 중 31건이 이 오탐이었다.
 * 대신 숫자로만 이루어진 단축 해시는 놓치지만, 날짜 버전을 막는 쪽이 훨씬 잦고 해롭다.
 */
function isGitHash(version: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(version) && /[a-f]/i.test(version)
}

function hasSemverPreRelease(version: string): boolean {
  return /^\d+\.\d+\.\d+-.+$/.test(version)
}

/** declared 와 detected 에 같은 이름이 들어간 경우를 찾는다. trim + 대소문자 무시 비교. */
function findDuplicateLicenses(row: OssRow): readonly string[] {
  const declared = parseMultiValue(row.declaredLicenseList)
  const detectedKeys = new Set(
    parseMultiValue(row.detectedLicenseList).map((name) => name.toLowerCase()),
  )

  const duplicates = declared.filter((name) => detectedKeys.has(name.toLowerCase()))
  return Array.from(new Set(duplicates))
}

export function validateOssRow(row: OssRow): FieldHints {
  const hints: HintAccumulator = {}
  const declaredLicenses = parseMultiValue(row.declaredLicenseList)

  // 1. Download location 존재 여부
  if (!row.downloadLocation?.trim()) {
    addHint(hints, 'downloadLocation', 'fail', 'Download location은 필수 항목입니다.')
  } else if (!isSafeHttpUrl(row.downloadLocation)) {
    // 2. Download location URL 형식
    addHint(hints, 'downloadLocation', 'fail', 'Download location은 http/https URL이어야 합니다.')
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

  // 4. declared / detected 중복 금지
  const duplicates = findDuplicateLicenses(row)
  if (duplicates.length > 0) {
    const message = `declared와 detected에 같은 라이선스가 중복 등록되었습니다: ${duplicates.join(', ')}`
    addHint(hints, 'declaredLicense', 'fail', message)
    addHint(hints, 'detectedLicense', 'fail', message)
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
