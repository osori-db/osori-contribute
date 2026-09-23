import type { OsoriLicense } from './osori-types'

/** 화면에 한 번에 내보낼 검색 결과 상한. 686건을 전부 렌더하지 않기 위한 값이다. */
export const LICENSE_SEARCH_LIMIT = 50

/**
 * 선택할 수 없는 사유. 한국어 문구는 컴포넌트가 붙인다 — lib 은 UI 문구를 갖지 않는다.
 * - 'selected-here'       : 이 필드에 이미 선택됨
 * - 'selected-counterpart': 반대편 필드(declared↔detected)에 이미 선택됨 = 규칙 6 위반이 됨
 */
export type LicenseOptionDisabledReason = 'selected-here' | 'selected-counterpart'

export interface LicenseSearchOption {
  readonly license: OsoriLicense
  /** null 이면 선택 가능. */
  readonly disabledReason: LicenseOptionDisabledReason | null
}

export interface SearchLicensesParams {
  readonly licenses: readonly OsoriLicense[]
  /** 사용자가 입력한 검색어. 빈 문자열이면 이름 오름차순 상위 limit 건. */
  readonly query: string
  /** 이 필드에 이미 선택된 이름들. parseMultiValue 결과 그대로 넘긴다. */
  readonly selectedNames: readonly string[]
  /** 반대편 필드에 선택된 이름들. declared 컨트롤이면 detected 의 값. */
  readonly counterpartNames: readonly string[]
  readonly limit?: number
}

/**
 * 이름 비교 키. 규칙 6(oss-validation 의 findDuplicateLicenses)과 동일한 정규화다.
 * 여기가 어긋나면 UI 가 막는 조합과 규칙 6 이 막는 조합이 달라진다.
 */
export function licenseNameKey(name: string): string {
  return name.trim().toLowerCase()
}

/** 단어 경계로 보는 문자. "BSD 3-Clause", "GPL-2.0", "X.Net" 같은 이름을 중간부터 검색하기 위한 것. */
const WORD_BOUNDARY_CHARS = new Set([' ', '-', '.'])

/**
 * 낮을수록 위에 온다. 어디에도 안 걸리면 null — 결과에서 제외한다.
 *
 * 접두 일치를 포함 일치보다 앞세우는 이유: 사용자는 라이선스 이름을 앞에서부터 친다.
 * "mit" 을 쳤을 때 "MIT" 대신 "CMU-MIT-...", "Unicode-DFS(... MIT ...)" 류가 먼저 뜨면
 * 686건 중에서 원하는 항목을 고를 수 없다. spdx 접두를 name 접두보다 앞세우는 것도 같은
 * 이유다 — 짧은 식별자(`MIT`, `GPL-2.0-only`)로 검색하는 쪽이 정식 이름 전체를 치는 쪽보다
 * 흔하다. 단어 경계(rank 3)는 "clause", "public" 처럼 이름 중간 단어로 찾는 경우를 위해
 * 일반 포함(rank 4)보다 한 단계 위에 둔다.
 */
function matchRank(nameKey: string, spdxKey: string, queryKey: string): number | null {
  if (nameKey === queryKey || (spdxKey !== '' && spdxKey === queryKey)) return 0
  if (spdxKey !== '' && spdxKey.startsWith(queryKey)) return 1
  if (nameKey.startsWith(queryKey)) return 2
  if (startsAtWordBoundary(nameKey, queryKey)) return 3
  if (nameKey.includes(queryKey) || (spdxKey !== '' && spdxKey.includes(queryKey))) return 4
  return null
}

function startsAtWordBoundary(nameKey: string, queryKey: string): boolean {
  for (let i = 1; i < nameKey.length; i += 1) {
    if (WORD_BOUNDARY_CHARS.has(nameKey[i - 1]) && nameKey.startsWith(queryKey, i)) return true
  }
  return false
}

/** 사전순. locale 에 의존하지 않도록 `<` 로 비교한다 — 환경마다 순서가 달라지면 테스트가 흔들린다. */
function compareAlphabetically(a: OsoriLicense, b: OsoriLicense): number {
  if (a.name === b.name) return 0
  return a.name < b.name ? -1 : 1
}

/**
 * 같은 랭크 안의 정렬: 짧은 이름 우선 → 사전순.
 * 짧은 쪽을 앞세우는 이유는 접두 일치와 같다 — "mit" 에 대해 "MIT" 가 "MITRE ..." 보다 위여야 한다.
 */
function compareWithinRank(a: OsoriLicense, b: OsoriLicense): number {
  if (a.name.length !== b.name.length) return a.name.length - b.name.length
  return compareAlphabetically(a, b)
}

function resolveDisabledReason(
  nameKey: string,
  selectedKeys: ReadonlySet<string>,
  counterpartKeys: ReadonlySet<string>,
): LicenseOptionDisabledReason | null {
  // 같은 필드 중복이 규칙 6 위반보다 먼저다 — 둘 다 해당하면 사용자에게 가까운 사유를 보여준다.
  if (selectedKeys.has(nameKey)) return 'selected-here'
  if (counterpartKeys.has(nameKey)) return 'selected-counterpart'
  return null
}

function toKeySet(names: readonly string[]): ReadonlySet<string> {
  return new Set(names.map(licenseNameKey))
}

/**
 * 마스터 목록에서 검색어에 맞는 항목을 랭킹 순으로 돌려준다.
 * 이미 선택된 항목도 목록에서 빼지 않고 disabledReason 을 붙여 함께 돌려준다 —
 * 숨기면 사용자가 "왜 안 나오지"를 알 수 없다.
 */
export function searchLicenses(params: SearchLicensesParams): readonly LicenseSearchOption[] {
  const { licenses, query, selectedNames, counterpartNames } = params
  const limit = Math.max(0, params.limit ?? LICENSE_SEARCH_LIMIT)
  const queryKey = licenseNameKey(query)
  const selectedKeys = toKeySet(selectedNames)
  const counterpartKeys = toKeySet(counterpartNames)

  const ranked =
    queryKey === ''
      ? [...licenses].sort(compareAlphabetically)
      : licenses
          .map((license) => ({
            license,
            rank: matchRank(
              licenseNameKey(license.name),
              licenseNameKey(license.spdx_identifier ?? ''),
              queryKey,
            ),
          }))
          .filter((entry): entry is { license: OsoriLicense; rank: number } => entry.rank !== null)
          .sort((a, b) =>
            a.rank !== b.rank ? a.rank - b.rank : compareWithinRank(a.license, b.license),
          )
          .map((entry) => entry.license)

  // 상한은 정렬 뒤에 적용한다 — 먼저 자르면 상위 랭킹이 잘려 나간다.
  return ranked.slice(0, limit).map((license) => ({
    license,
    disabledReason: resolveDisabledReason(
      licenseNameKey(license.name),
      selectedKeys,
      counterpartKeys,
    ),
  }))
}
