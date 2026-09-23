import type { ApiResponse, ContributeResponse, ContributeType, ExcelRow, UserInfo } from './types'
import type {
  OsoriLicense,
  OsoriLicenseCreateRequest,
  OsoriRestriction,
  OsoriOss,
  OsoriOssCreateRequest,
  OsoriOssCreateSimpleResponse,
  OsoriOssVersionListItem,
  OsoriOssVersionCreateRequest,
  OsoriOssVersionCreateSimpleResponse,
} from './osori-types'
import type { UrlCheckData } from './url-check'

async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token,
      ...options.headers,
    },
  })

  const data: ApiResponse<T> = await response.json()
  return data
}

export async function contribute(
  token: string,
  type: ContributeType,
  rowData: ExcelRow
): Promise<ApiResponse<ContributeResponse>> {
  return apiFetch<ContributeResponse>('/api/contribute', token, {
    method: 'POST',
    body: JSON.stringify({ type, data: rowData }),
  })
}

// ─── OSORI License API ───

export async function fetchLicenses(
  token: string,
  name: string,
  page: number = 0,
  size: number = 10,
  exactMatch: boolean = true,
  spdxIdentifier?: string,
): Promise<ApiResponse<readonly OsoriLicense[]>> {
  const params = new URLSearchParams({
    name,
    page: String(page),
    size: String(size),
    exactMatch: String(exactMatch),
  })
  if (spdxIdentifier) {
    params.set('spdxIdentifier', spdxIdentifier)
  }
  return apiFetch<readonly OsoriLicense[]>(`/api/osori/licenses?${params}`, token)
}

/**
 * OSORI 의 `/api/v2/admin/licenses` 는 size 를 100 으로 제한한다.
 * 이보다 크게 보내면 400 이 돌아오고 목록을 통째로 받지 못한다.
 */
export const LICENSE_PAGE_SIZE = 100

/** 안전장치. 100 * 50 = 5000종까지 받는다. */
const LICENSE_MAX_PAGES = 50

function licensePageUrl(page: number): string {
  const params = new URLSearchParams({
    name: '',
    page: String(page),
    size: String(LICENSE_PAGE_SIZE),
    exactMatch: 'false',
  })
  return `/api/osori/licenses?${params}`
}

/**
 * 라이선스 마스터 목록 전체를 페이지를 이어 붙여 받는다.
 *
 * 한 페이지라도 실패하면 부분 목록을 성공으로 돌려주지 않는다. 목록에 빠진
 * 라이선스는 규칙 4가 "OSORI 미등록" 으로 판정해 정상 행까지 막기 때문이다.
 */
export async function fetchAllLicenses(
  token: string,
): Promise<ApiResponse<readonly OsoriLicense[]>> {
  const collected: OsoriLicense[] = []

  try {
    for (let page = 0; page < LICENSE_MAX_PAGES; page++) {
      const result = await apiFetch<readonly OsoriLicense[]>(licensePageUrl(page), token)
      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? '라이선스 목록 조회에 실패했습니다.' }
      }

      collected.push(...result.data)
      if (result.data.length < LICENSE_PAGE_SIZE) break
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '라이선스 목록 조회에 실패했습니다.',
    }
  }

  return { success: true, data: collected }
}

export async function fetchCreateLicense(
  token: string,
  data: Omit<OsoriLicenseCreateRequest, 'reviewed'>,
): Promise<ApiResponse<{ readonly id: number; readonly message: string }>> {
  return apiFetch<{ readonly id: number; readonly message: string }>('/api/osori/licenses', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── OSORI Restriction API ───

export async function fetchRestrictions(
  token: string,
  page: number = 0,
  size: number = 100,
): Promise<ApiResponse<readonly OsoriRestriction[]>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  })
  return apiFetch<readonly OsoriRestriction[]>(`/api/osori/restrictions?${params}`, token)
}

// ─── OSORI OSS API ───

export async function fetchOssList(
  token: string,
  downloadLocation: string,
  page: number = 0,
  size: number = 10,
  exactMatch: boolean = true,
  purl?: string,
): Promise<ApiResponse<readonly OsoriOss[]>> {
  const params = new URLSearchParams({
    downloadLocation,
    page: String(page),
    size: String(size),
    exactMatch: String(exactMatch),
  })
  if (purl) {
    params.set('purl', purl)
  }
  return apiFetch<readonly OsoriOss[]>(`/api/osori/oss?${params}`, token)
}

export async function fetchCreateOss(
  token: string,
  data: Omit<OsoriOssCreateRequest, 'reviewed'>,
): Promise<ApiResponse<OsoriOssCreateSimpleResponse>> {
  return apiFetch<OsoriOssCreateSimpleResponse>('/api/osori/oss', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── OSORI OSS Version API ───

export async function fetchOssVersions(
  token: string,
  ossMasterId: number,
  page: number = 0,
  size: number = 100,
  exactMatch: boolean = true,
): Promise<ApiResponse<readonly OsoriOssVersionListItem[]>> {
  const params = new URLSearchParams({
    ossMasterId: String(ossMasterId),
    page: String(page),
    size: String(size),
    exactMatch: String(exactMatch),
  })
  return apiFetch<readonly OsoriOssVersionListItem[]>(`/api/osori/oss-versions?${params}`, token)
}

export async function fetchCreateOssVersion(
  token: string,
  data: Omit<OsoriOssVersionCreateRequest, 'reviewed'>,
): Promise<ApiResponse<OsoriOssVersionCreateSimpleResponse>> {
  return apiFetch<OsoriOssVersionCreateSimpleResponse>('/api/osori/oss-versions', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── URL 접속 검사 ───

export async function checkUrls(
  token: string,
  urls: readonly string[],
): Promise<ApiResponse<UrlCheckData>> {
  return apiFetch<UrlCheckData>('/api/url-check', token, {
    method: 'POST',
    body: JSON.stringify({ urls }),
  })
}

// ─── Token 파싱 ───

export function parseUserInfoFromToken(token: string): UserInfo | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return {
      userId: payload.userId ?? '',
      companyName: payload.companyName ?? '',
      key: payload.key ?? '',
    }
  } catch {
    return null
  }
}
