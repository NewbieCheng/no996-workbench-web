import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cropper, type ReactCropperElement } from 'react-cropper'
import 'cropperjs/dist/cropper.css'
import type { CropAreaPixels, CropRatioMode } from './editor-image-utils'

type ImageCropModalProps = {
  isOpen: boolean
  imageSrc: string
  imageAlt: string
  imageZoom: number
  cropMode: CropRatioMode
  cropAreaPixels: CropAreaPixels
  onClose: () => void
  onCropAreaChange: (next: CropAreaPixels) => void
  onApplyCropMode: (mode: CropRatioMode) => void
  onZoomChange: (value: number) => void
  onApplyCrop: () => void | Promise<void>
}

export function ImageCropModal({
  isOpen,
  imageSrc,
  imageAlt,
  imageZoom,
  cropMode,
  cropAreaPixels,
  onClose,
  onCropAreaChange,
  onApplyCropMode,
  onZoomChange,
  onApplyCrop,
}: ImageCropModalProps) {
  const { t } = useTranslation('socialPublish')
  const cropperRef = useRef<ReactCropperElement>(null)
  const [minZoom, setMinZoom] = useState(0.1)
  const maxZoom = Math.max(minZoom + 0.1, minZoom * 4)
  const aspectRatio = useMemo(() => {
    if (cropMode === 'ratio_3_4') return 3 / 4
    if (cropMode === 'ratio_1_1') return 1
    if (cropMode === 'ratio_4_3') return 4 / 3
    if (cropMode === 'ratio_16_9') return 16 / 9
    if (cropMode === 'ratio_9_16') return 9 / 16
    return NaN
  }, [cropMode])

  useEffect(() => {
    const cropper = cropperRef.current?.cropper
    if (!cropper) return
    cropper.setAspectRatio(aspectRatio)
    cropper.crop()
  }, [aspectRatio])

  useEffect(() => {
    const cropper = cropperRef.current?.cropper
    if (!cropper) return
    cropper.zoomTo(imageZoom)
  }, [imageZoom])

  const syncCropArea = () => {
    const cropper = cropperRef.current?.cropper
    if (!cropper) return
    const data = cropper.getData(true)
    onCropAreaChange({
      x: Math.max(0, data.x),
      y: Math.max(0, data.y),
      width: Math.max(1, data.width),
      height: Math.max(1, data.height),
    })
  }

  if (!isOpen || !imageSrc) return null

  const ratioButtons: { mode: CropRatioMode; label: string }[] = [
    { mode: 'ratio_3_4', label: t('editorCropRatio34') },
    { mode: 'ratio_1_1', label: t('editorCropRatio11') },
    { mode: 'ratio_4_3', label: t('editorCropRatio43') },
    { mode: 'ratio_16_9', label: t('editorCropRatio169') },
    { mode: 'ratio_9_16', label: t('editorCropRatio916') },
    { mode: 'free', label: t('editorCropRatioFree') },
  ]

  return (
    <div className="editor-image-modal" onClick={onClose}>
      <div className="editor-image-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="editor-image-modal-title">{t('editorCropModalTitle')}</div>
        <div className="editor-image-modal-layout">
          <div className="editor-image-modal-preview editor-crop-stage">
            <Cropper
              ref={cropperRef}
              src={imageSrc}
              alt={imageAlt}
              style={{ width: '100%', height: '100%' }}
              guides
              viewMode={1}
              dragMode="move"
              autoCropArea={1}
              background={false}
              responsive
              checkOrientation={false}
              crop={syncCropArea}
              ready={() => {
                const cropper = cropperRef.current?.cropper
                if (!cropper) return
                cropper.setAspectRatio(aspectRatio)
                const imageData = cropper.getImageData()
                const fitZoom = imageData.naturalWidth > 0 ? imageData.width / imageData.naturalWidth : 1
                const nextMinZoom = Number.isFinite(fitZoom) && fitZoom > 0 ? fitZoom : 1
                setMinZoom(nextMinZoom)
                cropper.zoomTo(nextMinZoom)
                onZoomChange(nextMinZoom)
                syncCropArea()
              }}
            />
          </div>
          <div className="editor-crop-side">
            <div className="editor-crop-side-title">{t('editorCropSideTitle')}</div>
            {ratioButtons.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                className={cropMode === mode ? 'active' : ''}
                onClick={() => onApplyCropMode(mode)}
              >
                {label}
              </button>
            ))}
            <label>
              {t('editorCropZoom')}
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step={0.01}
                value={Math.min(Math.max(imageZoom, minZoom), maxZoom)}
                onChange={(event) => onZoomChange(Number(event.target.value))}
              />
            </label>
            <div className="editor-crop-info">
              {cropAreaPixels
                ? t('editorCropAreaInfo', {
                    width: Math.round(cropAreaPixels.width),
                    height: Math.round(cropAreaPixels.height),
                  })
                : t('editorCropAreaWaiting')}
            </div>
          </div>
        </div>
        <div className="editor-image-modal-actions">
          <button type="button" onClick={() => void onApplyCrop()}>{t('editorCropApply')}</button>
          <button type="button" className="ghost" onClick={onClose}>{t('editorCropClose')}</button>
        </div>
      </div>
    </div>
  )
}
