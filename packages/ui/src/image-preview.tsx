import './image-preview.css';
import * as React from 'react';
import { ChevronDown, Download, Minus, Plus, X, ZoomIn } from 'lucide-react';
import { cn } from './utils';
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from './dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';

export type ImagePreviewTarget = {
  src: string;
  alt: string;
  title?: string;
  description?: string;
};

const ZOOM_STEPS = [50, 75, 100, 125, 150] as const;

function sanitizeDownloadName(name: string): string {
  const trimmed = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  if (!trimmed) return 'image.png';
  return /\.[a-z0-9]{2,5}$/i.test(trimmed) ? trimmed : `${trimmed}.png`;
}

function downloadImageSrc(src: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = src;
  anchor.download = sanitizeDownloadName(filename);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function ImmersiveImagePreviewDialog({
  open,
  onOpenChange,
  src,
  alt,
  title,
  typeLabel,
  downloadLabel = '下载',
  closeLabel = '关闭',
}: ImagePreviewTarget & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeLabel?: string;
  downloadLabel?: string;
  closeLabel?: string;
}) {
  const [zoomIndex, setZoomIndex] = React.useState(0);
  const zoom = ZOOM_STEPS[zoomIndex] ?? 100;
  const heading = title ?? alt;
  const toolbarLabel = typeLabel ?? heading;

  React.useEffect(() => {
    if (open) setZoomIndex(0);
  }, [open, src]);

  if (!src) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="image-preview-immersive__backdrop" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className="image-preview-immersive"
          aria-labelledby="image-preview-immersive-title"
        >
          <header className="image-preview-immersive__toolbar">
            <div className="image-preview-immersive__type">
              <span className="image-preview-immersive__type-icon" aria-hidden>
                <ZoomIn className="size-4" />
              </span>
              <DialogTitle id="image-preview-immersive-title" className="image-preview-immersive__type-label">
                {toolbarLabel}
              </DialogTitle>
              <ChevronDown className="image-preview-immersive__type-chevron" aria-hidden />
            </div>
            <div className="image-preview-immersive__actions">
              <div className="image-preview-immersive__zoom" role="group" aria-label={`${zoom}%`}>
                <button
                  type="button"
                  className="image-preview-immersive__icon-btn"
                  aria-label="缩小"
                  disabled={zoomIndex <= 0}
                  onClick={() => setZoomIndex((value) => Math.max(0, value - 1))}
                >
                  <Minus className="size-4" />
                </button>
                <span className="image-preview-immersive__zoom-value">{zoom}%</span>
                <button
                  type="button"
                  className="image-preview-immersive__icon-btn"
                  aria-label="放大"
                  disabled={zoomIndex >= ZOOM_STEPS.length - 1}
                  onClick={() => setZoomIndex((value) => Math.min(ZOOM_STEPS.length - 1, value + 1))}
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <button
                type="button"
                className="image-preview-immersive__icon-btn"
                aria-label={downloadLabel}
                onClick={() => downloadImageSrc(src, heading)}
              >
                <Download className="size-4" />
              </button>
              <DialogClose
                render={
                  <button type="button" className="image-preview-immersive__icon-btn" aria-label={closeLabel}>
                    <X className="size-4" />
                  </button>
                }
              />
            </div>
          </header>
          <div className="image-preview-immersive__stage">
            <div
              className="image-preview-immersive__frame"
              style={{ '--image-preview-zoom': String(zoom / 100) } as React.CSSProperties}
            >
              <img
                src={src}
                alt={alt}
                className="image-preview-immersive__img"
                draggable={false}
              />
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  src,
  alt,
  title,
  typeLabel,
  downloadLabel,
  closeLabel,
}: ImagePreviewTarget & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeLabel?: string;
  downloadLabel?: string;
  closeLabel?: string;
}) {
  if (!src) return null;

  return (
    <ImmersiveImagePreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      src={src}
      alt={alt}
      title={title}
      typeLabel={typeLabel}
      downloadLabel={downloadLabel}
      closeLabel={closeLabel}
    />
  );
}

export function PreviewableImage({
  src,
  alt,
  title,
  description,
  className,
  imageClassName,
  disabled,
  typeLabel,
  downloadLabel,
  closeLabel,
  children,
}: ImagePreviewTarget & {
  className?: string;
  imageClassName?: string;
  disabled?: boolean;
  typeLabel?: string;
  downloadLabel?: string;
  closeLabel?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const canPreview = Boolean(src) && !disabled;
  const previewLabel = title ?? alt;

  return (
    <>
      <button
        type="button"
        className={cn(
          'image-preview-target',
          canPreview && 'image-preview-target--interactive',
          className,
        )}
        onClick={() => {
          if (canPreview) setOpen(true);
        }}
        disabled={!canPreview}
        aria-label={previewLabel ? `查看大图：${previewLabel}` : '查看大图'}
      >
        <span className="image-preview-target__surface">
          {children ?? (
            <img
              src={src}
              alt={alt}
              className={cn('image-preview-target__img', imageClassName)}
              draggable={false}
            />
          )}
          {canPreview ? (
            <span className="image-preview-target__overlay" aria-hidden>
              <ZoomIn className="size-[1.125rem] stroke-[1.75]" />
            </span>
          ) : null}
        </span>
      </button>
      {canPreview ? (
        <ImagePreviewDialog
          open={open}
          onOpenChange={setOpen}
          src={src}
          alt={alt}
          title={title ?? alt}
          description={description}
          typeLabel={typeLabel}
          downloadLabel={downloadLabel}
          closeLabel={closeLabel}
        />
      ) : null}
    </>
  );
}

/** 资产库 / 设置面板通用缩略图 */
export function ImagePreviewThumb({
  src,
  alt,
  title,
  label,
  variant = 'photo',
  className,
}: ImagePreviewTarget & {
  label?: string;
  variant?: 'photo' | 'icon';
  className?: string;
}) {
  const displayLabel = label ?? title ?? alt;

  return (
    <div
      className={cn(
        'image-preview-thumb',
        variant === 'icon' && 'image-preview-thumb--icon',
        className,
      )}
    >
      <PreviewableImage
        src={src}
        alt={alt}
        title={title ?? alt}
        className="image-preview-thumb__target"
        imageClassName="image-preview-thumb__img"
      />
      {displayLabel ? <span className="image-preview-thumb__label">{displayLabel}</span> : null}
    </div>
  );
}

/** 受控大图预览：适合列表页集中管理弹窗状态。 */
export function useImagePreview() {
  const [target, setTarget] = React.useState<ImagePreviewTarget | null>(null);

  return {
    target,
    isOpen: target !== null,
    openPreview: setTarget,
    closePreview: () => setTarget(null),
  };
}
