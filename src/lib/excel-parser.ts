import * as XLSX from 'xlsx'
import type { ExcelData, ExcelRow } from './types'

export function parseExcelFile(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          reject(new Error('엑셀 파일에 시트가 없습니다.'))
          return
        }

        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: null,
        })

        if (jsonData.length === 0) {
          reject(new Error('엑셀 파일에 데이터가 없습니다.'))
          return
        }

        const headers = Object.keys(jsonData[0])
        const rows: ExcelRow[] = jsonData.map((row) => {
          const excelRow: Record<string, string | number | boolean | null> = {}
          for (const key of headers) {
            const value = row[key]
            if (value === null || value === undefined) {
              excelRow[key] = null
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              excelRow[key] = value
            } else {
              excelRow[key] = String(value)
            }
          }
          return excelRow
        })

        resolve({
          headers,
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

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']

export function isValidExcelFile(file: File): boolean {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
  return ALLOWED_EXTENSIONS.includes(extension)
}
