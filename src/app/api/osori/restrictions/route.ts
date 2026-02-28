import { NextResponse, type NextRequest } from 'next/server'
import { searchRestrictions } from '@/lib/osori-api'

export async function GET(request: NextRequest) {
  const token = request.headers.get('X-Auth-Token')
  if (!token) {
    return NextResponse.json(
      { success: false, error: '인증 토큰이 필요합니다.' },
      { status: 401 },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') ?? '0')
    const size = Number(searchParams.get('size') ?? '100')

    const result = await searchRestrictions(token, page, size)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
