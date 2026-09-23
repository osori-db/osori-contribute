/** 다중값을 직렬화할 때 쓰는 구분자. 쉼표가 아닌 이유는 joinMultiValue 주석 참조. */
const MULTI_VALUE_SEPARATOR = '\n'

/**
 * 엑셀에서 온 다중값 필드는 줄바꿈 또는 쉼표로 이어진 하나의 문자열로 저장된다.
 * (declaredLicenseList, detectedLicenseList, downloadLocationList, webpageList, restriction, nickName)
 *
 * 분리 규칙이 파일마다 갈라지면 같은 데이터가 화면과 API 요청에서 다르게 해석되므로,
 * 다중값을 다루는 모든 곳은 이 함수를 사용한다.
 *
 * ── 줄바꿈 우선인 이유 ──
 * 줄바꿈이 하나라도 있으면 줄바꿈으로만 쪼갠다. 없을 때만 쉼표로 쪼갠다.
 *
 * 이름 자체에 쉼표가 든 라이선스가 OSORI 마스터 686종 중 5종 있다
 * (예: "Server Side Public License, v 1"). 쉼표를 항상 구분자로 보면 이 5종은
 * 저장했다가 다시 읽는 순간 두 개로 쪼개져 미등록 이름이 된다. 반대로 이름에
 * 줄바꿈이 든 항목은 0종이므로, 줄바꿈이 있는 문자열은 줄바꿈만 구분자로 봐도 안전하다.
 *
 * 이 변경은 실데이터의 해석을 바꾸지 않는다. 첨부3 OSS Self-Checklist(3835행)와
 * 첨부2 License-checklist 의 모든 다중값 컬럼에서 줄바꿈과 쉼표를 **함께** 쓴 셀은
 * 0건이다. 즉 둘 중 하나만 쓰이므로 우선순위를 정해도 기존 셀의 분리 결과가 같다.
 * 오히려 "쉼표 든 이름 + 줄바꿈" 형태의 셀을 지금보다 올바르게 읽는다.
 */
export function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  const separator = value.includes(MULTI_VALUE_SEPARATOR) ? MULTI_VALUE_SEPARATOR : ','
  return value
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 선택 결과를 다중값 문자열로 되돌린다. parseMultiValue 의 짝이다.
 *
 * 구분자는 줄바꿈이다 — 쉼표가 아니다. 이름에 쉼표가 든 라이선스 5종을 쉼표로 이으면
 * 다음 파싱에서 한 이름이 둘로 쪼개진다.
 *
 * ── 단일 값 뒤에 줄바꿈을 붙이는 이유 ──
 * parseMultiValue 는 줄바꿈이 하나도 없는 문자열을 쉼표로 쪼갠다. 따라서 쉼표를 품은
 * 이름 **하나만** 선택한 경우(줄바꿈이 생기지 않는 경우)는 그대로 두면 왕복이 깨진다.
 * 끝에 줄바꿈을 붙여 "줄바꿈이 있는 문자열"로 만들면 parseMultiValue 가 줄바꿈 모드로
 * 읽고, 마지막에 생기는 빈 조각은 filter(Boolean) 이 버리므로 결과는 값 하나 그대로다.
 * 값 안에 쉼표가 없으면 굳이 붙이지 않는다 — 불필요한 후행 개행을 데이터에 남기지 않는다.
 *
 * 보장되는 불변식: xs 가 trim 된 비어있지 않은 문자열들이고 줄바꿈을 포함하지 않으면
 *   parseMultiValue(joinMultiValue(xs)) 는 xs 와 같다.
 */
export function joinMultiValue(values: readonly string[]): string | null {
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  if (cleaned.length === 0) return null

  const joined = cleaned.join(MULTI_VALUE_SEPARATOR)
  const needsSeparatorMarker = !joined.includes(MULTI_VALUE_SEPARATOR) && joined.includes(',')
  return needsSeparatorMarker ? `${joined}${MULTI_VALUE_SEPARATOR}` : joined
}
