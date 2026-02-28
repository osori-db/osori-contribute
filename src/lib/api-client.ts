import type { ApiResponse, ContributeResponse, ContributeType, ExcelRow, UserInfo } from './types'

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
