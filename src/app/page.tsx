import { Suspense } from 'react'
import HomeView from '@/components/HomeView'

/**
 * HomeView가 useSearchParams를 사용하므로 Suspense 경계가 필요하다.
 * 경계가 없으면 정적 프리렌더 단계에서 빌드가 실패한다.
 */
export default function HomePage() {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  )
}
