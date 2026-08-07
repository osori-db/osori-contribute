'use client'

import { useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { TAB_PATHS, TAB_SCOPED_PARAMS, parseTabFromPathname } from '@/lib/view-params'
import { useAuth } from '@/hooks/useAuth'
import AuthTokenInput from './AuthTokenInput'
import Header from './Header'
import TabNavigation from './TabNavigation'
import LicenseTab from './LicenseTab'
import OssTab from './OssTab'
import type { ContributeType } from '@/lib/types'

type ParamSnapshot = Readonly<Record<string, string>>

export default function HomeView() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTab = parseTabFromPathname(pathname)

  // 떠난 탭의 검색어·표시 개수·페이지. URL에는 보고 있는 탭의 값만 두고,
  // 나머지는 여기에 보관했다가 돌아올 때 되돌린다.
  const [stashed, setStashed] = useState<Readonly<Record<string, ParamSnapshot>>>({})

  const handleTabChange = useCallback(
    (tab: ContributeType) => {
      if (tab === activeTab) return

      const params = new URLSearchParams(searchParams.toString())

      // 떠나는 탭의 값을 걷어내 보관한다.
      const leaving: Record<string, string> = {}
      for (const name of TAB_SCOPED_PARAMS) {
        const value = params.get(name)
        if (value !== null) leaving[name] = value
        params.delete(name)
      }
      setStashed((prev) => ({ ...prev, [activeTab]: leaving }))

      // 들어가는 탭이 마지막에 보던 값을 되돌린다.
      for (const [name, value] of Object.entries(stashed[tab] ?? {})) {
        params.set(name, value)
      }

      const queryString = params.toString()
      router.push(queryString ? `${TAB_PATHS[tab]}?${queryString}` : TAB_PATHS[tab], {
        scroll: false,
      })
    },
    [router, searchParams, activeTab, stashed],
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
