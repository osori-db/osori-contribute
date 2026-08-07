/**
 * 원본 행과 수정된 행을 비교하여 값이 달라진 필드 키를 돌려준다.
 *
 * 모달 편집은 저장 시도 시점에 수정본을 확정하므로, 사용자가 아무것도 바꾸지 않고
 * 저장만 눌러도 수정본이 생긴다. "수정됨" 표시는 실제로 값이 달라진 경우에만 붙어야
 * 하므로 존재 여부가 아니라 값을 비교한다.
 */
export function changedFieldKeys<T extends object>(
  original: T,
  edited: T,
): readonly string[] {
  const keys = new Set<string>([...Object.keys(original), ...Object.keys(edited)])

  return [...keys]
    .filter((key) => !Object.is(original[key as keyof T], edited[key as keyof T]))
    .sort()
}
