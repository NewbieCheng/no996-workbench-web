import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  applyWechatInlineStyles,
  parseMarkdownToHtml,
  type WechatThemeKey,
} from '../../services/social-publish/layout/wechat-markdown-preview'
import type { PreviewDevice } from '../social-studio/studio-types'

type WechatLayoutPreviewProps = {
  markdown: string
  themeKey: WechatThemeKey
  device: PreviewDevice
}

export function WechatLayoutPreview({ markdown, themeKey, device }: WechatLayoutPreviewProps) {
  const { t } = useTranslation('socialPublish')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = parseMarkdownToHtml(markdown)
    applyWechatInlineStyles(ref.current, themeKey)
  }, [markdown, themeKey, device])

  if (!markdown.trim()) return null

  if (device === 'mobile') {
    return (
      <div className="social-studio-layout-preview" key={`wechat-m-${themeKey}`}>
        <div className="social-studio-wechat-mobile">
          <div className="social-studio-wechat-mobile__screen">
            <div className="social-studio-wechat-mobile__bar">{t('phoneWechat')}</div>
            <div ref={ref} className="social-studio-wechat-mobile__scroll" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="social-studio-layout-preview" key={`wechat-pc-${themeKey}`}>
      <div className="social-studio-wechat-pc social-studio-wechat-pc--embedded">
        <div ref={ref} className="social-studio-wechat-pc__scroll" />
      </div>
    </div>
  )
}
