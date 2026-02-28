import { NextResponse, type NextRequest } from 'next/server'
import { externalFetch, getErrorMessage } from '@/lib/external-api'

export async function POST(request: NextRequest) {
  const token = request.headers.get('X-Auth-Token')

  if (!token) {
    return NextResponse.json(
      { success: false, error: '인증 토큰이 필요합니다.' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { type, data } = body

    if (!type || !data) {
      return NextResponse.json(
        { success: false, error: '요청 데이터가 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const apiPath = type === 'license'
      ? '/api/v2/admin/licenses'
      : '/api/v2/admin/oss'

    const result = await externalFetch(apiPath, token, {
      method: 'POST',
      body: JSON.stringify(data),
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: getErrorMessage(result.code),
      })
    }

    return NextResponse.json({
      success: true,
      data: { success: true, message: '기여가 완료되었습니다.' },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
