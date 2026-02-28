# OSORI Contribute

엑셀 파일의 라이선스/OSS 정보를 OSORI에 기여하는 웹 애플리케이션입니다.

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind CSS 4
- **Language**: TypeScript 5
- **Validation**: Zod 4
- **Excel**: xlsx (SheetJS)
- **Testing**: Vitest + Testing Library
- **Theme**: OLIVE UI 기반 녹색 계열

## 시작하기

### 사전 요구사항

- Node.js 21+
- npm

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

개발 서버: http://localhost:3000

### Docker 실행

```bash
# 이미지 빌드
docker build -t osori-contribute .

# 컨테이너 실행
docker run -p 3000:3000 osori-contribute
```

docker-compose를 사용할 경우:

```bash
docker compose up -d
```

http://localhost:3000 으로 접속합니다.

### 테스트

```bash
# 테스트 실행
npm test

# 테스트 워치 모드
npm run test:watch
```

## 사용 방법

### 1. 로그인

앱 실행 시 OSORI API 인증 토큰을 입력합니다. 토큰은 JWT 형식이며, 세션 동안 유지됩니다 (브라우저 탭 닫으면 자동 로그아웃).

### 2. 라이선스 기여

1. **라이선스** 탭을 선택합니다.
2. 라이선스 정보가 담긴 엑셀 파일(.xlsx, .xls)을 드래그앤드롭하거나 클릭하여 업로드합니다.
3. 엑셀 데이터가 테이블 목록으로 표시됩니다.
4. 각 행의 **기여하기** 버튼을 클릭하여 OSORI API에 데이터를 전송합니다.
5. 버튼 상태로 결과를 확인합니다:
   - 초록색 **완료**: 기여 성공
   - 빨간색 **재시도**: 기여 실패 (클릭하여 재시도 가능)

### 3. OSS 기여

1. **OSS** 탭을 선택합니다.
2. 라이선스 탭과 동일한 방식으로 OSS 엑셀 파일을 업로드합니다.
3. 각 행의 **기여하기** 버튼으로 OSS 데이터를 OSORI에 전송합니다.

### 4. 로그아웃

헤더 우측의 **로그아웃** 버튼을 클릭하면 토큰이 삭제되고 로그인 화면으로 돌아갑니다.

## 프로젝트 구조

```
src/
├── app/                       # Next.js App Router 페이지
│   ├── api/contribute/        # 기여하기 API 프록시 라우트
│   ├── globals.css            # Tailwind + OLIVE 테마
│   ├── layout.tsx             # 루트 레이아웃
│   └── page.tsx               # 메인 페이지 (탭 전환)
├── components/                # React 컴포넌트
│   ├── AuthTokenInput.tsx     # 전체 화면 로그인 폼
│   ├── Header.tsx             # 헤더 (사용자 정보 + 로그아웃)
│   ├── TabNavigation.tsx      # 라이선스/OSS 탭 네비게이션
│   ├── ExcelUploader.tsx      # 드래그앤드롭 엑셀 업로더
│   ├── LicenseTab.tsx         # 라이선스 탭 컨테이너
│   ├── OssTab.tsx             # OSS 탭 컨테이너
│   ├── DataList.tsx           # 엑셀 데이터 테이블 + 기여하기 버튼
│   ├── ContributeButton.tsx   # 기여하기 버튼 (상태별 UI)
│   ├── ErrorMessage.tsx       # 에러 메시지
│   └── LoadingSkeleton.tsx    # 로딩 스켈레톤
├── contexts/
│   └── AuthContext.tsx         # 인증 컨텍스트 (sessionStorage)
├── hooks/
│   ├── useAuth.ts             # 인증 훅
│   └── useExcelData.ts        # 엑셀 파싱 & 데이터 관리 훅
└── lib/
    ├── api-client.ts          # 내부 API 클라이언트
    ├── excel-parser.ts        # 엑셀 파일 파싱 유틸
    ├── external-api.ts        # 외부 API 프록시 유틸
    └── types.ts               # TypeScript 타입 정의
```

## API 아키텍처

```
브라우저 → Next.js API Routes → OSORI 외부 API (https://olis.or.kr:16443)
```

Next.js API Routes가 프록시 역할을 하여 외부 API와 통신합니다.

| 내부 경로 | 외부 경로 | 설명 |
|-----------|-----------|------|
| `POST /api/contribute` (type=license) | `POST /api/v2/admin/licenses` | 라이선스 기여 |
| `POST /api/contribute` (type=oss) | `POST /api/v2/admin/oss` | OSS 기여 |
