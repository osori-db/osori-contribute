'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import AuthTokenInput from './AuthTokenInput'
import Header from './Header'
import TabNavigation from './TabNavigation'
import LicenseTab from './LicenseTab'
import OssTab from './OssTab'
import type { ContributeType } from '@/lib/types'

const TAB_PARAM = 'tab'
const DEFAULT_TAB: ContributeType = 'license'

/** URL 파라미터는 사용자가 직접 입력할 수 있으므로 알려진 탭 값만 허용한다. */
function parseTab(raw: string | null): ContributeType {
  return raw === 'oss' || raw === 'license' ? raw : DEFAULT_TAB
}

export default function HomeView() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeTab = parseTab(searchParams.get(TAB_PARAM))

  const handleTabChange = useCallback(
    (tab: ContributeType) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(TAB_PARAM, tab)
      // 탭마다 목록이 다르므로 이전 탭의 페이지 번호를 물려받지 않는다.
      params.delete('page')
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  if (!isAuthenticated) {
    return <AuthTokenInput />
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Header />
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        {/*
          탭을 전환해도 업로드한 파일·기여 상태·수정본이 유지되도록 언마운트하지 않고 숨긴다.
          삼항 연산자로 갈아끼우면 비활성 탭의 상태가 통째로 사라진다.
        */}
        <div className="p-6">
          <div hidden={activeTab !== 'license'}>
            <LicenseTab />
          </div>
          <div hidden={activeTab !== 'oss'}>
            <OssTab />
          </div>
        </div>
      </div>
    </main>
  )
}
