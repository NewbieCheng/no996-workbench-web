import './composer-context-strip.css';
import * as React from 'react';
import { XIcon } from 'lucide-react';
import { cn } from './utils';
import { TipButton } from './tip-chrome';

function hasVisibleChildren(children: React.ReactNode): boolean {
  return React.Children.toArray(children).length > 0;
}

export type ComposerContextStripVariant = 'compact' | 'stack';

const ComposerContextStripVariantContext = React.createContext<ComposerContextStripVariant>('compact');

function useComposerContextStripVariant(): ComposerContextStripVariant {
  return React.useContext(ComposerContextStripVariantContext);
}

/** Composer 输入区顶部统一容器：PPT 模板、页面分享、附件横滑。无子节点时不渲染。 */
export function ComposerContextStrip({
  className,
  variant = 'compact',
  children,
}: React.ComponentProps<'div'> & { variant?: ComposerContextStripVariant }) {
  if (!hasVisibleChildren(children)) return null;
  return (
    <ComposerContextStripVariantContext.Provider value={variant}>
      <div
        className={cn('ccs', variant === 'compact' && 'ccs--compact', className)}
        data-slot="composer-context-strip"
        data-variant={variant}
      >
        {children}
      </div>
    </ComposerContextStripVariantContext.Provider>
  );
}

export type ComposerContextStripRowKind = 'ppt-template' | 'page-share';

export type ComposerContextStripRowProps = {
  icon?: React.ReactNode;
  label: string;
  /** 上下文类型：简略模式下区分 PPT 模板与页签分享的配色与形态。 */
  kind?: ComposerContextStripRowKind;
  /** 简略模式下的短标题（模板名、页签名等）；完整说明仍用 `label` 做 tooltip / 读屏。 */
  mention?: string;
  meta?: string;
  onClick?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  trailing?: React.ReactNode;
  status?: 'default' | 'error' | 'uploading';
  progress?: number;
  onRetry?: () => void;
  className?: string;
};

