import * as React from 'react';
import {
  CheckCircle2Icon,
  CircleIcon,
  Loader2Icon,
  MessageSquareIcon,
  SparklesIcon,
  StopCircleIcon,
  XCircleIcon,
} from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

export interface AITaskStageItem {
  key?: string;
  label: string;
  desc?: string;
}

export interface AITaskProgressProps {
  /** 任务大标题 */
  title?: string;
  /** 任务副描述 */
  desc?: string;
  /** 数字员工 / 业务角色标识 */
  agentName?: string;
  /** 自然语言实时大标题（如模型当前思考或输出摘要） */
  headline?: string;
  /** 业务阶段列表 */
  stages: readonly AITaskStageItem[];
  /** 当前阶段索引（0-based）。未传或启用 autoAdvanceStages 时将基于真实耗时/进度平滑自推进 */
  currentStageIndex?: number;
  /** 是否允许基于耗时/进度自动推进阶段步骤（默认 true，避免单次 LLM 调用时阶段长期停滞） */
  autoAdvanceStages?: boolean;
  /** 预估总耗时（秒，默认 10s），用于计算平滑渐近阻尼曲线 */
  estimatedTotalSeconds?: number;
  /** 显式进度百分比（0-100）。若外部已提供精确进度则直接采用 */
  percent?: number;
  /** 已耗时（秒）。若未传外部计时器，组件内部会自动高频连续计时 */
  elapsedSeconds?: number;
  /** 任务终态 */
  status?: 'running' | 'complete' | 'failed' | 'cancelled' | 'timeout';
  /** 是否允许取消 */
  canCancel?: boolean;
  /** 取消回调 */
  onCancel?: () => void;
  /** 返回前页回调 */
  onBack?: () => void;
  /** 返回按钮文案 */
  backText?: string;
  /** 打开过程会话回调（如查看思考流或续聊） */
  onOpenProcess?: () => void;
  /** 过程会话是否可打开 */
  processOpenable?: boolean;
  className?: string;
}

