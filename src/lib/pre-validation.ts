/**
 * 사전 검증 합성 계층.
 *
 * 오프라인 규칙(필수 항목·URL 형식·version·라이선스 등록·중복)과 네트워크 규칙(URL 접속)은
 * 서로 다른 시점에 만들어지지만, 화면 배지와 기여 차단 판정은 하나로 합쳐진 결과를 봐야 한다.
 * 그 병합 지점이 이 모듈이다.
 */
import type { LicenseRow, OssRow } from './types'
import { mergeFieldHints, type FieldHint, type FieldHints } from './field-hints'
import { urlResultToHint, type UrlCheckResult } from './url-check'
import { validateOssRow } from './oss-validation'
import { validateLicenseRow } from './license-validation'
import {
  validateLicenseRegistration,
  type IsRegisteredLicense,
} from './license-registry-validation'
import { parseMultiValue } from './multi-value'

/** url → 검사 결과. undefined 를 넘기면 URL 규칙(규칙 1)을 건너뛴다. */
export type UrlCheckMap = ReadonlyMap<string, UrlCheckResult>

/** 한 행의 검증 결과. 화면 배지와 기여 차단 판정이 공유한다. */
export interface RowValidationResult {
  readonly hints: FieldHints
  /** URL 접속 검사가 포함된 결과인지. false 면 오프라인 규칙만 반영됨 */
  readonly urlChecked: boolean
  /** 검증 시각(ms). 배지 툴팁·정렬용 */
  readonly checkedAt: number
}

function uniqueNonEmpty(values: readonly (string | null)[]): readonly string[] {
  const trimmed = values.map((value) => value?.trim() ?? '').filter(Boolean)
  return Array.from(new Set(trimmed))
}

/** 규칙 1의 검사 대상 URL 을 행에서 뽑는다. 중복·공백 제거. */
export function collectOssUrls(row: OssRow): readonly string[] {
  return uniqueNonEmpty([row.downloadLocation, ...parseMultiValue(row.downloadLocationList)])
}

export function collectLicenseUrls(row: LicenseRow): readonly string[] {
  return uniqueNonEmpty([row.webpage])
}

/** 주어진 URL 들의 검사 결과를 한 필드의 힌트 목록으로 바꾼다. */
function hintsForUrls(
  field: string,
  urls: readonly string[],
  urlResults: UrlCheckMap,
): FieldHints {
  const hints: FieldHint[] = []

  for (const url of urls) {
    const result = urlResults.get(url)
    if (!result) continue
    const hint = urlResultToHint(result)
    if (hint) {
      hints.push(hint)
    }
  }

  return hints.length > 0 ? { [field]: hints } : {}
}

function ossUrlHints(row: OssRow, urlResults: UrlCheckMap): FieldHints {
  const representative = uniqueNonEmpty([row.downloadLocation])
  const candidates = uniqueNonEmpty(parseMultiValue(row.downloadLocationList))

  return mergeFieldHints(
    hintsForUrls('downloadLocation', representative, urlResults),
    hintsForUrls('downloadLocationList', candidates, urlResults),
  )
}

/**
 * OSS 행의 최종 힌트.
 *   validateOssRow + validateLicenseRegistration + URL 힌트(urlResults 가 있을 때만)
 */
export function buildOssRowHints(
  row: OssRow,
  isRegistered: IsRegisteredLicense,
  urlResults?: UrlCheckMap,
): FieldHints {
  const sources: FieldHints[] = [
    validateOssRow(row),
    validateLicenseRegistration(row, isRegistered),
  ]

  if (urlResults) {
    sources.push(ossUrlHints(row, urlResults))
  }

  return mergeFieldHints(...sources)
}

/** License 행의 최종 힌트. validateLicenseRow + URL 힌트(webpage). 규칙 4 미적용. */
export function buildLicenseRowHints(
  row: LicenseRow,
  urlResults?: UrlCheckMap,
): FieldHints {
  const offline = validateLicenseRow(row)
  if (!urlResults) return mergeFieldHints(offline)

  return mergeFieldHints(
    offline,
    hintsForUrls('webpage', collectLicenseUrls(row), urlResults),
  )
}

/** 힌트를 행 결과로 감싼다. urlChecked 는 urlResults 전달 여부로 정한다. */
export function toRowValidationResult(
  hints: FieldHints,
  urlChecked: boolean,
): RowValidationResult {
  return { hints, urlChecked, checkedAt: Date.now() }
}
