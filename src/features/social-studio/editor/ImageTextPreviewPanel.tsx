import { useCallback, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ArticlePreviewPanel, type ArticleEditorHandle } from './ArticlePreviewPanel'
import type { PreviewImageItem } from './editor-utils'
import { ImageTextImagePane } from './ImageTextImagePane'
import { ImageTextSplitDivider } from './ImageTextSplitDivider'

const SPLIT_DIVIDER_PX = 6
const SPLIT_MIN_LEFT = 180
const SPLIT_MIN_RIGHT = 200

type ImageTextPreviewPanelProps = {
  title: string
  imagesDisabled: boolean
  previewImageItems: PreviewImageItem[]
  selectedImageIndex: number
  dragActive: boolean
  dragImageIndex: number | null
  inputRef: RefObject<HTMLInputElement | null>
  setDragActive: (value: boolean) => void
  setDragImageIndex: (value: number | null) => void
  setSelectedImageIndex: (value: number) => void
  onDropImages: (files: FileList | null) => Promise<void>
  onDeleteSelectedImage: () => void
  bodyHtml: string
  onBodyHtmlChange: (value: string) => void
  onTitleChange: (value: string) => void
  readOnly?: boolean
}

export function ImageTextPreviewPanel({
  title,
  imagesDisabled,
  previewImageItems,
  selectedImageIndex,
  dragActive,
  dragImageIndex,
  inputRef,
  setDragActive,
  setDragImageIndex,
  setSelectedImageIndex,
  onDropImages,
  onDeleteSelectedImage,
  bodyHtml,
  onBodyHtmlChange,
  onTitleChange,
  readOnly = false,
}: ImageTextPreviewPanelProps) {
  const { t } = useTranslation('socialPublish')
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const [leftPaneWidth, setLeftPaneWidth] = useState<number | null>(null)
  const bodyEditorRef = useRef<ArticleEditorHandle | null>(null)
  const onBodyEditorReady = useCallback((handle: ArticleEditorHandle | null) => {
    bodyEditorRef.current = handle
  }, [])

  const onTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    bodyEditorRef.current?.focus()
  }

  const onSplitResize = (delta: number) => {
    const container = splitContainerRef.current
    if (!container) return
    const total = container.getBoundingClientRect().width
    const maxLeft = total - SPLIT_DIVIDER_PX - SPLIT_MIN_RIGHT
    setLeftPaneWidth((prev) => {
      const base = prev ?? (total - SPLIT_DIVIDER_PX) / 2
      return Math.min(maxLeft, Math.max(SPLIT_MIN_LEFT, base + delta))
    })
  }

  const splitSized = leftPaneWidth !== null

  return (
    <div
      ref={splitContainerRef}
      className={`editor-image-preview-content editor-image-preview-content--flat editor-image-preview-content--split${splitSized ? ' is-sized' : ''}`}
      style={
        splitSized
          ? { ['--editor-image-split-left' as string]: `${leftPaneWidth}px` }
          : undefined
      }
    >
      <ImageTextImagePane
        imagesDisabled={imagesDisabled}
        dragActive={dragActive}
        dragImageIndex={dragImageIndex}
        previewImageItems={previewImageItems}
        selectedImageIndex={selectedImageIndex}
        setDragActive={setDragActive}
        setDragImageIndex={setDragImageIndex}
        setSelectedImageIndex={setSelectedImageIndex}
        onDropImages={onDropImages}
        onDeleteSelectedImage={onDeleteSelectedImage}
        onOpenImageUpload={() => inputRef.current?.click()}
      />
      <ImageTextSplitDivider onResize={onSplitResize} />
      <div className="editor-image-preview-right">
        <input
          type="text"
          className="editor-image-copy-title"
          placeholder={t('studioTitlePlaceholder')}
          value={title}
          maxLength={200}
          readOnly={readOnly}
          onChange={(event) => onTitleChange(event.target.value)}
          onKeyDown={onTitleKeyDown}
        />
        <ArticlePreviewPanel
          html={bodyHtml}
          writeHtmlDraft={onBodyHtmlChange}
          onReady={onBodyEditorReady}
          placeholder={t('studioImageTextBodyPlaceholder')}
          className="editor-image-copy-prosemirror"
          editable={!readOnly}
        />
      </div>
    </div>
  )
}
