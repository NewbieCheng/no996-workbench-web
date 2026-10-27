import './attachment-uploader.css';
import * as React from 'react';
import {
  AlertTriangleIcon,
  EyeIcon,
  FileIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { cn } from './utils';
import {
  ComposerContextStripChip,
  ComposerContextStripImage,
  ComposerContextStripScroll,
} from './composer-context-strip';
import { AttachmentPreviewDialog } from './attachment-uploader-preview';
import {
  extColor,
  formatAttachmentSize,
  getFileExt,
  grabVideoFrame,
  itemKind,
  itemPreviewUrl,
  itemThumb,
  resolveAccept,
  resolveKindLabel,
  resolveLayout,
  splitAcceptedFiles,
  validateKind,
  type AttachmentKind,
  type AttachmentLayout,
  type AttachmentUploaderItem,
} from './attachment-uploader-utils';

export type {
  AttachmentDraft,
  AttachmentDisplayItem,
  AttachmentKind,
  AttachmentLayout,
  AttachmentUploaderItem,
} from './attachment-uploader-utils';

export {
  createAttachmentDrafts,
  encodeAttachmentDraft,
  detectKind,
  extColor,
  formatAttachmentSize,
  grabVideoFrame,
  releaseAttachmentDrafts,
  resolveAccept,
  resolveLayout,
  splitAcceptedFiles,
  validateKind,
} from './attachment-uploader-utils';

export { AttachmentPreviewDialog } from './attachment-uploader-preview';

export interface AttachmentUploaderProps {
  kind?: AttachmentKind;
  layout?: AttachmentLayout;
  accept?: string;
  multiple?: boolean;
  maxCount?: number;
  maxBytes?: number;
  maxTotalBytes?: number;
  items: AttachmentUploaderItem[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  onReject?: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  addLabel?: string;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  showAddTile?: boolean;
  removable?: boolean;
  uploadingLabel?: string;
  failedLabel?: string;
  inputLabel?: string;
  buttonLabel?: string;
}

function isBusy(status?: AttachmentUploaderItem['status']): boolean {
  return status === 'pending' || status === 'uploading';
}

export function AttachmentUploader({
  kind = 'all',
  layout = 'auto',
  accept,
  multiple = true,
  maxCount = 0,
  maxBytes,
  maxTotalBytes,
  items,
  onAdd,
  onRemove,
  onRetry,
  onReject,
  disabled = false,
  className,
  addLabel,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  showAddTile = true,
  removable = true,
  uploadingLabel = '上传中…',
  failedLabel = '上传失败',
  inputLabel,
  buttonLabel,
}: AttachmentUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragDepthRef = React.useRef(0);
  const [dragOver, setDragOver] = React.useState(false);
  const [previewItem, setPreviewItem] = React.useState<AttachmentUploaderItem | null>(null);
  const [removingIds, setRemovingIds] = React.useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [videoThumbs, setVideoThumbs] = React.useState<Record<string, string>>({});
  const videoThumbsRef = React.useRef(videoThumbs);
  videoThumbsRef.current = videoThumbs;
  const audioRefs = React.useRef(new Map<string, HTMLAudioElement>());

  const resolvedAccept = resolveAccept(kind, accept);
  const resolvedLayout = resolveLayout(kind, layout);
  const effectiveMax = maxCount > 0 ? maxCount : Number.POSITIVE_INFINITY;
  const remaining = Math.max(0, effectiveMax - items.length);
  const canAdd = remaining > 0 && showAddTile && !disabled;
  const selectedBytes = items.reduce((sum, item) => sum + item.size, 0);
  const addText = addLabel ?? resolveKindLabel(kind);

  const intake = React.useCallback((fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (!incoming.length || disabled) return;

    const accepted: File[] = [];
    const rejected: File[] = [];
    let total = selectedBytes;

    for (const file of incoming) {
      if (accepted.length >= remaining) {
        rejected.push(file);
        continue;
      }
      if (!validateKind(file, kind)) {
        rejected.push(file);
        continue;
      }
      const split = splitAcceptedFiles([file], resolvedAccept, 1);
      if (!split.valid.length) {
        rejected.push(file);
        continue;
      }
      if (maxBytes !== undefined && file.size > maxBytes) {
        rejected.push(file);
        continue;
      }
      if (maxTotalBytes !== undefined && total + file.size > maxTotalBytes) {
        rejected.push(file);
        continue;
      }
      accepted.push(file);
      total += file.size;
    }

    if (accepted.length) onAdd(accepted);
    if (rejected.length) onReject?.(rejected);
  }, [
    disabled,
    kind,
    maxBytes,
    maxTotalBytes,
    onAdd,
    onReject,
    remaining,
    resolvedAccept,
    selectedBytes,
  ]);

  const handleRemove = React.useCallback((id: string) => {
    if (playingId === id) {
      const audio = audioRefs.current.get(id);
      audio?.pause();
      setPlayingId(null);
    }
    setRemovingIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      onRemove(id);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 160);
  }, [onRemove, playingId]);

  const toggleAudio = React.useCallback((item: AttachmentUploaderItem) => {
    const url = itemPreviewUrl(item);
    if (!url) return;
    let audio = audioRefs.current.get(item.id);
    if (!audio) {
      audio = new Audio(url);
      audio.addEventListener('ended', () => setPlayingId(null));
      audioRefs.current.set(item.id, audio);
    }
    if (playingId && playingId !== item.id) {
      audioRefs.current.get(playingId)?.pause();
    }
    if (audio.paused) {
      void audio.play().catch(() => undefined);
      setPlayingId(item.id);
    } else {
      audio.pause();
      setPlayingId(null);
    }
  }, [playingId]);

  React.useEffect(() => () => {
    audioRefs.current.forEach((audio) => audio.pause());
    audioRefs.current.clear();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    for (const item of items) {
      if (itemKind(item) !== 'video' || itemThumb(item) || !item.file) continue;
      void grabVideoFrame(item.file).then((url) => {
        if (!cancelled && url) {
          setVideoThumbs((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: url }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [items]);

  React.useEffect(() => {
    const activeIds = new Set(items.map((item) => item.id));
    setVideoThumbs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, url] of Object.entries(prev)) {
        if (!activeIds.has(id)) {
          URL.revokeObjectURL(url);
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  React.useEffect(() => () => {
    for (const url of Object.values(videoThumbsRef.current)) URL.revokeObjectURL(url);
  }, []);

  const resolveThumb = React.useCallback(
    (item: AttachmentUploaderItem) => itemThumb(item) ?? videoThumbs[item.id] ?? null,
    [videoThumbs],
  );

  const openFilePicker = () => {
    if (!disabled && canAdd) inputRef.current?.click();
  };

  const renderState = (item: AttachmentUploaderItem, variant: 'card' | 'row' | 'composer') => {
    const busy = isBusy(item.status);
    const failed = item.status === 'error';
    if (!busy && !failed) return null;
    const progress = Math.round(
      Math.min(100, Math.max(0, (item.progress ?? 0) * ((item.progress ?? 0) <= 1 ? 100 : 1))),
    );

    if (variant === 'composer') {
      return (
        <div
          className={cn('au-state', 'au-state--composer', (busy || failed) && 'is-on')}
          role="status"
          aria-label={busy ? uploadingLabel : item.error || failedLabel}
        >
          {busy ? (
            <div className="au-composer-progress" aria-hidden>
              <span className="au-pct au-pct--composer">{progress}%</span>
              <div
                className="au-ring au-ring--composer"
                style={{ '--au-progress': progress } as React.CSSProperties}
              />
            </div>
          ) : (
            <div className="au-err au-err--composer">
              <AlertTriangleIcon className="size-4" aria-hidden />
              <span>{item.error || failedLabel}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={cn('au-state', (busy || failed) && 'is-on')} aria-hidden={!busy && !failed}>
        {busy ? (
          <>
            <div className="au-ring" style={{ '--au-progress': progress } as React.CSSProperties} />
            <div className="au-pct">{progress}%</div>
          </>
        ) : (
          <div className="au-err">
            <AlertTriangleIcon className="size-4" />
            <span>{item.error || failedLabel}</span>
          </div>
        )}
      </div>
    );
  };

  const renderGridCard = (item: AttachmentUploaderItem) => {
    const kindValue = itemKind(item);
    const thumb = resolveThumb(item);
    const busy = isBusy(item.status);
    const ext = getFileExt(item.name);
    return (
      <div
        key={item.id}
        className={cn('au-card', removingIds.has(item.id) && 'is-out', busy && 'is-busy')}
        data-id={item.id}
      >
        <div className="au-thumb">
          <div className="au-thumb-inner">
            {kindValue === 'image' && thumb ? <img src={thumb} alt={item.name} /> : null}
            {kindValue === 'video' ? (
              <>
                {thumb ? <img src={thumb} alt={item.name} /> : null}
                <span className="au-vplay"><PlayIcon className="size-3.5" /></span>
              </>
            ) : null}
            {(kindValue === 'doc' || (kindValue === 'audio' && !thumb)) ? (
              <span className="au-ext" style={{ backgroundColor: extColor(ext) }}>
                {(ext || 'FILE').slice(0, 4)}
              </span>
            ) : null}
          </div>
          {renderState(item, 'card')}
          <div className="au-acts">
            <button type="button" className="au-act-btn" title="预览" onClick={() => setPreviewItem(item)}>
              <EyeIcon className="size-3.5" />
            </button>
            {removable ? (
              <button type="button" className="au-act-btn au-act-btn--danger" title="删除" onClick={() => handleRemove(item.id)}>
                <Trash2Icon className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="au-info">
          <div className="au-name" title={item.name}>{item.name}</div>
          <div className="au-size">{formatAttachmentSize(item.size)}</div>
        </div>
      </div>
    );
  };

  const renderListRow = (item: AttachmentUploaderItem) => {
    const kindValue = itemKind(item);
    const thumb = resolveThumb(item);
    const ext = getFileExt(item.name);
    const playing = playingId === item.id;
    return (
      <div key={item.id} className={cn('au-row', removingIds.has(item.id) && 'is-out')} data-id={item.id}>
        <div className="au-row-ico">
          {kindValue === 'audio' ? (
            <button type="button" className="au-audio-btn" title={playing ? '暂停' : '播放'} onClick={() => toggleAudio(item)}>
              {playing ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
            </button>
          ) : kindValue === 'image' && thumb ? (
            <img src={thumb} alt={item.name} />
          ) : (
            <span className="au-ext au-ext--sm" style={{ backgroundColor: extColor(ext) }}>
              {(ext || 'FILE').slice(0, 4)}
            </span>
          )}
        </div>
        <div className="au-row-main">
          <div className="au-name" title={item.name}>{item.name}</div>
          <div className="au-size">{formatAttachmentSize(item.size)}</div>
        </div>
        <div className="au-row-acts">
          <button type="button" className="au-ibtn" title="预览" onClick={() => setPreviewItem(item)}>
            <EyeIcon className="size-3.5" />
          </button>
          {item.status === 'error' && onRetry ? (
            <button type="button" className="au-ibtn" title="重试" onClick={() => onRetry(item.id)}>
              <RotateCcwIcon className="size-3.5" />
            </button>
          ) : null}
          {removable ? (
            <button type="button" className="au-ibtn au-ibtn--danger" title="删除" onClick={() => handleRemove(item.id)}>
              <Trash2Icon className="size-3.5" />
            </button>
          ) : null}
        </div>
        {renderState(item, 'row')}
      </div>
    );
  };

  const renderComposerCard = (item: AttachmentUploaderItem) => {
    const kindValue = itemKind(item);
    const thumb = resolveThumb(item);
    const busy = isBusy(item.status);
    const failed = item.status === 'error';
    const ext = getFileExt(item.name);
    const isImage = kindValue === 'image' && Boolean(thumb);
    const dismissLabel = `移除 ${item.name}`;

    return (
      <div
        key={item.id}
        className={cn(
          'au-composer-card',
          removingIds.has(item.id) && 'is-out',
          busy && 'is-busy',
          failed && 'is-error',
          isImage && 'au-composer-card--image',
        )}
        data-id={item.id}
      >
        {isImage ? (
          <button
            type="button"
            className="au-composer-media"
            onClick={() => !busy && setPreviewItem(item)}
            aria-label={busy ? uploadingLabel : item.name}
            disabled={busy}
          >
            <img src={thumb!} alt="" />
          </button>
        ) : (
          <button
            type="button"
            className="au-composer-doc"
            onClick={() => !busy && setPreviewItem(item)}
            aria-label={busy ? uploadingLabel : item.name}
            disabled={busy}
          >
            <span className="au-composer-name" title={item.name}>{item.name}</span>
            <span className="au-composer-doc-sheet" aria-hidden>
              {kindValue === 'video' && thumb ? <img src={thumb} alt="" /> : <span className="au-composer-doc-lines" />}
            </span>
            <span className="au-composer-badge">{(ext || 'FILE').slice(0, 5).toUpperCase()}</span>
            {kindValue === 'video' ? (
              <span className="au-composer-vplay" aria-hidden>
                <PlayIcon className="size-3.5" />
              </span>
            ) : null}
          </button>
        )}
        {renderState(item, 'composer')}
        {removable ? (
          <button
            type="button"
            className="au-composer-dismiss"
            title="删除"
            aria-label={dismissLabel}
            onClick={() => handleRemove(item.id)}
            disabled={busy}
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        ) : null}
        {failed && onRetry ? (
          <button
            type="button"
            className="au-composer-retry"
            title="重试"
            onClick={() => onRetry(item.id)}
          >
            <RotateCcwIcon className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    );
  };

  const renderInlineItem = (item: AttachmentUploaderItem) => {
    const kindValue = itemKind(item);
    const isFile = kindValue !== 'image' || !item.previewUrl;
    const uploading = item.status === 'uploading';
    const failed = item.status === 'error';
    const dismissLabel = `移除 ${item.name}`;

    if (!isFile && item.previewUrl) {
      return (
        <ComposerContextStripImage
          key={item.id}
          src={item.previewUrl}
          alt={item.name}
          onPreview={() => setPreviewItem(item)}
          onDismiss={removable ? () => handleRemove(item.id) : undefined}
          dismissLabel={removable ? dismissLabel : undefined}
        />
      );
    }

    const meta = uploading
      ? uploadingLabel
      : failed
        ? (item.error || failedLabel)
        : [getFileExt(item.name).toUpperCase(), formatAttachmentSize(item.size)].filter(Boolean).join(' ');

    const progressValue = item.progress ?? undefined;

    return (
      <ComposerContextStripChip
        key={item.id}
        icon={uploading ? undefined : <FileIcon className="size-3.5" />}
        label={item.name}
        meta={meta}
        status={failed ? 'error' : uploading ? 'uploading' : 'default'}
        progress={uploading ? progressValue : undefined}
        onRetry={failed && onRetry ? () => onRetry(item.id) : undefined}
        onDismiss={removable ? () => handleRemove(item.id) : undefined}
        dismissLabel={removable ? dismissLabel : undefined}
      />
    );
  };

  const renderAddTile = () => {
    if (!canAdd) return null;
    if (resolvedLayout === 'list') {
      return (
        <button type="button" className="au-add--list" onClick={openFilePicker}>
          <span className="au-add-icon">+</span>
          <span>{buttonLabel ?? addText}</span>
        </button>
      );
    }
    if (resolvedLayout === 'grid') {
      return (
        <button type="button" className="au-add--grid" onClick={openFilePicker}>
          <span className="au-add-icon">+</span>
          <span className="au-add-label">{buttonLabel ?? addText}</span>
        </button>
      );
    }
    return null;
  };

  const showEmptyDropzone = items.length === 0 && canAdd && resolvedLayout !== 'inline';

  return (
    <div
      className={cn('au', dragOver && 'is-over', className)}
      onDragEnter={(event) => {
        if (disabled) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragOver(true);
      }}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragOver(false);
      }}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        dragDepthRef.current = 0;
        setDragOver(false);
        intake(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={resolvedAccept || undefined}
        multiple={multiple && remaining > 1}
        disabled={disabled || !canAdd}
        aria-label={inputLabel ?? buttonLabel ?? addText}
        onChange={(event) => {
          intake(event.target.files ?? []);
          event.target.value = '';
        }}
      />

      {showEmptyDropzone ? (
        <button type="button" className="au-empty" onClick={openFilePicker} disabled={disabled}>
          <span className="au-empty__icon" aria-hidden>
            {emptyIcon ?? <UploadIcon className="size-5" aria-hidden />}
          </span>
          {emptyTitle ? <span className="au-empty__title">{emptyTitle}</span> : null}
          {emptyDescription ? <span className="au-empty__desc">{emptyDescription}</span> : null}
          {!emptyTitle && !emptyDescription ? <span className="au-empty__title">{buttonLabel ?? `选择${addText}`}</span> : null}
        </button>
      ) : null}

      {items.length > 0 || (canAdd && !showEmptyDropzone) ? (
        resolvedLayout === 'inline' ? (
          <ComposerContextStripScroll>
            <div className="au-list--inline" role="group" aria-label="attachments">
              {items.map(renderInlineItem)}
            </div>
          </ComposerContextStripScroll>
        ) : resolvedLayout === 'composer' ? (
          <div className="au-list--composer" role="group" aria-label="attachments">
            {items.map(renderComposerCard)}
          </div>
        ) : (
          <div
            className={cn(
              resolvedLayout === 'grid' && 'au-list--grid',
              resolvedLayout === 'list' && 'au-list--list',
            )}
            role="group"
            aria-label="attachments"
          >
            {resolvedLayout === 'grid' ? items.map(renderGridCard) : null}
            {resolvedLayout === 'list' ? items.map(renderListRow) : null}
            {!showEmptyDropzone ? renderAddTile() : null}
          </div>
        )
      ) : null}

      <AttachmentPreviewDialog
        item={previewItem}
        open={Boolean(previewItem)}
        onOpenChange={(open) => !open && setPreviewItem(null)}
      />
    </div>
  );
}
