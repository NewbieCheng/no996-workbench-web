import type { WechatThemeKey } from '../../../services/social-publish/layout/wechat-markdown-preview'
import type { XhsPublishMode, WeixinPublishMode } from '../../../services/social-publish/types'
import { SocialStudioMergedStage } from '../SocialStudioMergedStage'
import type {
  PreviewDevice,
  SocialContentMode,
  SocialStudioPlatform,
  StudioStageView,
  WechatLayoutView,
} from '../studio-types'
import type { PhoneFrameSize } from './preview-phone-size'

export type SocialStudioStageBodyProps = {
  stageView: StudioStageView
  platform: SocialStudioPlatform
  contentMode: SocialContentMode
  title: string
  onTitleChange: (value: string) => void
  content: string
  onContentChange: (value: string) => void
  imageUrls: string[]
  onPickImages: (files: FileList | null) => void
  onRemoveImageAt: (index: number) => void
  onReorderImages: (from: number, to: number) => void
  summary?: string
  onSummaryChange?: (value: string) => void
  layoutView: WechatLayoutView
  device: PreviewDevice
  themeKey: WechatThemeKey
  /** 保留给顶栏预览菜单；舞台与编辑共用 MergedStage，不再单独走 ArticlePreviewCanvas */
  phoneSize?: PhoneFrameSize
  onPhoneSizeChange?: (size: PhoneFrameSize) => void
  xhsPublishMode?: XhsPublishMode
  weixinPublishMode?: WeixinPublishMode
}

export function SocialStudioStageBody({
  stageView,
  platform,
  contentMode,
  title,
  onTitleChange,
  content,
  onContentChange,
  imageUrls,
  onPickImages,
  onRemoveImageAt,
  onReorderImages,
  summary = '',
  onSummaryChange,
  layoutView,
  device,
  themeKey,
}: SocialStudioStageBodyProps) {
  const readOnly = stageView === 'preview'

  return (
    <SocialStudioMergedStage
      platform={platform}
      readOnly={readOnly}
      title={title}
      onTitleChange={onTitleChange}
      content={content}
      onContentChange={onContentChange}
      contentMode={contentMode}
      imageUrls={imageUrls}
      onPickImages={onPickImages}
      onRemoveImageAt={onRemoveImageAt}
      onReorderImages={onReorderImages}
      summary={summary}
      onSummaryChange={onSummaryChange}
      layoutView={layoutView}
      device={device}
      themeKey={themeKey}
    />
  )
}
