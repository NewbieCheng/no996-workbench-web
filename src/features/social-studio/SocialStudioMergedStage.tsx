import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { applyWechatInlineStyles } from '../../services/social-publish/layout/wechat-markdown-preview'
import type { WechatThemeKey } from '../../services/social-publish/layout/wechat-markdown-preview'
import { ArticlePreviewPanel } from './editor/ArticlePreviewPanel'
import { htmlToMarkdownSmart, markdownToHtmlSmart } from './editor/conversion-service'
import { ImageTextPreviewPanel } from './editor/ImageTextPreviewPanel'
import type { PreviewImageItem } from './editor/editor-utils'
import type { PreviewDevice, SocialContentMode, WechatLayoutView } from './studio-types'

export type SocialStudioMergedStageProps = {
  platform: 'wechat' | 'xhs'
  title: string
  onTitleChange: (value: string) => void
  content: string
  onContentChange: (value: string) => void
  contentMode: SocialContentMode
  imageUrls: string[]
  onPickImages: (files: FileList | null) => void
  onRemoveImageAt: (index: number) => void
  onReorderImages: (from: number, to: number) => void
  layoutView?: WechatLayoutView
  device?: PreviewDevice
  themeKey?: WechatThemeKey
  summary?: string
  onSummaryChange?: (value: string) => void
  readOnly?: boolean
}

function useBodyHtmlBridge(content: string, onContentChange: (md: string) => void) {
  const html = useMemo(() => markdownToHtmlSmart(content), [content])
  const onHtmlChange = useCallback(
    (nextHtml: string) => {
      const nextMd = htmlToMarkdownSmart(nextHtml)
      if (nextMd === content) return
      onContentChange(nextMd)
    },
    [onContentChange, content],
  )
  return { html, onHtmlChange }
}

function ArticleTitleField({
  title,
  onTitleChange,
  readOnly,
  placeholder,
}: {
  title: string
  onTitleChange: (value: string) => void
  readOnly: boolean
  placeholder: string
}) {
  return (
    <input
      type="text"
      className="editor-title"
      placeholder={placeholder}
      value={title}
      maxLength={200}
      readOnly={readOnly}
      onChange={(e) => onTitleChange(e.target.value)}
    />
  )
}

export function SocialStudioMergedStage({
  platform,
  title,
  onTitleChange,
  content,
  onContentChange,
  contentMode,
  imageUrls,
  onPickImages,
  onRemoveImageAt,
  onReorderImages: _onReorderImages,
  layoutView = 'wechat',
  device = 'mobile',
  themeKey = 'green',
  readOnly = false,
}: SocialStudioMergedStageProps) {
  const { t } = useTranslation('socialPublish')
  const { html: bodyHtml, onHtmlChange } = useBodyHtmlBridge(content, onContentChange)
  const themeRootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [dragImageIndex, setDragImageIndex] = useState<number | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const previewImageItems: PreviewImageItem[] = useMemo(
    () => imageUrls.map((src) => ({ src })),
    [imageUrls],
  )

  useEffect(() => {
    if (selectedImageIndex >= previewImageItems.length) {
      setSelectedImageIndex(Math.max(0, previewImageItems.length - 1))
    }
  }, [previewImageItems.length, selectedImageIndex])

  useEffect(() => {
    const root = themeRootRef.current
    if (!root || platform !== 'wechat' || contentMode !== 'article' || layoutView !== 'wechat') return
    // 正文/标题变化时重刷主题即可；勿用 MutationObserver 监听子树——
    // applyWechatInlineStyles 会改 style，与 TipTap 增量更新叠加时可能长时间占满主线程。
    applyWechatInlineStyles(root, themeKey)
  }, [platform, contentMode, layoutView, themeKey, bodyHtml, title])

  const wrapClass =
    contentMode === 'image_text'
      ? 'editor-preview-wrap editor-preview-wrap-fixed editor-preview-wrap-image-text'
      : 'editor-preview-wrap editor-preview-wrap-fixed'

  const articlePanelProps = {
    html: bodyHtml,
    writeHtmlDraft: onHtmlChange,
    editable: !readOnly,
  }

  const titlePlaceholder = t('wechatFieldTitle')

  const articleWrap = (body: ReactNode) => <div className={wrapClass}>{body}</div>

  if (contentMode === 'image_text') {
    return (
      <div className={wrapClass}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            onPickImages(e.target.files)
            e.target.value = ''
          }}
        />
        <ImageTextPreviewPanel
          title={title}
          imagesDisabled={readOnly}
          previewImageItems={previewImageItems}
          selectedImageIndex={selectedImageIndex}
          dragActive={dragActive}
          dragImageIndex={dragImageIndex}
          inputRef={fileInputRef}
          setDragActive={setDragActive}
          setDragImageIndex={setDragImageIndex}
          setSelectedImageIndex={setSelectedImageIndex}
          onDropImages={async (files) => onPickImages(files)}
          onDeleteSelectedImage={() => {
            if (previewImageItems.length === 0) return
            onRemoveImageAt(selectedImageIndex)
          }}
          bodyHtml={bodyHtml}
          onBodyHtmlChange={onHtmlChange}
          onTitleChange={onTitleChange}
          readOnly={readOnly}
        />
      </div>
    )
  }

  if ((platform === 'wechat' && layoutView === 'web') || platform === 'xhs') {
    return articleWrap(
      <div className="social-studio-layout-preview">
        <div ref={themeRootRef} className="social-studio-layout-preview__web social-studio-wechat-editable">
          <ArticleTitleField
            title={title}
            onTitleChange={onTitleChange}
            readOnly={readOnly}
            placeholder={titlePlaceholder}
          />
          <ArticlePreviewPanel {...articlePanelProps} />
        </div>
      </div>,
    )
  }

  if (platform === 'wechat') {
    const scrollClass =
      device === 'mobile' ? 'social-studio-wechat-mobile__scroll' : 'social-studio-wechat-pc__scroll'
    return articleWrap(
      <div className="social-studio-layout-preview">
        {device === 'mobile' ? (
          <div className="social-studio-wechat-mobile">
            <div className="social-studio-wechat-mobile__screen">
              <div className="social-studio-wechat-mobile__bar">{t('phoneWechat')}</div>
              <div ref={themeRootRef} className={`${scrollClass} social-studio-wechat-editable`}>
                <ArticleTitleField
                  title={title}
                  onTitleChange={onTitleChange}
                  readOnly={readOnly}
                  placeholder={titlePlaceholder}
                />
                <ArticlePreviewPanel {...articlePanelProps} />
              </div>
            </div>
          </div>
        ) : (
          <div className="social-studio-wechat-pc social-studio-wechat-pc--embedded">
            <div ref={themeRootRef} className={`${scrollClass} social-studio-wechat-editable`}>
              <ArticleTitleField
                title={title}
                onTitleChange={onTitleChange}
                readOnly={readOnly}
                placeholder={titlePlaceholder}
              />
              <ArticlePreviewPanel {...articlePanelProps} />
            </div>
          </div>
        )}
      </div>,
    )
  }

  return null
}
