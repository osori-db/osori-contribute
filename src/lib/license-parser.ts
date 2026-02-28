import * as XLSX from 'xlsx'
import type { LicenseData, LicenseRow } from './types'

const LICENSE_SHEET_NAME = '라이선스 목록 (작성)'

const COLUMN_MAP: Record<string, keyof LicenseRow> = {
  '__EMPTY': 'no',
  'License Name*': 'licenseName',
  'SPDX Identifier': 'spdxIdentifier',
  'Nick Name': 'nickName',
  'Obligation_NOTICE*': 'obligationNotice',
  'Obligation_disclosing_SRC*': 'obligationDisclosingSrc',
  'Restriction ': 'restriction',
  'Restriction': 'restriction',
  'Webpage*': 'webpage',
  'Webpage List': 'webpageList',
  'Description ko': 'descriptionKo',
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim()
}

export function parseLicenseExcel(file: File): Promise<LicenseData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const sheetName = workbook.SheetNames.includes(LICENSE_SHEET_NAME)
          ? LICENSE_SHEET_NAME
          : workbook.SheetNames[0]

        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
          reject(new Error('엑셀 파일에 시트가 없습니다.'))
          return
        }

        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: null,
        })

        if (rawData.length === 0) {
          reject(new Error('엑셀 파일에 데이터가 없습니다.'))
          return
        }

        const rows: LicenseRow[] = rawData.map((raw, index) => ({
          no: typeof raw['__EMPTY'] === 'number' ? raw['__EMPTY'] : index + 1,
          licenseName: toStringOrNull(raw['License Name*']) ?? '',
          spdxIdentifier: toStringOrNull(raw['SPDX Identifier']) ?? '',
          nickName: toStringOrNull(raw['Nick Name']),
          obligationNotice: raw['Obligation_NOTICE*'] === true || raw['Obligation_NOTICE*'] === 'true',
          obligationDisclosingSrc: toStringOrNull(raw['Obligation_disclosing_SRC*']) ?? 'NONE',
          restriction: toStringOrNull(raw['Restriction ']) ?? toStringOrNull(raw['Restriction']),
          webpage: toStringOrNull(raw['Webpage*']) ?? '',
          webpageList: toStringOrNull(raw['Webpage List']),
          descriptionKo: toStringOrNull(raw['Description ko']),
        }))

        resolve({
          rows,
          fileName: file.name,
        })
      } catch (error) {
        reject(new Error(`엑셀 파일 파싱에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('파일을 읽는데 실패했습니다.'))
    }

    reader.readAsArrayBuffer(file)
  })
}

export { COLUMN_MAP }