/** 全宽上下文行：模板选择、页面分享等。 */
export function ComposerContextStripRow({
  icon,
  label,
  kind,
  mention,
  meta,
  onClick,
  onDismiss,
  dismissLabel,
  trailing,
  status = 'default',
  progress,
  onRetry,
  className,
}: ComposerContextStripRowProps) {
  const stripVariant = useComposerContextStripVariant();
  const compact = stripVariant === 'compact';
  const failed = status === 'error';
  const uploading = status === 'uploading';
  const interactive = Boolean(onClick || (failed && onRetry));
  const BodyTag = interactive ? 'button' : 'span';
  const bodyProps =
    BodyTag === 'button'
      ? {
          type: 'button' as const,
          onClick: failed && onRetry ? onRetry : onClick,
        }
      : {};

  const progressPct =
    progress === undefined
      ? undefined
      : Math.min(100, Math.max(0, progress <= 1 ? progress * 100 : progress));

  const compactShort = compact && (mention?.trim() || kind);
  const showIcon = Boolean(icon || uploading) && (!compact || Boolean(kind));
  const compactText = mention?.trim() || (compactShort ? label : undefined);

  return (
    <div
      className={cn(
        'ccs-row',
        compact && 'ccs-row--compact',
        kind === 'ppt-template' && 'ccs-row--ppt-template',
        kind === 'page-share' && 'ccs-row--page-share',
        interactive && 'ccs-row--interactive',
        failed && 'ccs-row--error',
        className,
      )}
      role={interactive ? undefined : 'status'}
      data-status={status}
      aria-label={compactShort ? label : undefined}
      data-kind={kind}
    >
      {showIcon ? (
        <span className="ccs-row-icon" aria-hidden>
          {uploading ? <span className="ccs-spinner" /> : icon}
        </span>
      ) : uploading && !compact ? (
        <span className="ccs-row-icon" aria-hidden>
          <span className="ccs-spinner" />
        </span>
      ) : null}
      <BodyTag className="ccs-row-body" {...bodyProps} title={label}>
        {compactShort && compactText ? (
          <span className="ccs-row-label ccs-row-label--compact">
            {kind === 'page-share' ? (
              <span className="ccs-row-kind-tag" aria-hidden>页签</span>
            ) : kind === 'ppt-template' ? (
              <span className="ccs-row-kind-tag" aria-hidden>模板</span>
            ) : null}
            <span className="ccs-row-compact-text">{compactText}</span>
          </span>
        ) : (
          <span className="ccs-row-label">{label}</span>
        )}
        {meta && !compact ? (
          <span className={cn('ccs-row-meta', failed && 'ccs-row-meta--error')}>{meta}</span>
        ) : null}
      </BodyTag>
      <span className="ccs-row-actions">
        {trailing}
        {onDismiss && dismissLabel ? (
          <TipButton
            type="button"
            className="ccs-action ccs-action--danger"
            label={dismissLabel}
            onClick={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
          >
            <XIcon className="size-3" aria-hidden />
          </TipButton>
        ) : null}
      </span>
      {uploading && progressPct !== undefined ? (
        <span className="ccs-row-progress" aria-hidden>
          <span className="ccs-row-progress-bar" style={{ width: `${progressPct}%` }} />
        </span>
      ) : null}
    </div>
  );
}

/** 附件横滑区：文件 chip、图片 thumb。 */
export function ComposerContextStripScroll({
  className,
  children,
}: React.ComponentProps<'div'>) {
  if (!hasVisibleChildren(children)) return null;
  return (
    <div className={cn('ccs-scroll', className)} data-slot="composer-context-strip-scroll">
      {children}
    </div>
  );
}

export type ComposerContextStripChipProps = {
  icon?: React.ReactNode;
  label: string;
  meta?: string;
  onClick?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  status?: 'default' | 'error' | 'uploading';
  progress?: number;
  onRetry?: () => void;
  className?: string;
};

/** 横滑区内的紧凑文件 chip。 */
export function ComposerContextStripChip({
  icon,
  label,
  meta,
  onClick,
  onDismiss,
  dismissLabel,
  status = 'default',
  progress,
  onRetry,
  className,
}: ComposerContextStripChipProps) {
  const failed = status === 'error';
  const uploading = status === 'uploading';
  const BodyTag = failed && onRetry ? 'button' : onClick ? 'button' : 'span';
  const bodyProps =
    BodyTag === 'button'
      ? {
          type: 'button' as const,
          onClick: failed && onRetry ? onRetry : onClick,
        }
      : {};

  const progressPct =
    progress === undefined
      ? undefined
      : Math.min(100, Math.max(0, progress <= 1 ? progress * 100 : progress));

  return (
    <div
      className={cn('ccs-chip', failed && 'ccs-chip--error', className)}
      data-status={status}
    >
      {icon ? (
        <span className="ccs-row-icon" aria-hidden>
          {uploading ? <span className="ccs-spinner" /> : icon}
        </span>
      ) : uploading ? (
        <span className="ccs-row-icon" aria-hidden>
          <span className="ccs-spinner" />
        </span>
      ) : null}
      <BodyTag className="ccs-chip-body" {...bodyProps}>
        <span className="ccs-row-label" title={label}>
          {label}
        </span>
        {meta ? (
          <span className={cn('ccs-row-meta', failed && 'ccs-row-meta--error')}>{meta}</span>
        ) : null}
      </BodyTag>
      {onDismiss && dismissLabel ? (
        <TipButton
          type="button"
          className="ccs-action ccs-action--danger"
          label={dismissLabel}
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          <XIcon className="size-3" aria-hidden />
        </TipButton>
      ) : null}
      {uploading && progressPct !== undefined ? (
        <span className="ccs-row-progress" aria-hidden>
          <span className="ccs-row-progress-bar" style={{ width: `${progressPct}%` }} />
        </span>
      ) : null}
    </div>
  );
}

export type ComposerContextStripImageProps = {
  src: string;
  alt: string;
  onPreview?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
};

/** 横滑区内的图片缩略图。 */
export function ComposerContextStripImage({
  src,
  alt,
  onPreview,
  onDismiss,
  dismissLabel,
  className,
}: ComposerContextStripImageProps) {
  return (
    <div className={cn('ccs-chip', 'ccs-chip--image', className)} data-kind="image">
      <button type="button" className="ccs-image-btn" onClick={onPreview} aria-label={alt}>
        <img src={src} alt={alt} />
      </button>
      {onDismiss && dismissLabel ? (
        <TipButton
          type="button"
          className="ccs-action ccs-action--danger"
          label={dismissLabel}
          onClick={onDismiss}
        >
          <XIcon className="size-3" aria-hidden />
        </TipButton>
      ) : null}
    </div>
  );
}
