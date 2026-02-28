import { externalFetch, getErrorMessage } from './external-api'
import type { ExternalApiResponse } from './types'
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

const API_PREFIX = '/api/v2/admin'

// ─── 쿼리스트링 빌더 ───

function makeListQuery(params: {
  readonly page?: number
  readonly size?: number
  readonly sort?: string
  readonly exactMatch?: boolean
}): string {
  const equalFlag = params.exactMatch === false ? 'N' : 'Y'
  const page = params.page ?? 0
  const size = params.size ?? 10
  const sort = params.sort ?? 'id'
  return `?equalFlag=${equalFlag}&page=${page}&size=${size}&sort=${sort}&direction=ASC`
}

interface OsoriApiResult<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}

function extractListData<T>(response: ExternalApiResponse): OsoriApiResult<readonly T[]> {
  if (!response.success) {
    return { success: false, error: getErrorMessage(response.code) }
  }

  const messageList = response.messageList as { list?: readonly T[] | null }
  return { success: true, data: messageList.list ?? [] }
}

function extractDetailData<T>(response: ExternalApiResponse): OsoriApiResult<T> {
  if (!response.success) {
    return { success: false, error: getErrorMessage(response.code) }
  }

  const messageList = response.messageList as { detailInfo?: T | null }
  return { success: true, data: messageList.detailInfo ?? undefined }
}

function extractCreateData(response: ExternalApiResponse): OsoriApiResult<{ readonly id: number; readonly message: string }> {
  if (!response.success) {
    return { success: false, error: getErrorMessage(response.code) }
  }

  const messageList = response.messageList as { id?: number; message?: string }
  return {
    success: true,
    data: { id: messageList.id ?? 0, message: messageList.message ?? '' },
  }
}

// ─── License API ───

export async function searchLicenses(
  token: string,
  name: string,
  page: number = 0,
  size: number = 10,
  exactMatch: boolean = true,
  spdxIdentifier?: string,
): Promise<OsoriApiResult<readonly OsoriLicense[]>> {
  const query = makeListQuery({ page, size, sort: 'id', exactMatch })
  const nameParam = name.trim() ? `&name=${encodeURIComponent(name.trim())}` : ''
  const spdxParam = spdxIdentifier?.trim() ? `&spdx_identifier=${encodeURIComponent(spdxIdentifier.trim())}` : ''
  const response = await externalFetch(
    `${API_PREFIX}/licenses${query}${nameParam}${spdxParam}`,
    token,
  )
  return extractListData<OsoriLicense>(response)
}

export async function createLicense(
  token: string,
  data: Omit<OsoriLicenseCreateRequest, 'reviewed'>,
): Promise<OsoriApiResult<{ readonly id: number; readonly message: string }>> {
  const body: OsoriLicenseCreateRequest = { ...data, reviewed: false }
  const response = await externalFetch(`${API_PREFIX}/licenses`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return extractCreateData(response)
}

// ─── Restriction API ───

export async function searchRestrictions(
  token: string,
  page: number = 0,
  size: number = 100,
): Promise<OsoriApiResult<readonly OsoriRestriction[]>> {
  const query = makeListQuery({ page, size, sort: 'id', exactMatch: true })
  const response = await externalFetch(
    `${API_PREFIX}/restrictions${query}`,
    token,
  )
  return extractListData<OsoriRestriction>(response)
}

// ─── OSS API ───

export async function searchOss(
  token: string,
  downloadLocation: string,
  page: number = 0,
  size: number = 10,
  exactMatch: boolean = true,
): Promise<OsoriApiResult<readonly OsoriOss[]>> {
  const query = makeListQuery({ page, size, sort: 'oss_master_id', exactMatch })
  const dlParam = downloadLocation.trim()
    ? `&downloadLocation=${encodeURIComponent(downloadLocation.trim())}`
    : ''
  const response = await externalFetch(
    `${API_PREFIX}/oss${query}${dlParam}`,
    token,
  )
  return extractListData<OsoriOss>(response)
}

export async function createOss(
  token: string,
  data: Omit<OsoriOssCreateRequest, 'reviewed'>,
): Promise<OsoriApiResult<OsoriOssCreateSimpleResponse>> {
  const body: OsoriOssCreateRequest = { ...data, reviewed: false }
  const response = await externalFetch(`${API_PREFIX}/oss`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return extractDetailData<OsoriOssCreateSimpleResponse>(response)
}

// ─── OSS Version API ───

export async function searchOssVersions(
  token: string,
  ossMasterId: number,
  page: number = 0,
  size: number = 100,
  exactMatch: boolean = true,
): Promise<OsoriApiResult<readonly OsoriOssVersionListItem[]>> {
  const query = makeListQuery({ page, size, sort: 'ossVersionId', exactMatch })
  const ossIdParam = `&ossMasterId=${ossMasterId}`
  const response = await externalFetch(
    `${API_PREFIX}/oss-versions${query}${ossIdParam}`,
    token,
  )
  return extractListData<OsoriOssVersionListItem>(response)
}

export async function createOssVersion(
  token: string,
  data: Omit<OsoriOssVersionCreateRequest, 'reviewed'>,
): Promise<OsoriApiResult<OsoriOssVersionCreateSimpleResponse>> {
  const body: OsoriOssVersionCreateRequest = { ...data, reviewed: false }
  const response = await externalFetch(`${API_PREFIX}/oss-master-version`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return extractDetailData<OsoriOssVersionCreateSimpleResponse>(response)
}
