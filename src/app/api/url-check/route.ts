import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { MAX_URLS_PER_REQUEST, MAX_URL_LENGTH } from '@/lib/url-check'
import { checkUrlsReachability } from '@/lib/url-reachability'

// fetch 로 외부 주소를 직접 호출하므로 node 런타임을 고정한다.
export const runtime = 'nodejs'

/**
 * 신뢰할 수 없는 배열 입력이므로 개수·길이 상한을 스키마에서 강제한다.
 * 상한은 SSRF 프로브의 비용을 제한하는 방어선이기도 하다.
 */
const urlCheckSchema = z.object({
  urls: z.array(z.string().min(1).max(MAX_URL_LENGTH)).min(1).max(MAX_URLS_PER_REQUEST),
})

function extractToken(request: NextRequest): string | null {
  return request.headers.get('X-Auth-Token')
}

export async function POST(request: NextRequest) {
  // 비인증 SSRF 프로브를 막기 위한 토큰 검사. 값 자체는 쓰지 않고 존재 여부만 본다.
  const token = extractToken(request)
  if (!token) {
    return NextResponse.json(
      { success: false, error: '인증 토큰이 필요합니다.' },
      { status: 401 },
    )
  }

  try {
    const parsed = urlCheckSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: '검사할 URL 목록이 올바르지 않습니다.' },
        { status: 400 },
      )
    }

    // 응답에는 outcome·status·reason 만 담는다. 대상 서버의 본문·헤더는 절대 돌려주지 않는다.
    const results = await checkUrlsReachability(parsed.data.urls)
    return NextResponse.json({ success: true, data: { results } })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.',
      },
      { status: 500 },
    )
  }
}
