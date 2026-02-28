import { NextResponse, type NextRequest } from 'next/server'
import { searchLicenses, createLicense } from '@/lib/osori-api'

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
    const name = searchParams.get('name') ?? ''
    const page = Number(searchParams.get('page') ?? '0')
    const size = Number(searchParams.get('size') ?? '10')
    const exactMatch = searchParams.get('exactMatch') !== 'false'

    const result = await searchLicenses(token, name, page, size, exactMatch)
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
    if (!body.name || !body.webpage) {
      return NextResponse.json(
        { success: false, error: 'name, webpage는 필수 항목입니다.' },
        { status: 400 },
      )
    }

    // reviewed 필드는 무조건 false로 강제 (body에서 제거 후 createLicense에서 false 설정)
    const { reviewed: _ignored, ...data } = body
    const result = await createLicense(token, data)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
