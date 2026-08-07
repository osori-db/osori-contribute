---
name: nextjs-component-patterns
description: OSORI 기여 도구의 React 컴포넌트(src/components)와 커스텀 훅(src/hooks)을 작성·수정할 때 반드시 사용하라. 모달 추가/수정, 리스트·테이블 변경, 폼 입력 필드 추가, 편집 가능한 UI 구현, 상태 관리, Tailwind 스타일링, 훅 작성 작업에 적용된다. "모달", "컴포넌트", "화면", "입력 필드", "수정 가능하게", "버튼", "훅" 언급 시 트리거하라. 후속으로 "UI 다시 고쳐줘", "레이아웃 바꿔줘", "필드 더 넣어줘" 요청에도 적용된다.
---

# OSORI 컴포넌트 규약

## 파일 구조

- `src/components/*.tsx` — 컴포넌트. 클라이언트 컴포넌트는 첫 줄에 `'use client'`.
- `src/hooks/use*.ts` — 상태·부수효과 캡슐화. 반환 타입을 `UseXxxReturn` 인터페이스로 명시하고 객체를 반환한다.
- 기본 export 하나 + 같은 파일 내 비공개 하위 컴포넌트. 하위 컴포넌트가 다른 파일에서도 필요해지면 그때 분리한다.

컴포넌트가 400줄을 넘으면 하위 컴포넌트를 추출한다. `OssList.tsx`(454줄)는 이미 상한이므로 기능을 더하기 전에 추출을 먼저 한다.

## 불변 상태 갱신

도메인 타입은 전부 `readonly` 다. 중첩 상태를 바꿀 때는 경로 전체를 새로 만든다.

```typescript
// 잘못됨 — readonly 위반이자 리렌더가 안 걸린다
selectedRow.row.version = next

// 올바름
setSelectedRow((prev) =>
  prev ? { ...prev, row: { ...prev.row, version: next } } : prev,
)
```

목록 안의 한 항목만 바꿀 때:

```typescript
setRows((prev) => prev.map((r, i) => (i === index ? { ...r, version: next } : r)))
```

`useState` 갱신은 항상 함수형(`setX((prev) => ...)`)을 쓴다. 이 앱은 배치 루프 안에서 상태를 여러 번 갱신하므로, 직접 값을 넣으면 이전 갱신을 덮어쓴다.

## 로직 배치

| 하는 일 | 사는 곳 |
|---------|--------|
| 문자열 파싱, 검증, API 요청 매핑 | `src/lib` (import해서 쓴다) |
| 서버 호출 + 로딩/에러 상태 | `src/hooks` |
| 무엇을 어떻게 보여줄지 | 컴포넌트 |

컴포넌트 안에서 정규식으로 검증하거나 요청 객체를 조립하고 있다면 잘못된 위치다. `domain-logic` 에게 요청한다.

파생값은 `useMemo`, 자식에 넘기는 콜백은 `useCallback` 으로 감싼다 — 이 앱은 최대 수천 행을 렌더한다.

## 모달 패턴

`Modal.tsx` 가 공통 껍데기다. 포털 렌더, ESC 닫기, 배경 클릭 닫기, body 스크롤 잠금, `size`(`default` | `wide`)를 제공한다. 새 모달은 이것을 감싸고 내용만 채운다.

부모는 `selectedRow` 같은 상태가 있을 때만 모달을 마운트한다:

```tsx
{selectedRow && (
  <XxxContributeModal open onClose={...} row={selectedRow.row} ... />
)}
```

이 패턴 덕분에 모달이 닫히면 내부 상태가 언마운트로 초기화된다. 편집 상태를 모달 안에 두는 설계라면 이 초기화 동작에 의존해도 된다.

## 표시 → 편집 전환

읽기 전용 필드를 편집 가능하게 바꿀 때 지킬 것:

- 편집 중인 값은 **원본을 덮어쓰지 않는다.** 초안(draft)을 별도 상태로 두고, 저장 시점에만 상위로 올린다. 취소하면 원본이 그대로 남아야 한다.
- 검증은 초안 값 기준으로 실시간 재계산한다 (`useMemo(() => validateXxx(draft), [draft])`). 저장 버튼 잠금도 초안 기준이어야 한다 — 원본 기준으로 잠그면 사용자가 고쳐도 버튼이 안 열린다.
- 다중값 필드(`declaredLicenseList` 등)는 저장 시 원래의 문자열 형태(줄바꿈/쉼표 연결)로 되돌린다. `lib` 의 파싱 규칙과 왕복이 맞아야 한다.
- `null` 과 빈 문자열을 구분한다. 타입이 `string | null` 인 필드는 비워졌을 때 `null` 로 되돌리는 편이 원본 의미에 맞다.

## 스타일

Tailwind v4. 기존 토큰을 재사용하고 새 색·간격 체계를 도입하지 않는다.

| 용도 | 클래스 |
|------|--------|
| 주 액션 버튼 | `bg-olive-500 hover:bg-olive-600 text-white` / 배치는 `bg-olive-600 hover:bg-olive-700` |
| 보조 버튼 | `border border-gray-300 text-gray-700 hover:bg-gray-50` |
| 비활성 | `disabled:opacity-40 disabled:cursor-not-allowed` |
| 필드 라벨 | `block text-xs font-medium text-gray-500 mb-1` (`FIELD_LABEL` 상수) |
| 필드 값 | `text-sm text-gray-900` (`FIELD_VALUE` 상수) |
| 입력 필드 | 라벨/값과 같은 폭·정렬을 유지하고 `rounded-lg border border-gray-300 px-2 py-1 text-sm` 기준으로 맞춘다 |
| 모서리 | `rounded-lg` (모달 컨테이너만 `rounded-xl`) |
| 힌트 색 | fail `text-red-500` / warn `text-amber-600` / info `text-blue-500` |

## 문구

버튼·안내·에러는 한국어. **필드 라벨은 영문 도메인 용어를 유지한다** (`Download Location`, `Declared License`, `SPDX Identifier`) — OSORI 스키마 용어이므로 번역하면 사용자가 원본 시트와 대조할 수 없다.

## 접근성

- 입력에는 라벨을 연결한다 (`htmlFor` + `id`, 또는 `aria-label`)
- 아이콘만 있는 버튼에는 `aria-label`
- 버튼에는 항상 `type="button"` (폼 안에서 의도치 않은 submit 방지)

## 테스트 가능성

테스트는 클래스명이 아니라 보이는 텍스트와 role로 쿼리한다. 그러니 버튼과 입력에 안정적인 접근 이름을 부여한다. 렌더 구조를 크게 바꿨다면 `OssList.test.tsx` / `LicenseList.test.tsx` 가 깨질 수 있으므로 `integration-qa` 에게 알린다.

## 작업 후 확인

```bash
npx tsc --noEmit && npm test
```
