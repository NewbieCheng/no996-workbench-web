import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { XhsPublishMode } from '../../services/social-publish/types'
import { SocialStudioShell } from '../social-studio/SocialStudioShell'
import { SocialStudioModeSwitch } from '../social-studio/SocialStudioModeSwitch'
import { SocialStudioStageBody } from '../social-studio/preview/SocialStudioStageBody'
import type { useSocialStudioPreviewPrefs } from '../social-studio/preview/useSocialStudioPreviewPrefs'
import { SocialStudioStageFrame } from '../social-studio/SocialStudioStageFrame'
import { SocialStudioStageViewSwitch } from '../social-studio/SocialStudioStageViewSwitch'
import type { SocialContentMode } from '../social-studio/studio-types'
import { RewriteGenerationOverlay } from '../social-studio/rewrite/RewriteGenerationOverlay'
import { RewriteResultDualPane } from '../social-studio/rewrite/RewriteResultDualPane'
import type { SocialStudioRewriteSettings, SocialStudioRewriteSession } from '../social-studio/rewrite/social-studio-rewrite-types'
import type { StudioStageView } from '../social-studio/studio-types'

export type XiaohongshuInspirationStudioPanelProps = {
  prepCollapsed: boolean
  onPrepCollapsedChange: (collapsed: boolean) => void
  prepCollapseLabel: string
  prep: ReactNode
  contentMode: SocialContentMode
  onContentModeChange: (mode: SocialContentMode) => void
  hasDraft: boolean
  effectiveXhsMode: XhsPublishMode
  onXhsPublishModeChange: (mode: XhsPublishMode) => void
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
  previewPrefs: ReturnType<typeof useSocialStudioPreviewPrefs>
}

/** 小红书 · 灵感创作双栏工作台（独立板块） */
export function XiaohongshuInspirationStudioPanel({
  prepCollapsed,
  onPrepCollapsedChange,
  prepCollapseLabel,
  prep,
  contentMode,
  onContentModeChange,
  hasDraft,
  effectiveXhsMode,
  onXhsPublishModeChange,
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
  previewPrefs,
}: XiaohongshuInspirationStudioPanelProps) {
  const { t } = useTranslation('socialPublish')

  return (
    <SocialStudioShell
      prepCollapsed={prepCollapsed}
      onPrepCollapsedChange={onPrepCollapsedChange}
      prepCollapseLabel={prepCollapseLabel}
      stageHead={
        <>
          <SocialStudioModeSwitch platform="xhs" value={contentMode} onChange={onContentModeChange} />
          {hasDraft ? (
            <select
              className="social-studio-theme-select"
              value={effectiveXhsMode}
              onChange={(e) => onXhsPublishModeChange(e.target.value as XhsPublishMode)}
            >
              <option value="auto">{t('publishTypeAuto')}</option>
              <option value="image_text">{t('publishTypeNote')}</option>
              <option value="article">{t('publishTypeArticle')}</option>
            </select>
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
              platform="xhs"
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
            platform="xhs"
            contentMode={contentMode}
            title={title}
            onTitleChange={onTitleChange}
            content={content}
            onContentChange={onContentChange}
            imageUrls={effectiveImageUrls}
            onPickImages={onPickImages}
            onRemoveImageAt={onRemoveImageAt}
            onReorderImages={onReorderImages}
            layoutView="wechat"
            device={previewPrefs.device}
            themeKey="green"
            phoneSize={previewPrefs.phoneSize}
            onPhoneSizeChange={previewPrefs.setPhoneSize}
            xhsPublishMode={effectiveXhsMode}
          />
        </SocialStudioStageFrame>
      }
      prepHead={<span className="text-sm font-semibold">{t('prepPanelTitle')}</span>}
      prep={prep}
    />
  )
}
