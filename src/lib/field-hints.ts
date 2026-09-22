/**
 * 필드 단위 검증 힌트의 정규 위치.
 *
 * 힌트는 여러 검증기(OSS 필수 검사, 라이선스 등록 여부, URL 접속 검사)에서 따로 생성된 뒤
 * 한 행의 결과로 합쳐진다. 타입과 병합 규칙이 모듈마다 갈라지면 같은 행이 화면과 기여 차단
 * 판정에서 다르게 해석되므로, 힌트를 다루는 모든 곳은 이 모듈을 사용한다.
 */

export type ValidationStatus = 'fail' | 'warn' | 'info'

export interface FieldHint {
  readonly status: ValidationStatus
  readonly message: string
}

export type FieldHints = Partial<Record<string, readonly FieldHint[]>>

/** 가변 누산기. 검증 함수 내부에서만 쓰고 반환 시 FieldHints 로 좁힌다. */
export type HintAccumulator = Record<string, FieldHint[]>

export function addHint(
  acc: HintAccumulator,
  field: string,
  status: ValidationStatus,
  message: string,
): void {
  if (!acc[field]) {
    acc[field] = []
  }
  acc[field].push({ status, message })
}

/**
 * 여러 검증 결과를 하나로 합친다. 같은 필드의 힌트는 인자 순서대로 이어붙인다.
 * 입력은 변경하지 않고 새 객체를 만든다.
 */
export function mergeFieldHints(...sources: readonly FieldHints[]): FieldHints {
  const merged: HintAccumulator = {}

  for (const source of sources) {
    for (const [field, hints] of Object.entries(source)) {
      if (!hints || hints.length === 0) continue
      merged[field] = merged[field] ? [...merged[field], ...hints] : [...hints]
    }
  }

  return merged
}

export function hasValidationFailure(hints: FieldHints): boolean {
  return Object.values(hints).some(
    (fieldHints) => fieldHints?.some((h) => h.status === 'fail'),
  )
}

function collectMessagesByStatus(
  hints: FieldHints,
  status: ValidationStatus,
): readonly string[] {
  return Object.values(hints).flatMap((fieldHints) =>
    (fieldHints ?? []).filter((h) => h.status === status).map((h) => h.message),
  )
}

/** status==='fail' 인 메시지만 순서대로 뽑는다. errorMessages 표시에 쓴다. */
export function collectFailMessages(hints: FieldHints): readonly string[] {
  return collectMessagesByStatus(hints, 'fail')
}

/** status==='warn' 인 메시지만 뽑는다. 배지 툴팁에 쓴다. */
export function collectWarnMessages(hints: FieldHints): readonly string[] {
  return collectMessagesByStatus(hints, 'warn')
}
