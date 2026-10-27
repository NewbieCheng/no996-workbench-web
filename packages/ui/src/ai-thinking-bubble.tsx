import * as React from 'react';
import { ChevronDownIcon, ChevronRightIcon, SparklesIcon, StopCircleIcon } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

export interface AIThinkingBubbleProps {
  /** 思考正文（如果为空则展示跳动三点占位） */
  text?: string;
  /** 是否处于运行/生成状态 */
  running?: boolean;
  /** 顶部摘要文案 */
  headline?: string;
  /** 是否默认展开思考正文 */
  defaultExpanded?: boolean;
  /** 是否允许中途停止 */
  canCancel?: boolean;
  /** 停止回调 */
  onCancel?: () => void;
  className?: string;
}

/** 统一 AI 会话思考气泡：折叠式深度推导展示、打字机光标与三点跳动动效 */
export function AIThinkingBubble({
  text,
  running = true,
  headline = 'AI 正在深度推导...',
  defaultExpanded = false,
  canCancel = false,
  onCancel,
  className,
}: AIThinkingBubbleProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <div
      className={cn(
        'w-full max-w-2xl rounded-xl border border-border/60 bg-muted/25 transition-all',
        running && 'border-primary/30 shadow-[0_0_15px_rgba(var(--primary-rgb,14,165,233),0.05)]',
        className,
      )}
      role="region"
      aria-label="AI 思考过程"
    >
      {/* 头部摘要栏 */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <SparklesIcon
            className={cn(
              'size-3.5 shrink-0 text-primary',
              running && 'animate-pulse',
            )}
          />

          <span className="font-medium text-foreground/90 flex items-center gap-1.5">
            {headline}
            {running && (
              <span className="inline-flex items-center gap-0.5 ml-1" aria-hidden="true">
                <span className="ai-dot-1 size-1 rounded-full bg-primary" />
                <span className="ai-dot-2 size-1 rounded-full bg-primary" />
                <span className="ai-dot-3 size-1 rounded-full bg-primary" />
              </span>
            )}
          </span>

          {expanded ? (
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground ml-auto" />
          ) : (
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground ml-auto" />
          )}
        </button>

        {running && canCancel && onCancel && (
          <Button
            variant="ghost"
            size="xs"
            className="text-destructive hover:bg-destructive/10 ml-2"
            onClick={onCancel}
          >
            <StopCircleIcon className="size-3 mr-1" />
            停止
          </Button>
        )}
      </div>

      {/* 展开的思考内容 */}
      {expanded && (
        <div className="border-t border-border/40 px-4 py-3 text-xs text-muted-foreground/90 font-mono leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap">
          {text ? (
            <>
              {text}
              {running && (
                <span className="inline-block w-1.5 h-3 ml-1 bg-primary align-middle animate-pulse" />
              )}
            </>
          ) : (
            <span className="italic text-muted-foreground/60">
              正在分析上下文与模型思维链...
            </span>
          )}
        </div>
      )}
    </div>
  );
}
