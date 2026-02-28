'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { contribute } from '@/lib/api-client'
import ContributeButton from './ContributeButton'
import type { ExcelData, ExcelRow, ContributeStatus, ContributeType } from '@/lib/types'

interface DataListProps {
  readonly data: ExcelData
  readonly type: ContributeType
}

export default function DataList({ data, type }: DataListProps) {
  const { token } = useAuth()
  const [statuses, setStatuses] = useState<Record<number, ContributeStatus>>({})

  const handleContribute = useCallback(async (rowIndex: number, rowData: ExcelRow) => {
    if (!token) return

    setStatuses((prev) => ({ ...prev, [rowIndex]: 'loading' }))

    try {
      const result = await contribute(token, type, rowData)
      setStatuses((prev) => ({
        ...prev,
        [rowIndex]: result.success ? 'success' : 'error',
      }))
    } catch {
      setStatuses((prev) => ({ ...prev, [rowIndex]: 'error' }))
    }
  }, [token, type])

  const visibleHeaders = data.headers.slice(0, 6)
  const hasMore = data.headers.length > 6

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        총 {data.rows.length.toLocaleString()}건
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 scrollbar-visible">
        <table className="text-left" style={{ minWidth: 900 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center w-14">#</th>
              {visibleHeaders.map((header) => (
                <th key={header} className="px-3 py-2.5 text-xs font-semibold text-gray-600">
                  {header}
                </th>
              ))}
              {hasMore && (
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-400">...</th>
              )}
              <th className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-center w-24">작업</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {data.rows.map((row, index) => {
              const status = statuses[index] ?? 'idle'
              return (
                <tr
                  key={index}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-2.5 text-xs text-gray-400 text-center">
                    {index + 1}
                  </td>
                  {visibleHeaders.map((header) => (
                    <td key={header} className="px-3 py-2.5 text-sm text-gray-700 max-w-48 truncate">
                      {row[header] !== null && row[header] !== undefined ? String(row[header]) : '-'}
                    </td>
                  ))}
                  {hasMore && (
                    <td className="px-3 py-2.5 text-xs text-gray-400">...</td>
                  )}
                  <td className="px-3 py-2.5 text-center">
                    <ContributeButton
                      status={status}
                      onClick={() => handleContribute(index, row)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
