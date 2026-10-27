import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2Icon, SparklesIcon, StopCircleIcon } from 'lucide-react';
import { Button, type buttonVariants } from './button';
import type { VariantProps } from 'class-variance-authority';
import { cn } from './utils';

export type AITaskStatus =
  | 'idle'
  | 'submitting'
  | 'queued'
  | 'running'
  | 'streaming'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface AITaskButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 任务状态机枚举 */
  status?: AITaskStatus;
  /** 简便 loading 开关（映射为 submitting/running） */
  loading?: boolean;
  /** 是否允许在运行期作为「停止生成」按钮 */
  canCancel?: boolean;
  /** 点击停止生成的回调 */
  onCancel?: () => void;
  /** 提交中/排队中文案 */
  loadingText?: string;
  /** 运行中/流式中文案 */
  runningText?: string;
  /** 停止按钮文案 */
  cancelText?: string;
  /** 防重与防抖窗口（毫秒，默认 300ms） */
  debounceMs?: number;
  /** 空闲期前置图标，缺省为 SparklesIcon */
  icon?: LucideIcon;
  /** 子元素（默认空闲期文本） */
  children: React.ReactNode;
}

/** 统一 AI 任务触发按钮：内置防重复点击、即刻视觉反馈、流光微动效与停止生成切换 */
export const AITaskButton = React.forwardRef<HTMLButtonElement, AITaskButtonProps>(
  function AITaskButton(
    {
      status = 'idle',
      loading = false,
      canCancel = false,
      onCancel,
      loadingText = '正在思考...',
      runningText = 'AI 正在生成...',
      cancelText = '停止生成',
      debounceMs = 300,
      icon: CustomIcon = SparklesIcon,
      children,
      className,
      disabled,
      onClick,
      variant = 'default',
      size = 'default',
      ...props
    },
    ref,
  ) {
    const isBusyStatus =
      loading ||
      status === 'submitting' ||
      status === 'queued' ||
      status === 'running' ||
      status === 'streaming';

    // 内部快速响应锁：点击瞬间（<100ms）立刻置为点击中，防止外部 state 尚未更新引发的双击
    const [localClickLocked, setLocalClickLocked] = React.useState(false);
    const lastClickTimeRef = React.useRef(0);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const now = Date.now();
      if (now - lastClickTimeRef.current < debounceMs) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastClickTimeRef.current = now;

      if (isBusyStatus && canCancel && onCancel) {
        e.preventDefault();
        onCancel();
        return;
      }

      if (isBusyStatus || localClickLocked) {
        e.preventDefault();
        return;
      }

      setLocalClickLocked(true);
      window.setTimeout(() => {
        setLocalClickLocked(false);
      }, debounceMs);

      onClick?.(e);
    };

    const isLocked = disabled || (isBusyStatus && !canCancel) || localClickLocked;

    // 文案计算
    let label = children;
    if (isBusyStatus) {
      if (canCancel) {
        label = cancelText;
      } else if (status === 'submitting' || status === 'queued' || localClickLocked) {
        label = loadingText;
      } else {
        label = runningText;
      }
    }

    // 图标计算
    let iconElement: React.ReactNode = null;
    if (isBusyStatus) {
      if (canCancel) {
        iconElement = <StopCircleIcon className="size-4 animate-pulse text-destructive" />;
      } else {
        iconElement = <Loader2Icon className="size-4 animate-spin text-current" />;
      }
    } else if (CustomIcon) {
      iconElement = <CustomIcon className="size-4 text-current" />;
    }

    return (
      <Button
        ref={ref}
        variant={canCancel && isBusyStatus ? 'outline' : variant}
        size={size}
        disabled={isLocked}
        className={cn(
          'relative transition-all duration-200 select-none gap-2 font-medium',
          isBusyStatus && !canCancel && 'cursor-wait opacity-90',
          className,
        )}
        onClick={handleClick}
        aria-busy={isBusyStatus}
        {...props}
      >
        {iconElement}
        <span>{label}</span>
      </Button>
    );
  },
);
