---
name: frontend-integration-qa
description: OSORI 기여 도구의 변경사항을 검증할 때 반드시 사용하라. 컴포넌트-훅-lib 경계면 정합성 교차 검증, vitest 테스트 작성/실행, tsc 타입체크, next build 통과 확인, 회귀 점검 작업에 적용된다. "검증", "테스트 작성", "테스트 돌려", "빌드 확인", "QA", "정합성", "회귀" 언급 시 트리거하라. 후속으로 "다시 검증해줘", "테스트 더 추가", "빌드 깨졌어" 요청에도 적용된다.
---

# 통합 정합성 검증

단위 테스트가 전부 통과해도 앱은 깨질 수 있다. 이 스킬이 잡으려는 것은 **파일 하나만 봐서는 보이지 않는 결함**이다.

## 원칙: 존재 확인이 아니라 교차 비교

"컴포넌트가 있는가", "함수가 export되는가"는 검증이 아니다. 검증은 **경계면 양쪽을 동시에 읽고 실제 심볼을 대조**하는 일이다.

각 경계면마다 최소 두 파일을 열어 다음을 확인한다.

### 1. Props 전달

`OssList.tsx` 의 `<OssContributeModal ... />` 속성 ↔ `OssContributeModal.tsx` 의 `interface OssContributeModalProps`

- 필수 prop이 전달되지 않았는가
- 이름이 미묘하게 다른가 (`saveError` vs `errorMessage`)
- 새로 추가한 prop을 호출부가 넘기고 있는가
- 콜백 시그니처가 맞는가 — 특히 `onSave: () => void` 를 `onSave: (row: OssRow) => void` 로 바꿨다면 **모든 호출부**를 확인한다

### 2. 훅 소비

훅의 `return { ... }` ↔ 구조분해 하는 컴포넌트

```
useLicenseMapping → { licenses, licenseMap, loading, error, mapNamesToIds, hasLicense }
useRestrictions   → { restrictions, loading, error, mapNamesToIds }
useOssData        → { ossData, loading, error, handleFile, clearData }
```

구조분해에서 없는 키를 꺼내면 `undefined` 가 조용히 흐르다 런타임에 터진다.

### 3. 타입 ↔ 매퍼

`types.ts` 의 `OssRow`/`LicenseRow` 필드 ↔ `oss-mapper.ts`/`license-mapper.ts` 가 읽는 필드

새 필드를 타입에 추가했는데 매퍼가 읽지 않으면, 화면에는 보이지만 OSORI로는 전송되지 않는다. **타입체크가 절대 못 잡는 결함이다.** 필드가 추가/변경되면 매퍼를 반드시 열어 대조한다.

### 4. 검증 키 ↔ 렌더 키 (가장 조용한 결함)

`*-validation.ts` 의 `addHint(hints, '<키>', ...)` ↔ 모달의 `<FieldHintsView hints={hints} field="<키>" />`

`FieldHints` 는 `Partial<Record<string, ...>>` 이므로 **오타가 나도 컴파일이 통과하고 힌트만 사라진다.** 검증 규칙이 추가·변경될 때마다 양쪽 문자열을 눈으로 하나씩 대조한다.

현재 키 목록:
- OSS: `version`, `downloadLocation`, `licenseCombination`, `declaredLicense`, `detectedLicense`, `copyright`
- License: `licenseName`, `spdxIdentifier`, `obligationDisclosingSrc`, `restriction`, `webpage`

### 5. API 3단 경로

브라우저는 OSORI를 직접 호출하지 않는다. 새 엔드포인트는 세 곳이 모두 있어야 한다:

`api-client.ts` 함수 → `app/api/**/route.ts` → `osori-api.ts` 함수

하나라도 없으면 404 또는 미구현으로 실패한다. 응답 shape(`ApiResponse<T>`)이 세 단계에서 일관되는지도 확인한다.

### 6. 왕복 변환 (편집 기능 도입 시)

편집 UI가 생기면 **파싱 → 편집 → 직렬화 → 파싱** 이 원본과 일치해야 한다.

- 다중값 필드는 `split(/[\n,]/)` 로 파싱된다. 편집 후 다시 합칠 때 이 규칙과 왕복이 맞는가
- `string | null` 필드를 비우면 `null` 로 돌아가는가, 아니면 `''` 로 남아 의미가 바뀌는가
- 편집한 값이 저장 요청(매퍼 입력)에 실제로 반영되는가 — 원본 `row` 가 그대로 매퍼로 가고 있지 않은지 확인한다. **편집 기능에서 가장 흔한 결함이다.**

## 검증 명령

```bash
npx tsc --noEmit      # 타입 정합성
npm test              # vitest 전체
npm run build         # 프로덕션 빌드 (최종 게이트)
```

셋 다 통과해야 완료다. `npm run build` 는 서버/클라이언트 경계 위반(`'use client'` 누락 등)을 여기서만 잡는다.

## 점진적 검증

구현이 전부 끝난 뒤 한 번에 검증하지 않는다. 모듈이 완성될 때마다 그 경계면을 즉시 검증한다. 늦게 발견된 계약 불일치는 그 위에 쌓인 코드까지 되돌리게 만든다.

## 테스트 작성

`src/**/{name}.test.{ts,tsx}` 콜로케이션. `@testing-library/react` + `happy-dom`, `describe`/`it` 서술은 한국어.

새 동작마다 최소 세 가지를 덮는다: 정상 경로 / 빈 값·경계값 / 실패 경로.

편집 기능이라면 추가로:
- 값을 바꾼 뒤 저장하면 **바뀐 값**이 저장 핸들러에 전달되는가
- 취소하면 원본이 유지되는가
- 편집으로 `fail` 힌트가 해소되면 저장 버튼이 열리는가

쿼리는 클래스명이 아니라 텍스트·role 기준으로 한다. 구현 세부에 결합된 테스트는 리팩터링마다 깨져서 신뢰를 잃는다.

## 보고

`_workspace/04_qa_report.md` 에 명령 결과표, 경계면 검증표, 결함 목록(위치·증상·원인·담당), 미해결 항목을 기록한다.

결함은 파일 경로와 줄 번호, 어긋난 두 심볼을 함께 제시한다. 확실하지 않으면 추측을 보고하지 말고 실행해서 확인한다.

## 구현 파일은 직접 고치지 않는다

테스트 파일은 직접 쓴다. 구현 결함은 담당 에이전트(`ui-builder` / `domain-logic`)에게 요청한다. QA가 구현을 고치면 자기가 고친 것을 자기가 검증하게 되어 독립성이 사라진다.
