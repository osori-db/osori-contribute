'use client'

import Modal from './Modal'
import type { ContributeStatus } from '@/lib/types'

interface FailedItem {
  readonly no: number
  readonly name: string
  readonly error: string
}

interface BatchResultModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly rows: readonly { readonly no: number; readonly name: string }[]
  readonly statuses: Readonly<Record<number, ContributeStatus>>
  readonly errorMessages: Readonly<Record<number, string>>
}

export default function BatchResultModal({
  open,
  onClose,
  rows,
  statuses,
  errorMessages,
}: BatchResultModalProps) {
  let successCount = 0
  let existsCount = 0
  let errorCount = 0
  let skippedCount = 0
  const failedItems: FailedItem[] = []

  for (let i = 0; i < rows.length; i++) {
    const status = statuses[i]
    switch (status) {
      case 'success':
        successCount++
        break
      case 'exists':
        existsCount++
        break
      case 'error':
        errorCount++
        failedItems.push({
          no: rows[i].no,
          name: rows[i].name,
          error: errorMessages[i] ?? '알 수 없는 오류',
        })
        break
      default:
        skippedCount++
        break
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="기여 결과" size="wide">
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard label="성공" count={successCount} color="text-green-700 bg-green-50 border-green-200" />
          <SummaryCard label="이미 존재" count={existsCount} color="text-blue-700 bg-blue-50 border-blue-200" />
          <SummaryCard label="실패" count={errorCount} color="text-red-700 bg-red-50 border-red-200" />
          <SummaryCard label="미처리" count={skippedCount} color="text-gray-700 bg-gray-50 border-gray-200" />
        </div>

        {failedItems.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              실패 항목 ({failedItems.length}건)
            </h3>
            <div className="border border-red-200 rounded-lg overflow-auto max-h-[50vh]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-red-50 border-b border-red-200 sticky top-0">
                    <th className="px-3 py-2 text-xs font-semibold text-red-700 w-12">No</th>
                    <th className="px-3 py-2 text-xs font-semibold text-red-700 w-48">이름</th>
                    <th className="px-3 py-2 text-xs font-semibold text-red-700">오류 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {failedItems.map((item) => (
                    <tr key={item.no} className="border-b border-red-100 last:border-b-0">
                      <td className="px-3 py-2 text-xs text-gray-500">{item.no}</td>
                      <td className="px-3 py-2 text-xs text-gray-900 font-medium">{item.name}</td>
                      <td className="px-3 py-2 text-xs text-red-600">{item.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {failedItems.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">
            실패한 항목이 없습니다.
          </p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SummaryCard({ label, count, color }: { readonly label: string; readonly count: number; readonly color: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${color}`}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  )
}
