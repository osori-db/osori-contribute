import type { LicenseRow } from './types'
import type { FieldHints, ValidationStatus } from './oss-validation'

function addHint(
  hints: Record<string, { status: ValidationStatus; message: string }[]>,
  field: string,
  status: ValidationStatus,
  message: string,
): void {
  if (!hints[field]) {
    hints[field] = []
  }
  hints[field].push({ status, message })
}

export function validateLicenseRow(row: LicenseRow): FieldHints {
  const hints: Record<string, { status: ValidationStatus; message: string }[]> = {}

  // 1. License Name 정제
  if (!row.licenseName?.trim()) {
    addHint(hints, 'licenseName', 'fail', 'License Name은 필수 항목입니다.')
  }

  // 3. SPDX Identifier 확인
  if (!row.spdxIdentifier?.trim()) {
    addHint(hints, 'spdxIdentifier', 'info', 'SPDX Identifier가 비어 있으면 자동 생성됩니다.')
  }

  // 4. Webpage에 License text URL 입력
  if (!row.webpage?.trim()) {
    addHint(hints, 'webpage', 'fail', 'License text를 확인할 수 있는 URL을 입력해주세요.')
  }

  // 5. 소스 코드 공개 의무 범위
  if (row.obligationDisclosingSrc && row.obligationDisclosingSrc !== 'NONE') {
    addHint(hints, 'obligationDisclosingSrc', 'info', '소스 코드 공개 범위와 근거 조항을 확인해주세요.')
  }


  return hints
}
