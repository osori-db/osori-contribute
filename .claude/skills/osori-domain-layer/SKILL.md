---
name: osori-domain-layer
description: OSORI 기여 도구의 src/lib 계층(types.ts, *-validation.ts, *-mapper.ts, *-parser.ts, api-client.ts, osori-api.ts)과 src/app/api 라우트를 작성·수정할 때 반드시 사용하라. 타입 추가/변경, 검증 규칙(FieldHints) 추가, 엑셀 행→OSORI API 요청 매핑, 외부 API 호출 함수 작성, ApiResponse 처리, purl 생성, 파서 수정 작업에 적용된다. "검증 규칙 추가", "타입에 필드 추가", "매퍼 수정", "API 함수 추가", "lib 계층" 언급 시 트리거하라. 후속으로 "검증 로직 고쳐줘", "매핑 다시", "필드 더 추가" 요청에도 적용된다.
---

# OSORI 도메인 계층 규약

`src/lib/**` 는 순수 함수와 타입만 사는 곳이다. React를 import하지 않으므로 DOM 없이 vitest로 직접 테스트된다. 이 순수성이 이 계층의 유일한 설계 제약이자 가장 큰 자산이다.

## 계층 지도

| 파일군 | 책임 | 의존 |
|--------|------|------|
| `types.ts` | 앱 내부 도메인 타입 (`OssRow`, `LicenseRow`, `ApiResponse<T>`) | 없음 |
| `osori-types.ts` | OSORI 외부 API의 요청/응답 타입 | 없음 |
| `*-parser.ts` | 엑셀 시트 → `OssRow`/`LicenseRow` | `types` |
| `*-validation.ts` | 행 → `FieldHints` (사용자에게 보일 힌트) | `types` |
| `*-mapper.ts` | 행 → OSORI API 요청 객체 | `types`, `osori-types` |
| `api-client.ts` | 브라우저 → 자체 `/api/*` 라우트 | `types` |
| `osori-api.ts` | 서버 → OSORI 외부 API | `osori-types` |
| `app/api/**/route.ts` | 토큰을 서버에 두기 위한 프록시 | `osori-api` |

**중요:** `api-client` 와 `osori-api` 는 다른 계층이다. 브라우저는 OSORI를 직접 호출하지 않는다 — 인증 토큰이 서버에만 머물도록 `/api/*` 라우트를 거친다. 새 외부 엔드포인트를 붙일 때는 `osori-api` 함수 + `route.ts` + `api-client` 함수 **세 개**를 모두 만들어야 한다. 하나라도 빠지면 브라우저에서 호출이 닿지 않는다.

## 불변성

모든 도메인 타입 필드는 `readonly`, 배열은 `readonly T[]` 다. 함수는 입력을 절대 수정하지 않는다.

```typescript
// 잘못됨 — 호출자의 객체를 오염시킨다
function withVersion(row: OssRow, version: string): OssRow {
  row.version = version
  return row
}

// 올바름
function withVersion(row: OssRow, version: string): OssRow {
  return { ...row, version }
}
```

배열도 마찬가지다. `push`/`splice`/`sort` 대신 `[...arr, x]`, `arr.filter(...)`, `[...arr].sort(...)` 를 쓴다.

## 검증 규칙: FieldHints

검증은 예외를 던지지 않는다. **필드별 힌트 목록**을 반환하고, 화면이 그것을 표시하며, 저장 버튼은 `fail` 이 하나라도 있으면 잠긴다.

```typescript
export type ValidationStatus = 'fail' | 'warn' | 'info'
export type FieldHints = Partial<Record<string, readonly FieldHint[]>>
```

| 상태 | 의미 | 저장 차단 |
|------|------|----------|
| `fail` | 이대로 보내면 OSORI가 거부하거나 데이터가 잘못됨 | O |
| `warn` | 보낼 수는 있으나 사람이 확인하는 편이 좋음 | X |
| `info` | 참고 안내 | X |

새 규칙을 추가할 때:

1. `addHint(hints, '<필드키>', '<상태>', '<한국어 메시지>')` 형태로 기존 헬퍼를 쓴다
2. **필드 키는 화면의 `<FieldHintsView field="..." />` 와 문자열이 정확히 일치해야 한다.** 타입이 `Partial<Record<string, ...>>` 이므로 오타가 나도 컴파일은 통과하고 힌트만 조용히 사라진다. 규칙을 추가하면 렌더 쪽 키를 반드시 눈으로 대조하라.
3. 메시지는 사용자가 무엇을 해야 하는지 알려준다 — "잘못된 버전" (X) / "v/V/ver 접두사를 제거해주세요." (O)
4. `fail` 로 올릴지는 신중하게 판단한다. 저장을 막는 규칙은 오탐 하나가 사용자를 완전히 멈춰 세운다.

## 다중값 필드

엑셀에서 온 여러 값은 줄바꿈 또는 쉼표로 이어진 **하나의 문자열**로 저장된다 (`declaredLicenseList`, `webpageList`, `downloadLocationList`, `restriction`).

파싱은 항상 동일하다:

```typescript
function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
}
```

이 함수가 여러 파일에 중복돼 있다. 다중값을 새로 다뤄야 하면 이 구현을 그대로 재사용하고, 분리 규칙을 바꾸지 않는다 — 파싱 규칙이 파일마다 갈라지면 같은 데이터가 화면과 요청에서 다르게 해석된다.

## 매퍼

매퍼는 앱 타입 → OSORI 요청 타입 변환만 한다. 검증하지 않고, 네트워크를 호출하지 않는다.

- 라이선스 이름은 매퍼가 아니라 **호출부**에서 ID로 변환된 뒤 전달된다 (`declaredIds`, `detectedIds`). 매퍼가 ID 조회를 하려 들면 순수성이 깨진다.
- `buildPurl(downloadLocation)` 은 실패 시 빈 문자열을 반환한다. 호출부는 빈 값을 "purl 조회 건너뜀"으로 해석한다.

## API 함수 규약

`api-client.ts` 의 모든 함수는 예외를 던지지 않고 `ApiResponse<T>` 를 반환한다:

```typescript
interface ApiResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}
```

호출부는 `if (!result.success)` 로 분기하며 `try/catch` 에 의존하지 않는다. 새 함수도 이 규약을 지킨다 — 하나만 예외를 던지면 호출부가 그 사실을 모른 채 앱이 흰 화면으로 죽는다.

에러 메시지는 사용자에게 그대로 노출되므로 한국어로, 원인을 알 수 있게 쓴다. 다만 토큰·내부 URL·스택은 담지 않는다.

## 입력 검증

외부에서 들어오는 값(엑셀 셀, API 응답, 라우트 요청 바디)은 신뢰하지 않는다. `zod` 가 이미 의존성에 있으므로 라우트 핸들러의 요청 바디는 스키마로 파싱한다.

## 테스트

`src/lib/{name}.test.ts` 로 콜로케이션한다. 이 계층은 순수하므로 mock이 거의 필요 없다 — 필요하다고 느껴지면 대개 순수성이 깨진 신호다.

## 작업 후 확인

```bash
npx tsc --noEmit && npm test
```
