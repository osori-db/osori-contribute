'use client'

import { isSafeHttpUrl } from '@/lib/url'

interface UrlLinkProps {
  readonly url: string
  /** 평문으로 표시할 때의 클래스 */
  readonly className?: string
  /** 링크로 표시할 때의 클래스. 생략하면 className을 그대로 쓴다. */
  readonly linkClassName?: string
}

/**
 * URL을 새 탭 링크로 표시하되, 안전하지 않은 스킴은 평문으로 남긴다.
 *
 * URL은 사용자가 올린 엑셀에서 오므로 `javascript:` 같은 값이 href에 들어가면
 * 클릭 시 스크립트가 실행된다. 링크를 만드는 모든 곳이 같은 판단을 쓰도록 여기로 모은다.
 *
 * 두 클래스를 합치지 않고 통째로 갈아끼우는 이유: 색상 유틸리티가 섞이면
 * 어느 쪽이 이기는지가 Tailwind의 CSS 출력 순서에 달려 예측하기 어렵다.
 */
export default function UrlLink({ url, className, linkClassName }: UrlLinkProps) {
  if (!isSafeHttpUrl(url)) {
    return (
      <span className={className} title={url}>
        {url}
      </span>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClassName ?? className}
      title={url}
    >
      {url}
    </a>
  )
}
