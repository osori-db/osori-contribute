/**
 * 규칙 4: OSS 행의 라이선스 이름이 OSORI 마스터에 등록되어 있는지 본다.
 *
 * 미등록 이름은 기여 payload 를 만들 때 조용히 누락되므로(useLicenseMapping 의 mapNamesToIds),
 * 그 앞단에서 사용자가 이름을 고칠 수 있도록 fail 로 막는다.
 * 마스터 목록 조회는 주입받는다 — 이 모듈은 순수하게 유지한다.
 */
import type { OssRow } from './types'
import { addHint, type FieldHints, type HintAccumulator } from './field-hints'
import { parseMultiValue } from './multi-value'

export type IsRegisteredLicense = (spdxOrName: string) => boolean

const LICENSE_FIELDS = [
  { hintField: 'declaredLicense', value: (row: OssRow) => row.declaredLicenseList },
  { hintField: 'detectedLicense', value: (row: OssRow) => row.detectedLicenseList },
] as const

function findUnregistered(
  value: string | null,
  isRegistered: IsRegisteredLicense,
): readonly string[] {
  const names = parseMultiValue(value)
  const unregistered = names.filter((name) => !isRegistered(name))
  return Array.from(new Set(unregistered))
}

/**
 * declaredLicenseList / detectedLicenseList 의 모든 이름이 OSORI 마스터에 있는지 본다.
 * 미등록 이름이 하나라도 있으면 해당 필드에 fail 힌트를 남긴다.
 */
export function validateLicenseRegistration(
  row: OssRow,
  isRegistered: IsRegisteredLicense,
): FieldHints {
  const hints: HintAccumulator = {}

  for (const field of LICENSE_FIELDS) {
    const unregistered = findUnregistered(field.value(row), isRegistered)
    if (unregistered.length > 0) {
      addHint(
        hints,
        field.hintField,
        'fail',
        `OSORI에 등록되지 않은 라이선스입니다: ${unregistered.join(', ')}`,
      )
    }
  }

  return hints
}