/** 格式化耗时 00:00 */
function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** 统一 AI 阶段进度卡片：阶段自然流转、高频平滑渐近进度条、生动光感呼吸与过程联动 */
export function AITaskProgress({
  title = 'AI 正在深度处理中',
  desc = '正在分析输入特征、核对规范依据并生成专业结果，请稍候...',
  agentName,
  headline,
  stages,
  currentStageIndex,
  autoAdvanceStages = true,
  estimatedTotalSeconds = 10,
  percent: explicitPercent,
  elapsedSeconds: externalElapsedSeconds,
  status = 'running',
  canCancel = false,
  onCancel,
  onBack,
  backText = '返回上一步',
  onOpenProcess,
  processOpenable = true,
  className,
}: AITaskProgressProps) {
  // 内部高频平滑计时器：每 100ms 刷新一次，保证进度条像水流般持续前进，杜绝死板卡顿感
  const [internalElapsedMs, setInternalElapsedMs] = React.useState(0);

  React.useEffect(() => {
    if (status !== 'running') return;
    const startTime = Date.now();
    const timer = window.setInterval(() => {
      setInternalElapsedMs(Date.now() - startTime);
    }, 100);
    return () => window.clearInterval(timer);
  }, [status]);

  // 有效耗时（秒）
  const totalElapsedSec =
    externalElapsedSeconds !== undefined && externalElapsedSeconds > 0
      ? externalElapsedSeconds + (internalElapsedMs % 1000) / 1000
      : internalElapsedMs / 1000;

  // 科学渐近阻尼进度计算：
  // 采用双曲对数渐近曲线 P(t) = 14 + 78 * (1 - e^(-t / tau))
  // 刚启动即有 14% 极速正向反馈，随时间平滑持续爬升，在预估时间内达到 80%+，之后以对数衰减逼近 92%
  // 绝不在中间停滞，绝不假跳 100%，直到 status === 'complete' 瞬间冲满
  const computedPercent = React.useMemo(() => {
    if (status === 'complete') return 100;
    if (status === 'failed' || status === 'cancelled' || status === 'timeout') {
      return explicitPercent ?? 50;
    }
    if (explicitPercent !== undefined && Number.isFinite(explicitPercent)) {
      return Math.min(100, Math.max(0, Math.round(explicitPercent)));
    }

    const t = Math.max(0.1, totalElapsedSec);
    const tau = Math.max(2, estimatedTotalSeconds / 2.2);
    const asymptotic = 14 + 78 * (1 - Math.exp(-t / tau));
    return Math.min(92, Math.max(14, Math.round(asymptotic)));
  }, [status, explicitPercent, totalElapsedSec, estimatedTotalSeconds]);

  // 动态阶段推演：
  // 当外部未主动改变阶段索引时，根据当前平滑进度所处的分段等分推进当前步骤，让每一步都能自然亮起并完成
  const effectiveStageIndex = React.useMemo(() => {
    if (status === 'complete') return stages.length;
    if (stages.length === 0) return 0;
    if (currentStageIndex !== undefined && !autoAdvanceStages) {
      return currentStageIndex;
    }
    // 将 0% ~ 88% 的区间按阶段数量等分
    const stageSlice = 88 / stages.length;
    const derived = Math.floor(computedPercent / stageSlice);
    return Math.min(stages.length - 1, Math.max(0, derived));
  }, [status, stages.length, currentStageIndex, autoAdvanceStages, computedPercent]);

  // 动态状态语：若没有外界特定 headline，则使用当前正在进行的阶段描述，让状态文案时刻贴合进度
  const currentStageItem = stages[effectiveStageIndex];
  const dynamicHeadline =
    headline && headline.trim() && !headline.includes('...')
      ? headline
      : currentStageItem?.desc || currentStageItem?.label || headline || '正在深度处理中...';

  return (
    <div
      className={cn(
        'relative mx-auto flex w-full max-w-2xl flex-col items-center rounded-2xl border border-border/80 bg-card/60 p-6 md:p-8 backdrop-blur-sm shadow-sm transition-all',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy={status === 'running'}
    >
      {/* 头部状态微章 */}
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {status === 'complete' ? (
          <CheckCircle2Icon className="size-6 text-emerald-500" />
        ) : status === 'failed' || status === 'timeout' ? (
          <XCircleIcon className="size-6 text-destructive" />
        ) : (
          <SparklesIcon className="size-6 animate-pulse" />
        )}
      </div>

      <h3 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
        {title}
      </h3>
      <p className="mt-1 text-center text-xs text-muted-foreground md:text-sm max-w-md">
        {desc}
      </p>

      {/* 核心卡片 */}
      <div className="mt-6 w-full rounded-xl border border-border/60 bg-muted/20 p-5">
        {/* 大标题与数字员工 */}
        {(agentName || dynamicHeadline) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3 text-xs">
            {agentName && (
              <span className="font-medium text-muted-foreground flex items-center gap-1.5 shrink-0">
                <span className="size-2 rounded-full bg-primary/80 animate-ping" />
                {agentName}
              </span>
            )}
            {dynamicHeadline && (
              <span className="ai-shimmer-text font-medium truncate max-w-[280px] sm:max-w-md">
                {dynamicHeadline}
              </span>
            )}
          </div>
        )}

        {/* 动态高频平滑进度条 */}
        <div className="relative mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
            <span className="flex items-center gap-1.5">
              <span>处理进度</span>
              {status === 'running' && (
                <span className="size-1.5 rounded-full bg-primary animate-ping" />
              )}
            </span>
            <span className="font-mono text-foreground font-semibold">
              {computedPercent}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/80 shadow-inner">
            <div
              className={cn(
                'relative h-full rounded-full transition-all duration-200 ease-out overflow-hidden',
                status === 'complete'
                  ? 'bg-emerald-500'
                  : status === 'failed'
                    ? 'bg-destructive'
                    : 'bg-primary',
              )}
              style={{ width: `${computedPercent}%` }}
            >
              {status === 'running' && (
                <span
                  className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/35 to-transparent animate-[ai-shimmer_1.5s_infinite]"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </div>

        {/* 阶段步骤列表 */}
        {stages.length > 0 && (
          <ol className="space-y-3.5">
            {stages.map((stage, idx) => {
              const isPast = idx < effectiveStageIndex || status === 'complete';
              const isCurrent = idx === effectiveStageIndex && status === 'running';

              return (
                <li
                  key={stage.key || idx}
                  className={cn(
                    'flex items-start gap-3 text-sm transition-all duration-300',
                    isPast
                      ? 'text-foreground'
                      : isCurrent
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground/60',
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {isPast ? (
                      <CheckCircle2Icon className="size-4 text-emerald-500 transition-transform duration-300 scale-100" />
                    ) : isCurrent ? (
                      <Loader2Icon className="size-4 text-primary animate-spin" />
                    ) : (
                      <CircleIcon className="size-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className={cn(isCurrent && 'ai-shimmer-text font-semibold')}>
                      {stage.label}
                    </span>
                    {stage.desc && (
                      <span className="text-xs text-muted-foreground/80 mt-0.5">
                        {stage.desc}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* 底部信息与动作区 */}
      <div className="mt-6 flex w-full flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>已耗时：</span>
          <span className="font-mono font-medium text-foreground">
            {formatSeconds(Math.floor(totalElapsedSec))}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              {backText}
            </Button>
          )}

          {canCancel && onCancel && status === 'running' && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={onCancel}
            >
              <StopCircleIcon className="size-3.5 mr-1" />
              停止生成
            </Button>
          )}

          {onOpenProcess && (
            <Button
              variant="secondary"
              size="sm"
              disabled={!processOpenable}
              onClick={onOpenProcess}
            >
              <MessageSquareIcon className="size-3.5 mr-1" />
              查看过程
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
