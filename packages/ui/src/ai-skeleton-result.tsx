import * as React from 'react';
import { cn } from './utils';

export interface AISkeletonResultProps {
  /** 骨架屏业务形态：form 为仿真表单（无内层卡片，由调用方提供单层容器） */
  variant?: 'report' | 'cards' | 'article' | 'form';
  /** 卡片形态时的卡片数量（默认 3） */
  cardCount?: number;
  /** 可选的占位提示标题 */
  headline?: string;
  /** form 形态是否铺满容器宽度（默认 true） */
  fill?: boolean;
  className?: string;
}

const FORM_BODY_LINES = ['w-full', 'w-[92%]', 'w-[86%]', 'w-[74%]', 'w-[62%]', 'w-[48%]'] as const;

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('ai-skeleton-line ai-shimmer-sweep', className)} />;
}

function SkeletonLines({ widths }: { widths: readonly string[] }) {
  return (
    <div className="ai-skeleton-lines">
      {widths.map((width, idx) => (
        <SkeletonLine key={idx} className={width} />
      ))}
    </div>
  );
}

function SkeletonBlock({
  className,
  compact,
  children,
}: {
  className?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'ai-skeleton-block rounded-2xl border border-border/60 bg-card/40 p-6',
        compact && 'ai-skeleton-block--compact',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 统一 AI 产物占位骨架屏：结构化模拟最终报告、卡片、长文或表单排版，配合无声流光扫光 */
export function AISkeletonResult({
  variant = 'report',
  cardCount = 3,
  headline,
  fill = variant === 'form',
  className,
}: AISkeletonResultProps) {
  return (
    <div
      className={cn('w-full', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="AI 结果生成中"
    >
      {headline && (
        <div className="flex items-center gap-2 mb-5 text-xs font-medium text-muted-foreground/80">
          <span className="size-2 rounded-full bg-primary/70 animate-pulse" />
          <span className="ai-shimmer-text">{headline}</span>
        </div>
      )}

      {variant === 'report' && (
        <SkeletonBlock>
          <div className="ai-skeleton-stack ai-skeleton-stack--loose">
            <div className="ai-shimmer-sweep h-7 w-2/5 rounded-lg" />
            <div className="flex flex-wrap gap-2.5">
              <div className="ai-shimmer-sweep h-5 w-16 rounded-full" />
              <div className="ai-shimmer-sweep h-5 w-20 rounded-full" />
              <div className="ai-shimmer-sweep h-5 w-24 rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="ai-skeleton-metric">
              <SkeletonLine className="w-1/2" />
              <div className="ai-shimmer-sweep h-6 w-3/4 rounded-lg" />
            </div>
            <div className="ai-skeleton-metric">
              <SkeletonLine className="w-1/3" />
              <div className="ai-shimmer-sweep h-6 w-2/3 rounded-lg" />
            </div>
            <div className="ai-skeleton-metric">
              <SkeletonLine className="w-2/5" />
              <div className="ai-shimmer-sweep h-6 w-4/5 rounded-lg" />
            </div>
          </div>

          <SkeletonLines widths={['w-full', 'w-11/12', 'w-4/5', 'w-9/12']} />
        </SkeletonBlock>
      )}

      {variant === 'cards' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: cardCount }).map((_, idx) => (
            <div
              key={idx}
              className="ai-skeleton-block ai-skeleton-block--compact rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm"
            >
              <div className="ai-shimmer-sweep aspect-video w-full rounded-xl" />
              <div className="flex items-center justify-between gap-2">
                <div className="ai-shimmer-sweep h-5 w-1/2 rounded" />
                <div className="ai-shimmer-sweep h-4 w-12 rounded-full" />
              </div>
              <SkeletonLines widths={['w-full', 'w-4/5']} />
            </div>
          ))}
        </div>
      )}

      {variant === 'article' && (
        <SkeletonBlock className={cn('md:p-8', fill ? 'w-full' : 'max-w-3xl')}>
          <div className="ai-skeleton-stack ai-skeleton-stack--loose">
            <div className="ai-shimmer-sweep h-8 w-3/4 rounded-lg" />
            <div className="ai-shimmer-sweep h-4 w-1/4 rounded" />
          </div>

          <div className="rounded-xl border-l-4 border-primary/40 bg-muted/20 p-5">
            <SkeletonLines widths={['w-full', 'w-5/6']} />
          </div>

          <div className="ai-skeleton-paragraphs">
            <SkeletonLines widths={['w-full', 'w-11/12', 'w-full', 'w-3/4']} />
            <SkeletonLines widths={['w-full', 'w-10/12', 'w-2/3']} />
          </div>
        </SkeletonBlock>
      )}

      {variant === 'form' && (
        <div className={cn('ai-skeleton-form', fill ? 'w-full' : 'max-w-3xl')}>
          <div className="ai-skeleton-form__field">
            <div className="ai-skeleton-form__label-row">
              <SkeletonLine className="w-20" />
              <SkeletonLine className="h-3.5 w-28" />
            </div>
            <div className="ai-shimmer-sweep h-10 w-full rounded-lg" />
          </div>

          <div className="ai-skeleton-form__field">
            <div className="ai-skeleton-form__label-row">
              <SkeletonLine className="w-24" />
              <div className="flex gap-3">
                <SkeletonLine className="h-3.5 w-12" />
                <SkeletonLine className="h-3.5 w-14" />
              </div>
            </div>
            <div className="ai-skeleton-form__body">
              <SkeletonLines widths={FORM_BODY_LINES} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
