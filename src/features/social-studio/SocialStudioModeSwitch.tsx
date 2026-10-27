import { useTranslation } from 'react-i18next'
import type { SocialContentMode, SocialStudioPlatform } from './studio-types'

type Props = {
  platform: SocialStudioPlatform
  value: SocialContentMode
  onChange: (mode: SocialContentMode) => void
  className?: string
}

export function SocialStudioModeSwitch({ platform, value, onChange, className }: Props) {
  const { t } = useTranslation('socialPublish')
  const imageTextLabel =
    platform === 'wechat'
      ? t('studioModeWechatSticker', { defaultValue: '贴图模式' })
      : t('studioModeXhsImageText', { defaultValue: '图文' })
  const articleLabel = t('studioModeLongArticle', { defaultValue: '长文章' })
  return (
    <div className={`social-studio-mode-switch ${className ?? ''}`} role="group" aria-label={t('studioContentMode')}>
      <button
        type="button"
        className={value === 'image_text' ? 'is-active' : ''}
        onClick={() => onChange('image_text')}
      >
        {imageTextLabel}
      </button>
      <button
        type="button"
        className={value === 'article' ? 'is-active' : ''}
        onClick={() => onChange('article')}
      >
        {articleLabel}
      </button>
    </div>
  )
}
