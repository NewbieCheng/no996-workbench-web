import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MusicIcon } from 'lucide-react';
import { ActionDialog, ActionDialogFooter } from './action-dialog';
import { Button } from './button';
import { ImagePreviewDialog } from './image-preview';
import {
  TEXT_PREVIEW_EXTS,
  extColor,
  getFileExt,
  itemKind,
  itemPreviewUrl,
  type AttachmentUploaderItem,
} from './attachment-uploader-utils';

export function AttachmentPreviewDialog({
  item,
  open,
  onOpenChange,
}: {
  item: AttachmentUploaderItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [textContent, setTextContent] = React.useState<string | null>(null);
  const [textLoading, setTextLoading] = React.useState(false);
  const [textError, setTextError] = React.useState(false);
  const [fallbackPreviewUrl, setFallbackPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !item?.file) {
      setTextContent(null);
      setTextLoading(false);
      setTextError(false);
      return;
    }
    const ext = getFileExt(item.name);
    if (!TEXT_PREVIEW_EXTS.includes(ext)) return;

    setTextLoading(true);
    setTextError(false);
    void item.file.text()
      .then((text) => {
        setTextContent(text.slice(0, 20000));
        setTextLoading(false);
      })
      .catch(() => {
        setTextError(true);
        setTextLoading(false);
      });
  }, [open, item]);

  React.useEffect(() => {
    if (!open) return;
    return () => {
      const media = document.querySelectorAll('.au-preview-dialog audio, .au-preview-dialog video');
      media.forEach((node) => {
        if (node instanceof HTMLMediaElement) node.pause();
      });
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !item) {
      setFallbackPreviewUrl(null);
      return;
    }
    if (itemPreviewUrl(item)) {
      setFallbackPreviewUrl(null);
      return;
    }
    const kind = itemKind(item);
    if ((kind === 'video' || kind === 'audio') && item.file && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(item.file);
      setFallbackPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setFallbackPreviewUrl(null);
  }, [open, item]);

  if (!item) return null;

  const kind = itemKind(item);
  const previewUrl = itemPreviewUrl(item) ?? fallbackPreviewUrl;
  const ext = getFileExt(item.name);

  if (kind === 'image' && previewUrl) {
    return (
      <ImagePreviewDialog
        open={open}
        onOpenChange={onOpenChange}
        src={previewUrl}
        alt={item.name}
        title={item.name}
        typeLabel={item.name}
      />
    );
  }

  const { t } = useTranslation('common');

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item.name}
      widthClass="max-w-2xl"
      contentClassName="au-preview-dialog"
      bodyClassName="max-h-[70vh] py-0"
      footer={
        <ActionDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('confirm')}
          </Button>
        </ActionDialogFooter>
      }
    >
        <div className="max-h-[70vh] overflow-auto">
          {kind === 'image' && !previewUrl ? (
            <p className="py-8 text-center text-sm text-muted-foreground">无法预览该图片</p>
          ) : null}
          {kind === 'video' && previewUrl ? (
            <video src={previewUrl} controls autoPlay playsInline className="w-full rounded-lg bg-black" />
          ) : null}
          {kind === 'video' && !previewUrl ? (
            <p className="py-8 text-center text-sm text-muted-foreground">无法预览该视频</p>
          ) : null}
          {kind === 'audio' && previewUrl ? (
            <div className="flex flex-col items-center gap-4 py-5 text-primary">
              <MusicIcon className="size-11" aria-hidden />
              <audio src={previewUrl} controls autoPlay className="w-full" />
            </div>
          ) : null}
          {kind === 'doc' && item.file && TEXT_PREVIEW_EXTS.includes(ext) ? (
            textLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
            ) : textError ? (
              <p className="py-8 text-center text-sm text-muted-foreground">读取失败</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed text-foreground">
                {textContent}
              </pre>
            )
          ) : null}
          {kind === 'doc' && (!item.file || !TEXT_PREVIEW_EXTS.includes(ext)) ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
              <span
                className="inline-flex size-14 items-center justify-center rounded-lg text-xs font-bold uppercase text-white"
                style={{ backgroundColor: extColor(ext) }}
              >
                {(ext || 'FILE').slice(0, 4)}
              </span>
              <span>该格式暂不支持在线预览</span>
            </div>
          ) : null}
        </div>
    </ActionDialog>
  );
}
