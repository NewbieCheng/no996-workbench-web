import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { WeixinPublishMode } from '../../services/social-publish/types'
import type { WechatThemeKey } from '../../services/social-publish/layout/wechat-markdown-preview'
import { SocialStudioShell } from '../social-studio/SocialStudioShell'
import { SocialStudioModeSwitch } from '../social-studio/SocialStudioModeSwitch'
import { SocialStudioStageFrame } from '../social-studio/SocialStudioStageFrame'
import { SocialStudioStageViewSwitch } from '../social-studio/SocialStudioStageViewSwitch'
import { SocialStudioPreviewMenu } from '../social-studio/preview/SocialStudioPreviewMenu'
import { SocialStudioStageBody } from '../social-studio/preview/SocialStudioStageBody'
import type {
  PreviewDevice,
  SocialContentMode,
  StudioStageView,
  WechatLayoutView,
} from '../social-studio/studio-types'
import type { PhoneFrameSize } from '../social-studio/preview/preview-phone-size'
import { RewriteGenerationOverlay } from '../social-studio/rewrite/RewriteGenerationOverlay'
import { RewriteResultDualPane } from '../social-studio/rewrite/RewriteResultDualPane'
import type {
  SocialStudioRewriteSettings,
  SocialStudioRewriteSession,
} from '../social-studio/rewrite/social-studio-rewrite-types'

export type WechatArticleInspirationStudioPanelProps = {
  prepCollapsed: boolean
  onPrepCollapsedChange: (collapsed: boolean) => void
  prepCollapseLabel: string
  prep: ReactNode
  contentMode: SocialContentMode
  onContentModeChange: (mode: SocialContentMode) => void
  layoutView: WechatLayoutView
  onLayoutViewChange: (view: WechatLayoutView) => void
  device: PreviewDevice
  onDeviceChange: (device: PreviewDevice) => void
  themeKey: WechatThemeKey
  onThemeKeyChange: (key: WechatThemeKey) => void
  phoneSize: PhoneFrameSize
  stageView: StudioStageView
  editLocked: boolean
  onStageViewChange: (view: StudioStageView) => void
  generating: boolean
  isRewriteMode: boolean
  rewriteSettings: SocialStudioRewriteSettings
  rewriteProgress: number
  stageLabel?: string
  rewriteSession: SocialStudioRewriteSession | null
  selectedTitleIndex: number
  onSelectTitleIndex: (index: number) => void
  onApplyRewrite: () => void
  onRegenerate: () => void
  onDismissRewrite: () => void
  title: string
  onTitleChange: (value: string) => void
  content: string
  onContentChange: (value: string) => void
  effectiveImageUrls: string[]
  onPickImages: (files: FileList | null) => void
  onRemoveImageAt: (index: number) => void
  onReorderImages: (from: number, to: number) => void
  onPhoneSizeChange: (size: PhoneFrameSize) => void
  weixinPublishMode: WeixinPublishMode
}

/** 公众号 · 灵感创作双栏工作台（独立板块） */
export function WechatArticleInspirationStudioPanel({
  prepCollapsed,
  onPrepCollapsedChange,
  prepCollapseLabel,
  prep,
  contentMode,
  onContentModeChange,
  layoutView,
  onLayoutViewChange,
  device,
  onDeviceChange,
  themeKey,
  onThemeKeyChange,
  phoneSize,
  stageView,
  editLocked,
  onStageViewChange,
  generating,
  isRewriteMode,
  rewriteSettings,
  rewriteProgress,
  stageLabel,
  rewriteSession,
  selectedTitleIndex,
  onSelectTitleIndex,
  onApplyRewrite,
  onRegenerate,
  onDismissRewrite,
  title,
  onTitleChange,
  content,
  onContentChange,
  effectiveImageUrls,
  onPickImages,
  onRemoveImageAt,
  onReorderImages,
  onPhoneSizeChange,
  weixinPublishMode,
}: WechatArticleInspirationStudioPanelProps) {
  const { t } = useTranslation('socialPublish')

  return (
    <SocialStudioShell
      prepCollapsed={prepCollapsed}
      onPrepCollapsedChange={onPrepCollapsedChange}
      prepCollapseLabel={prepCollapseLabel}
      stageHead={
        <>
          <SocialStudioModeSwitch platform="wechat" value={contentMode} onChange={onContentModeChange} />
          {contentMode === 'article' ? (
            <SocialStudioPreviewMenu
              platform="wechat"
              contentMode={contentMode}
              layoutView={layoutView}
              onLayoutViewChange={onLayoutViewChange}
              device={device}
              onDeviceChange={onDeviceChange}
              themeKey={themeKey}
              onThemeKeyChange={onThemeKeyChange}
              phoneSize={phoneSize}
            />
          ) : null}
          <span className="social-studio__rail-head-spacer" aria-hidden />
          <SocialStudioStageViewSwitch
            value={stageView}
            editDisabled={editLocked}
            onChange={onStageViewChange}
          />
        </>
      }
      stage={
        <SocialStudioStageFrame generating={generating}>
          {generating && isRewriteMode ? (
            <RewriteGenerationOverlay
              platform="wechat"
              settings={rewriteSettings}
              progress={rewriteProgress}
              stageLabel={stageLabel}
            />
          ) : null}
          {!generating && rewriteSession?.pass1Body ? (
            <RewriteResultDualPane
              session={rewriteSession}
              selectedTitleIndex={selectedTitleIndex}
              onSelectTitle={onSelectTitleIndex}
              onApply={onApplyRewrite}
              onRegenerate={onRegenerate}
              onDismiss={onDismissRewrite}
            />
          ) : null}
          <SocialStudioStageBody
            stageView={stageView}
            platform="wechat"
            contentMode={contentMode}
            title={title}
            onTitleChange={onTitleChange}
            content={content}
            onContentChange={onContentChange}
            imageUrls={effectiveImageUrls}
            onPickImages={onPickImages}
            onRemoveImageAt={onRemoveImageAt}
            onReorderImages={onReorderImages}
            layoutView={layoutView}
            device={device}
            themeKey={themeKey}
            phoneSize={phoneSize}
            onPhoneSizeChange={onPhoneSizeChange}
            weixinPublishMode={weixinPublishMode}
          />
        </SocialStudioStageFrame>
      }
      prepHead={<span className="text-sm font-semibold">{t('prepPanelTitle')}</span>}
      prep={prep}
    />
  )
}
