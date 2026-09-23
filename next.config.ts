import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cloudflare Workers 빌드(`npm run build:cf`)는 Next.js 기본 출력을 쓴다.
  // standalone 산출물은 Docker 이미지에만 필요하므로 DOCKER_BUILD=1 일 때만 만든다.
  // 두 배포 방식이 같은 레포에서 공존하기 위한 분기다.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
}

export default nextConfig
