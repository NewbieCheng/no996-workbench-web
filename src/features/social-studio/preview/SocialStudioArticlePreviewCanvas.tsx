import type { XhsPublishMode } from '../../../services/social-publish/types'
import type { WechatThemeKey } from '../../../services/social-publish/layout/wechat-markdown-preview'
import { XhsStudioPreview, resolveXhsModeForStudio } from '../XhsStudioPreview'
import { WechatStudioPreview } from '../WechatStudioPreview'
import type { PreviewDevice, SocialContentMode, SocialStudioPlatform, WechatLayoutView } from '../studio-types'
import type { WeixinPublishMode } from '../../../services/social-publish/types'
import { ResizablePhoneFrame } from './ResizablePhoneFrame'
import type { PhoneFrameSize } from './preview-phone-size'

type SocialStudioArticlePreviewCanvasProps = {
  platform: SocialStudioPlatform
  contentMode: SocialContentMode
  device: PreviewDevice
  layoutView: WechatLayoutView
  themeKey: WechatThemeKey
  title: string
  content: string
  summary: string
  imageUrls: string[]
  phoneSize: PhoneFrameSize
  onPhoneSizeChange: (size: PhoneFrameSize) => void
  xhsPublishMode?: XhsPublishMode
  weixinPublishMode?: WeixinPublishMode
}

export function SocialStudioArticlePreviewCanvas({
  platform,
  contentMode,
  device,
  layoutView,
  themeKey,
  title,
  content,
  summary,
  imageUrls,
  phoneSize,
  onPhoneSizeChange,
  xhsPublishMode = 'auto',
  weixinPublishMode = 'auto',
}: SocialStudioArticlePreviewCanvasProps) {
  const effectiveXhsMode = resolveXhsModeForStudio(contentMode, xhsPublishMode)

  if (platform === 'xhs') {
    return (
      <div className="studio-preview-canvas studio-preview-canvas--pc">
        <XhsStudioPreview
          title={title}
          content={content}
          summary={summary}
          imageUrls={imageUrls}
          contentMode={contentMode}
          xhsPublishMode={effectiveXhsMode}
        />
      </div>
    )
  }

  const inner = (
    <WechatStudioPreview
      title={title}
      content={content}
      imageUrls={imageUrls}
      contentMode={contentMode}
      layoutView={layoutView}
      device={device}
      themeKey={themeKey}
      weixinPublishMode={weixinPublishMode}
    />
  )
  if (contentMode === 'article' && layoutView === 'wechat' && device === 'mobile') {
    return (
      <div className="studio-preview-canvas studio-preview-canvas--wechat-mobile">
        <ResizablePhoneFrame size={phoneSize} onSizeChange={onPhoneSizeChange} enabled>
          <div className="studio-preview-canvas__wechat-mobile-scale">{inner}</div>
        </ResizablePhoneFrame>
      </div>
    )
  }
  return <div className="studio-preview-canvas">{inner}</div>
}
