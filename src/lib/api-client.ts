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

export async function fetchAllLicenses(
  token: string,
  page: number = 0,
  size: number = 1000,
): Promise<ApiResponse<readonly OsoriLicense[]>> {
  const params = new URLSearchParams({
    name: '',
    page: String(page),
    size: String(size),
    exactMatch: 'false',
  })
  return apiFetch<readonly OsoriLicense[]>(`/api/osori/licenses?${params}`, token)
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
