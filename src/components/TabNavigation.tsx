'use client'

import type { ContributeType } from '@/lib/types'

interface TabNavigationProps {
  readonly activeTab: ContributeType
  readonly onTabChange: (tab: ContributeType) => void
}

const TABS: readonly { readonly key: ContributeType; readonly label: string }[] = [
  { key: 'license', label: '라이선스' },
  { key: 'oss', label: 'OSS' },
]

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex border-b border-gray-200">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === tab.key
              ? 'text-olive-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
          {activeTab === tab.key && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-olive-500" />
          )}
        </button>
      ))}
    </div>
  )
}
