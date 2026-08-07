/**
 * 화면에서 링크(`<a href>`)로 렌더해도 안전한 URL인지 판별한다.
 *
 * URL 값은 사용자가 올린 엑셀에서 오므로 신뢰할 수 없다. `javascript:` 같은 스킴이
 * href에 들어가면 클릭 시 스크립트가 실행되므로, http/https 로 파싱되는 값만 링크로
 * 만들고 나머지는 평문으로 표시한다.
 */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false

  try {
    const { protocol } = new URL(value.trim())
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
