/**
 * 행 필드 키 → 화면에 보이는 라벨.
 *
 * "수정됨" 표시의 툴팁에서 어떤 항목이 바뀌었는지 사용자에게 알려줄 때 쓴다.
 * 라벨은 모달의 필드 라벨과 일치해야 사용자가 대조할 수 있으므로, 모달 라벨을
 * 바꾸면 이 표도 함께 갱신한다.
 */
export const OSS_FIELD_LABELS: Readonly<Record<string, string>> = {
  ossName: 'OSS Name',
  version: 'Version',
  nickname: 'Nickname',
  publisher: 'Publisher',
  homepage: 'Homepage',
  downloadLocation: 'Download Location',
  downloadLocationList: 'Download Location 후보',
  licenseCombination: 'License Combination',
  declaredLicenseList: 'Declared License',
  detectedLicenseList: 'Detected License',
  copyright: 'Copyright',
  descriptionKo: 'Description (KO)',
  description: 'Description',
  attribution: 'Attribution',
  complianceNotice: 'Compliance Notice',
  complianceNoticeKo: 'Compliance Notice (KO)',
  releaseDate: 'Release Date',
}

export const LICENSE_FIELD_LABELS: Readonly<Record<string, string>> = {
  licenseName: 'License Name',
  spdxIdentifier: 'SPDX Identifier',
  nickName: 'Nick Name',
  obligationNotice: 'Obligation Notice',
  obligationDisclosingSrc: 'Obligation Disclosing Src',
  restriction: 'Restriction',
  webpage: 'Webpage',
  webpageList: 'Webpage List',
  descriptionKo: 'Description (KO)',
}

export function toFieldLabels(
  keys: readonly string[],
  labels: Readonly<Record<string, string>>,
): readonly string[] {
  return keys.map((key) => labels[key] ?? key)
}
