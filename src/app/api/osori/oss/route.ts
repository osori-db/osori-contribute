import { NextResponse, type NextRequest } from 'next/server'
import { searchOss, createOss } from '@/lib/osori-api'

function extractToken(request: NextRequest): string | null {
  return request.headers.get('X-Auth-Token')
}

export async function GET(request: NextRequest) {
  const token = extractToken(request)
  if (!token) {
    return NextResponse.json(
      { success: false, error: '인증 토큰이 필요합니다.' },
      { status: 401 },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const downloadLocation = searchParams.get('downloadLocation') ?? ''
    const page = Number(searchParams.get('page') ?? '0')
    const size = Number(searchParams.get('size') ?? '10')
    const exactMatch = searchParams.get('exactMatch') !== 'false'

    const result = await searchOss(token, downloadLocation, page, size, exactMatch)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const token = extractToken(request)
  if (!token) {
    return NextResponse.json(
      { success: false, error: '인증 토큰이 필요합니다.' },
      { status: 401 },
    )
  }

  try {
    const body = await request.json()
    if (!body.name || !body.download_location) {
      return NextResponse.json(
        { success: false, error: 'name, download_location은 필수 항목입니다.' },
        { status: 400 },
      )
    }

    // reviewed 필드는 무조건 false로 강제
    const { reviewed: _ignored, ...data } = body
    const result = await createOss(token, data)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
