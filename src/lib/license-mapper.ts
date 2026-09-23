import type { LicenseRow } from './types'
import type { OsoriLicenseCreateRequest } from './osori-types'
import { parseMultiValue } from './multi-value'

export function toLicenseCreateRequest(
  row: LicenseRow,
  restrictionIds: readonly number[],
): Omit<OsoriLicenseCreateRequest, 'reviewed'> {
  return {
    name: row.licenseName.trim(),
    spdx_identifier: row.spdxIdentifier?.trim() || undefined,
    nicknameList: parseMultiValue(row.nickName),
    obligation_notification: row.obligationNotice,
    obligation_disclosing_src: row.obligationDisclosingSrc || undefined,
    restrictionList: restrictionIds,
    webpage: row.webpage,
    webpageList: parseMultiValue(row.webpageList),
    description_ko: row.descriptionKo?.trim() || undefined,
  }
}
