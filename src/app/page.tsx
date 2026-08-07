import { redirect } from 'next/navigation'
import { DEFAULT_TAB_PATH } from '@/lib/view-params'

/** 루트로 들어오면 기본 탭으로 보낸다. */
export default function RootPage() {
  redirect(DEFAULT_TAB_PATH)
}
