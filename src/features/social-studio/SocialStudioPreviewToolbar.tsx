import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PreviewDevice, WechatLayoutView } from './studio-types'
import { WECHAT_THEMES, type WechatThemeKey } from '../../services/social-publish/layout/wechat-markdown-preview'

type SocialStudioPreviewToolbarProps = {
  platform: 'wechat' | 'xhs'
  layoutView?: WechatLayoutView
  onLayoutViewChange?: (v: WechatLayoutView) => void
  device?: PreviewDevice
  onDeviceChange?: (d: PreviewDevice) => void
  themeKey?: WechatThemeKey
  onThemeKeyChange?: (k: WechatThemeKey) => void
  trailing?: ReactNode
}

export function SocialStudioPreviewToolbar({
  platform,
  layoutView = 'wechat',
  onLayoutViewChange,
  device = 'mobile',
  onDeviceChange,
  themeKey = 'green',
  onThemeKeyChange,
  trailing,
}: SocialStudioPreviewToolbarProps) {
  const { t } = useTranslation('socialPublish')

  if (platform === 'xhs') {
    return (
      <div className="social-studio-preview-toolbar">
        <span className="social-studio-preview-toolbar__label">{t('studioXhsPreviewLabel')}</span>
        {trailing}
      </div>
    )
  }

  return (
    <div className="social-studio-preview-toolbar">
      <div className="social-studio-segment" role="group" aria-label={t('studioLayoutSwitch')}>
        <button
          type="button"
          className={`social-studio-segment__btn ${layoutView === 'web' ? 'is-active' : ''}`}
          onClick={() => onLayoutViewChange?.('web')}
        >
          {t('studioLayoutWeb')}
        </button>
        <button
          type="button"
          className={`social-studio-segment__btn social-studio-segment__btn--wechat ${layoutView === 'wechat' ? 'is-active' : ''}`}
          onClick={() => onLayoutViewChange?.('wechat')}
        >
          {t('studioLayoutWechat')}
        </button>
      </div>
      {layoutView === 'wechat' ? (
        <>
          <div className="social-studio-segment social-studio-segment--compact" role="group" aria-label={t('studioDeviceSwitch')}>
            <button
              type="button"
              className={`social-studio-segment__btn social-studio-segment__btn--icon ${device === 'mobile' ? 'is-active' : ''}`}
              onClick={() => onDeviceChange?.('mobile')}
              title={t('studioDeviceMobile')}
            >
              {t('studioDeviceMobileShort')}
            </button>
            <button
              type="button"
              className={`social-studio-segment__btn social-studio-segment__btn--icon ${device === 'pc' ? 'is-active' : ''}`}
              onClick={() => onDeviceChange?.('pc')}
              title={t('studioDevicePc')}
            >
              {t('studioDevicePcShort')}
            </button>
          </div>
          <select
            className="social-studio-theme-select"
            value={themeKey}
            onChange={(e) => onThemeKeyChange?.(e.target.value as WechatThemeKey)}
            aria-label={t('studioThemeSelect')}
          >
            {Object.entries(WECHAT_THEMES).map(([key, meta]) => (
              <option key={key} value={key}>{meta.name}</option>
            ))}
          </select>
        </>
      ) : null}
      {trailing}
    </div>
  )
}
