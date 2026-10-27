import { useEffect, useRef } from 'react'
import { parseMarkdownToHtml } from '../../services/social-publish/layout/wechat-markdown-preview'

type WebArticlePreviewProps = {
  markdown: string
}

export function WebArticlePreview({ markdown }: WebArticlePreviewProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = parseMarkdownToHtml(markdown)
  }, [markdown])

  if (!markdown.trim()) {
    return null
  }

  return (
    <div className="social-studio-layout-preview">
      <div ref={ref} className="social-studio-layout-preview__web" />
    </div>
  )
}
