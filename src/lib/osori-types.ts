// ─── OSORI API 공통 응답 envelope ───

export interface OsoriListResponse<T> {
  readonly code: string
  readonly success: boolean
  readonly messageList: {
    readonly list: readonly T[] | null
    readonly count: number
  }
}

export interface OsoriCreateResponse {
  readonly code: string
  readonly success: boolean
  readonly messageList: {
    readonly id: number
    readonly message: string
  }
}

export interface OsoriDetailResponse<T> {
  readonly code: string
  readonly success: boolean
  readonly messageList: {
    readonly detailInfo: T | null
    readonly count: number
  }
}

// ─── License ───

export interface OsoriLicense {
  readonly id: number
  readonly name: string
  readonly spdx_identifier?: string | null
  readonly obligation_disclosing_src: string | null
  readonly obligation_notification: boolean | null
  readonly osi_approval: boolean | null
}

export interface OsoriLicenseCreateRequest {
  readonly name: string
  readonly webpage: string
  readonly description?: string
  readonly webpageList?: readonly string[]
  readonly nicknameList?: readonly string[]
  readonly restrictionList?: readonly number[]
  readonly obligation_disclosing_src?: string
  readonly obligation_notification?: boolean
  readonly spdx_identifier?: string
  readonly description_ko?: string
  readonly license_text?: string
  readonly osi_approval?: boolean
  readonly reviewed: false
}

// ─── Restriction ───

export interface OsoriRestriction {
  readonly id: number
  readonly name: string
  readonly description: string | null
  readonly description_ko: string | null
  readonly level: number
  readonly reviewed: number
}

// ─── OSS ───

export interface OsoriOssVersionSimple {
  readonly oss_version_id: number
  readonly version: string | null
  readonly declaredLicense: string
  readonly detectedLicense: string | null
}

export interface OsoriOss {
  readonly oss_master_id: number
  readonly name: string
  readonly reviewed: boolean | null
  readonly purl: string
  readonly version_license_diff: boolean
  readonly version: readonly OsoriOssVersionSimple[]
}

export interface OsoriOssCreateRequest {
  readonly name: string
  readonly download_location: string
  readonly nicknameList?: readonly string[]
  readonly homepage?: string
  readonly description?: string
  readonly compliance_notice?: string
  readonly compliance_notice_ko?: string
  readonly attribution?: string
  readonly publisher?: string
  readonly ignoreFlag?: string
  readonly reviewed: false
}

export interface OsoriOssCreateSimpleResponse {
  readonly oss_master_id: number
  readonly name: string
  readonly purl: string
  readonly reviewed: number
}

// ─── OSS Version ───

export interface OsoriOssVersionListItem {
  readonly oss_version_id: number
  readonly oss_master_id: number
  readonly version: string | null
  readonly reviewed: number
  readonly declaredLicenseList: readonly string[] | null
  readonly detectedLicenseList: readonly string[] | null
  readonly restrictionList: readonly string[] | null
  readonly release_date: string | null
}

export interface OsoriOssVersionCreateRequest {
  readonly version: string
  readonly oss_master_id: number
  readonly description?: string
  readonly attribution?: string
  readonly copyright?: string
  readonly declaredLicenseList?: readonly number[]
  readonly detectedLicenseList?: readonly number[]
  readonly restrictionList?: readonly number[]
  readonly ossMasterDTO?: null
  readonly description_ko?: string
  readonly license_combination?: string
  readonly release_date?: string
  readonly reviewed: false
}

export interface OsoriOssVersionCreateSimpleResponse {
  readonly oss_master_id: number
  readonly oss_version_id: number
  readonly version: string | null
  readonly reviewed: number
}
