import type { ExternalApiResponse } from './types'

const EXTERNAL_API_BASE = 'https://olis.or.kr:16443'
const REQUEST_TIMEOUT_MS = 30_000

export async function externalFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<ExternalApiResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${EXTERNAL_API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (response.status === 401) {
      return { code: '401', messageList: {}, success: false }
    }

    if (response.status === 403) {
      return { code: '403', messageList: {}, success: false }
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return {
        code: String(response.status),
        messageList: { error: text },
        success: false,
      }
    }

    if (response.status === 204) {
      return { code: '204', messageList: {}, success: true }
    }

    const data: ExternalApiResponse = await response.json()
    return data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { code: 'TIMEOUT', messageList: {}, success: false }
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export function getErrorMessage(code: string, messageList?: Record<string, unknown>): string {
  const detail = extractDetail(messageList)

  switch (code) {
    case '401':
      return appendDetail('인증 정보가 유효하지 않습니다. 토큰을 확인해주세요.', detail)
    case '403':
      return appendDetail('접근 권한이 없습니다.', detail)
    case 'TIMEOUT':
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.'
    default:
      return appendDetail(`요청 처리에 실패했습니다. (코드: ${code})`, detail)
  }
}

function extractDetail(messageList?: Record<string, unknown>): string {
  if (!messageList) return ''

  // OSORI API 응답에서 에러 상세를 추출
  const candidates = [
    messageList.message,
    messageList.error,
    messageList.detailMessage,
    messageList.errorMessage,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  // 위 필드가 없으면 messageList 전체를 문자열로
  const keys = Object.keys(messageList)
  if (keys.length === 0) return ''

  try {
    const serialized = JSON.stringify(messageList)
    // 너무 길면 자름
    return serialized.length > 300 ? serialized.slice(0, 300) + '…' : serialized
  } catch {
    return ''
  }
}

function appendDetail(base: string, detail: string): string {
  return detail ? `${base} — ${detail}` : base
}
