import * as XLSX from 'xlsx'
import type { OssData, OssRow } from './types'

const TARGET_SHEET = '입력 항목'

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim()
}

export function parseOssExcel(file: File): Promise<OssData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const sheetName = workbook.SheetNames.includes(TARGET_SHEET)
          ? TARGET_SHEET
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

        const rows: OssRow[] = []
        let rowNumber = 1

        for (const raw of rawData) {
          const ossName = toStringOrNull(raw['OSS Name*']) ?? toStringOrNull(raw['OSS Name'])
          if (!ossName) continue

          rows.push({
            no: rowNumber++,
            ossName,
            nickname: toStringOrNull(raw['Nickname']),
            homepage: toStringOrNull(raw['Homepage']),
            downloadLocation: toStringOrNull(raw['Download location*']) ?? toStringOrNull(raw['Download location']) ?? '',
            downloadLocationList: toStringOrNull(raw['Download location list']),
            attribution: toStringOrNull(raw['Attribution']) ?? toStringOrNull(raw['attribution']),
            complianceNotice: toStringOrNull(raw['compliance_notice']),
            complianceNoticeKo: toStringOrNull(raw['compliance_notice_ko']),
            publisher: toStringOrNull(raw['publisher']),
            version: toStringOrNull(raw['Version']),
            licenseCombination: toStringOrNull(raw['license_combination*']) ?? toStringOrNull(raw['license_combination']),
            declaredLicenseList: toStringOrNull(raw['declaredLicenseList']),
            detectedLicenseList: toStringOrNull(raw['detectedLicenseList']),
            copyright: toStringOrNull(raw['copyright']),
            releaseDate: toStringOrNull(raw['release_date']),
            description: toStringOrNull(raw['description']),
            descriptionKo: toStringOrNull(raw['description_ko']),
          })
        }

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
