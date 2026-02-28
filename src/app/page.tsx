'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import AuthTokenInput from '@/components/AuthTokenInput'
import Header from '@/components/Header'
import TabNavigation from '@/components/TabNavigation'
import LicenseTab from '@/components/LicenseTab'
import OssTab from '@/components/OssTab'
import type { ContributeType } from '@/lib/types'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState<ContributeType>('license')

  if (!isAuthenticated) {
    return <AuthTokenInput />
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <Header />
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="p-6">
          {activeTab === 'license' ? <LicenseTab /> : <OssTab />}
        </div>
      </div>
    </main>
  )
}
