import { useTranslation } from 'react-i18next'
import { Settings2Icon, CheckIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import {
  GlassMenuDropdown,
  GlassMenuDropdownContent,
  GlassMenuDropdownItem,
  GlassMenuDropdownTrigger,
  GlassMenuGroupLabel,
  GlassMenuSeparator,
} from '@no996/ui/glass-menu'
import { WECHAT_THEMES, type WechatThemeKey } from '../../../services/social-publish/layout/wechat-markdown-preview'
import type { PreviewDevice, SocialContentMode, SocialStudioPlatform, WechatLayoutView } from '../studio-types'
import type { PhoneFrameSize } from './preview-phone-size'

type SocialStudioPreviewMenuProps = {
  platform: SocialStudioPlatform
  contentMode: SocialContentMode
  layoutView: WechatLayoutView
  onLayoutViewChange: (v: WechatLayoutView) => void
  device: PreviewDevice
  onDeviceChange: (d: PreviewDevice) => void
  themeKey: WechatThemeKey
  onThemeKeyChange: (k: WechatThemeKey) => void
  phoneSize: PhoneFrameSize
}

function MenuItem({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <GlassMenuDropdownItem onClick={onClick} className="studio-preview-menu__item">
      <span className="studio-preview-menu__check">{active ? <CheckIcon aria-hidden /> : null}</span>
      <span>{label}</span>
    </GlassMenuDropdownItem>
  )
}

export function SocialStudioPreviewMenu({
  platform,
  contentMode,
  layoutView,
  onLayoutViewChange,
  device,
  onDeviceChange,
  themeKey,
  onThemeKeyChange,
}: SocialStudioPreviewMenuProps) {
  const { t } = useTranslation('socialPublish')

  const showWechatLayout = platform === 'wechat' && contentMode === 'article'
  const showDevice = platform === 'xhs' ? contentMode === 'article' || contentMode === 'image_text' : layoutView === 'wechat'
  const showTheme = showWechatLayout && layoutView === 'wechat'

  return (
    <GlassMenuDropdown>
      <GlassMenuDropdownTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="studio-preview-menu__trigger"
            aria-label={t('studioPreviewMenuSettings')}
          >
            <Settings2Icon aria-hidden="true" />
          </Button>
        }
      />
      <GlassMenuDropdownContent align="start" className="studio-preview-menu__content w-56">
        {showWechatLayout ? (
          <>
            <GlassMenuGroupLabel>{t('studioPreviewMenuLayout')}</GlassMenuGroupLabel>
            <MenuItem
              active={layoutView === 'web'}
              label={t('studioLayoutWeb')}
              onClick={() => onLayoutViewChange('web')}
            />
            <MenuItem
              active={layoutView === 'wechat'}
              label={t('studioLayoutWechat')}
              onClick={() => onLayoutViewChange('wechat')}
            />
            <GlassMenuSeparator />
          </>
        ) : null}
        {showDevice ? (
          <>
            <GlassMenuGroupLabel>{t('studioPreviewMenuDevice')}</GlassMenuGroupLabel>
            <MenuItem
              active={device === 'mobile'}
              label={t('studioDeviceMobileShort')}
              onClick={() => onDeviceChange('mobile')}
            />
            <MenuItem
              active={device === 'pc'}
              label={t('studioDevicePcShort')}
              onClick={() => onDeviceChange('pc')}
            />
            <GlassMenuSeparator />
          </>
        ) : null}
        {showTheme ? (
          <>
            <GlassMenuGroupLabel>{t('briefThemeColorLabel')}</GlassMenuGroupLabel>
            {(Object.keys(WECHAT_THEMES) as WechatThemeKey[]).map((key) => (
              <MenuItem
                key={key}
                active={themeKey === key}
                label={WECHAT_THEMES[key].name}
                onClick={() => onThemeKeyChange(key)}
              />
            ))}
          </>
        ) : null}
      </GlassMenuDropdownContent>
    </GlassMenuDropdown>
  )
}
