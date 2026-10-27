import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import './social-publish.css'

type PhoneChromeProps = {
  platform: 'wechat' | 'xiaohongshu'
  subtitle?: string
  children: ReactNode
}

export function PhoneChrome({ platform, subtitle, children }: PhoneChromeProps) {
  const { t } = useTranslation('socialPublish')
  const title = platform === 'wechat' ? t('phoneWechat') : t('phoneXhs')
  return (
    <div className="social-phone-shell">
      <div className="social-phone-screen">
        <div className="social-phone-topbar">
          {title}
          {subtitle ? <span className="social-phone-subtitle">{subtitle}</span> : null}
        </div>
        <div className="social-phone-body">{children}</div>
      </div>
    </div>
  )
}
