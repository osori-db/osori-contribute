import { NextResponse, type NextRequest } from 'next/server'
import { searchOssVersions, createOssVersion } from '@/lib/osori-api'

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
    const ossMasterId = searchParams.get('ossMasterId')
    if (!ossMasterId) {
      return NextResponse.json(
        { success: false, error: 'ossMasterId는 필수 파라미터입니다.' },
        { status: 400 },
      )
    }

    const page = Number(searchParams.get('page') ?? '0')
    const size = Number(searchParams.get('size') ?? '100')
    const exactMatch = searchParams.get('exactMatch') !== 'false'

    const result = await searchOssVersions(token, Number(ossMasterId), page, size, exactMatch)
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
    if (!body.version || !body.oss_master_id) {
      return NextResponse.json(
        { success: false, error: 'version, oss_master_id는 필수 항목입니다.' },
        { status: 400 },
      )
    }

    // reviewed 필드는 무조건 false로 강제
    const { reviewed: _ignored, ...data } = body
    const result = await createOssVersion(token, data)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
