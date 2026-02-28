import type { OssRow } from './types'
import type { OsoriOssCreateRequest, OsoriOssVersionCreateRequest } from './osori-types'

function parseMultiValue(value: string | null): readonly string[] {
  if (!value) return []
  return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
}

/**
 * Download Location에서 purl(Package URL)을 생성한다.
 * GitHub URL → pkg:github/owner/repo
 * 그 외 → 빈 문자열 (purl 생성 불가)
 */
export function buildPurl(downloadLocation: string): string {
  const trimmed = downloadLocation.trim()
  if (!trimmed) return ''

  const githubMatch = trimmed.match(/github\.com\/([^/]+)\/([^/#?]+)/i)
  if (githubMatch) {
    const owner = githubMatch[1].toLowerCase()
    const repo = githubMatch[2].replace(/\.git$/, '').toLowerCase()
    return `pkg:github/${owner}/${repo}`
  }

  return ''
}

export function toOssCreateRequest(
  row: OssRow,
): Omit<OsoriOssCreateRequest, 'reviewed'> {
  return {
    name: row.ossName.trim(),
    download_location: row.downloadLocation.trim(),
    nicknameList: parseMultiValue(row.nickname),
    homepage: row.homepage?.trim() || undefined,
    description: row.description?.trim() || undefined,
    compliance_notice: row.complianceNotice?.trim() || undefined,
    compliance_notice_ko: row.complianceNoticeKo?.trim() || undefined,
    attribution: row.attribution?.trim() || undefined,
    publisher: row.publisher?.trim() || undefined,
  }
}

export function toOssVersionCreateRequest(
  row: OssRow,
  ossMasterId: number,
  declaredLicenseIds: readonly number[],
  detectedLicenseIds: readonly number[],
): Omit<OsoriOssVersionCreateRequest, 'reviewed'> {
  return {
    version: (row.version ?? '').trim(),
    oss_master_id: ossMasterId,
    description: row.description?.trim() || undefined,
    attribution: row.attribution?.trim() || undefined,
    copyright: row.copyright?.trim() || undefined,
    declaredLicenseList: declaredLicenseIds.length > 0 ? declaredLicenseIds : undefined,
    detectedLicenseList: detectedLicenseIds.length > 0 ? detectedLicenseIds : undefined,
    license_combination: row.licenseCombination?.trim() || undefined,
    description_ko: row.descriptionKo?.trim() || undefined,
    release_date: row.releaseDate?.trim() || undefined,
  }
}
