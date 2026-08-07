/**
 * 엑셀에서 온 다중값 필드는 줄바꿈 또는 쉼표로 이어진 하나의 문자열로 저장된다.
 * (declaredLicenseList, detectedLicenseList, downloadLocationList, webpageList, restriction, nickName)
 *
 * 분리 규칙이 파일마다 갈라지면 같은 데이터가 화면과 API 요청에서 다르게 해석되므로,
 * 다중값을 다루는 모든 곳은 이 함수를 사용한다.
 */
export function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
