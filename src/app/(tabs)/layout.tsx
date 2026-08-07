import { Suspense } from 'react'
import HomeView from '@/components/HomeView'

/**
 * /license 와 /oss 가 공유하는 레이아웃.
 *
 * 화면 전체를 페이지가 아니라 이 레이아웃에서 그린다. App Router는 라우트를 옮겨도
 * 공유 레이아웃을 다시 마운트하지 않으므로, 두 탭에 올린 엑셀 데이터·기여 상태·수정본이
 * 탭을 오갈 때 그대로 유지된다. 페이지에서 그리면 전환할 때마다 전부 사라진다.
 *
 * HomeView가 useSearchParams를 쓰므로 Suspense 경계가 필요하다.
 * 경계가 없으면 정적 프리렌더 단계에서 빌드가 실패한다.
 */
export default function TabsLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <Suspense>
      <HomeView />
      {children}
    </Suspense>
  )
}
