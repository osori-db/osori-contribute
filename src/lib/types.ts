export interface ExcelRow {
  readonly [key: string]: string | number | boolean | null
}

export interface ExcelData {
  readonly headers: readonly string[]
  readonly rows: readonly ExcelRow[]
  readonly fileName: string
}

export type ContributeType = 'license' | 'oss'

export type ContributeStatus = 'idle' | 'loading' | 'success' | 'error' | 'exists'

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

export interface LicenseRow {
  readonly no: number
  readonly licenseName: string
  readonly spdxIdentifier: string
  readonly nickName: string | null
  readonly obligationNotice: boolean
  readonly obligationDisclosingSrc: string
  readonly restriction: string | null
  readonly webpage: string
  readonly webpageList: string | null
  readonly descriptionKo: string | null
}

export interface LicenseData {
  readonly rows: readonly LicenseRow[]
  readonly fileName: string
}

export interface OssRow {
  readonly no: number
  readonly ossName: string
  readonly nickname: string | null
  readonly homepage: string | null
  readonly downloadLocation: string
  readonly downloadLocationList: string | null
  readonly attribution: string | null
  readonly complianceNotice: string | null
  readonly complianceNoticeKo: string | null
  readonly publisher: string | null
  readonly version: string | null
  readonly licenseCombination: string | null
  readonly declaredLicenseList: string | null
  readonly detectedLicenseList: string | null
  readonly copyright: string | null
  readonly releaseDate: string | null
  readonly description: string | null
  readonly descriptionKo: string | null
}

export interface OssData {
  readonly rows: readonly OssRow[]
  readonly fileName: string
}
