export interface ExcelRow {
  readonly [key: string]: string | number | boolean | null
}

export interface ExcelData {
  readonly headers: readonly string[]
  readonly rows: readonly ExcelRow[]
  readonly fileName: string
}

export type ContributeType = 'license' | 'oss'

export type ContributeStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ContributeRequest {
  readonly type: ContributeType
  readonly data: ExcelRow
}

export interface ContributeResponse {
  readonly success: boolean
  readonly message?: string
}

export interface ApiResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}

export interface ExternalApiResponse {
  readonly code: string
  readonly messageList: Record<string, unknown>
  readonly success: boolean
}

export interface UserInfo {
  readonly userId: string
  readonly companyName: string
  readonly key: string
}
