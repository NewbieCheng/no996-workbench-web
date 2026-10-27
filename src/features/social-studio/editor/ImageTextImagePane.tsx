import { PreviewableImage } from '@no996/ui/image-preview'
import { ImagePlus, Trash2Icon } from 'lucide-react'
import type { PreviewImageItem } from './editor-utils'
import i18n from '@/i18n'

type ImageTextImagePaneProps = {
  imagesDisabled: boolean
  dragActive: boolean
  dragImageIndex: number | null
  previewImageItems: PreviewImageItem[]
  selectedImageIndex: number
  setDragActive: (value: boolean) => void
  setDragImageIndex: (value: number | null) => void
  setSelectedImageIndex: (value: number) => void
  onDropImages: (files: FileList | null) => Promise<void>
  onDeleteSelectedImage: () => void
  onOpenImageUpload: () => void
}

export function ImageTextImagePane({
  imagesDisabled,
  dragActive,
  dragImageIndex,
  previewImageItems,
  selectedImageIndex,
  setDragActive,
  setDragImageIndex: _setDragImageIndex,
  setSelectedImageIndex,
  onDropImages,
  onDeleteSelectedImage,
  onOpenImageUpload,
}: ImageTextImagePaneProps) {
  const goPrev = () => {
    setSelectedImageIndex((selectedImageIndex - 1 + previewImageItems.length) % previewImageItems.length)
  }
  const goNext = () => {
    setSelectedImageIndex((selectedImageIndex + 1) % previewImageItems.length)
  }

  return (
    <div
      className="editor-image-preview-left"
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (dragImageIndex === null) setDragActive(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragActive(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setDragActive(false)
        if (dragImageIndex === null && event.dataTransfer.files.length > 0) {
          void onDropImages(event.dataTransfer.files)
        }
      }}
    >
      {dragActive && dragImageIndex === null ? (
        <div className="editor-drag-mask">{i18n.t("uiCopy:拖拽图片到此处即可插入", { keySeparator: false })}</div>
      ) : null}
      {previewImageItems[selectedImageIndex] ? (
        <div className="editor-image-viewport">
          <PreviewableImage
            src={previewImageItems[selectedImageIndex].src}
            alt={`图片 ${selectedImageIndex + 1}`}
            title={`图片 ${selectedImageIndex + 1}`}
            typeLabel={`${selectedImageIndex + 1} / ${previewImageItems.length}`}
            className="editor-image-preview-target-fill"
            imageClassName="editor-image-preview-target-fill__img"
          />
          {previewImageItems.length > 1 ? (
            <>
              <button
                type="button"
                className="editor-image-nav editor-image-hover-ui prev"
                onClick={goPrev}
                aria-label={i18n.t("uiCopy:上一张", { keySeparator: false })}
              >
                ‹
              </button>
              <button
                type="button"
                className="editor-image-nav editor-image-hover-ui next"
                onClick={goNext}
                aria-label={i18n.t("uiCopy:下一张", { keySeparator: false })}
              >
                ›
              </button>
            </>
          ) : null}
          <div className="editor-image-counter editor-image-hover-ui" aria-live="polite">
            {selectedImageIndex + 1}/{previewImageItems.length}
          </div>
          <div className="editor-image-bottom-bar editor-image-hover-ui">
            <div className="editor-image-dots" role="tablist" aria-label={i18n.t("uiCopy:图片分页", { keySeparator: false })}>
              {previewImageItems.map((item, index) => (
                <button
                  key={`${item.src}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={selectedImageIndex === index}
                  aria-label={`第 ${index + 1} 张`}
                  className={`editor-image-dot ${selectedImageIndex === index ? 'is-active' : ''}`}
                  onClick={() => setSelectedImageIndex(index)}
                />
              ))}
            </div>
            <button
              type="button"
              className="editor-image-delete"
              onClick={onDeleteSelectedImage}
              disabled={imagesDisabled}
              aria-label={i18n.t("uiCopy:删除当前图片", { keySeparator: false })}
            >
              <Trash2Icon className="editor-image-delete-icon" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <div className="editor-image-empty">
          <button
            type="button"
            className="editor-image-upload-cta"
            onClick={onOpenImageUpload}
            disabled={imagesDisabled}
          >
            <ImagePlus className="editor-image-upload-cta__icon" strokeWidth={2} aria-hidden />
            <span>{i18n.t("uiCopy:上传图片", { keySeparator: false })}</span>
          </button>
          <p className="editor-image-empty-hint">{i18n.t('支持 JPG、PNG、WebP，可一次选择多张', { ns: 'uiCopy', keySeparator: false })}</p>
        </div>
      )}
    </div>
  )
}
