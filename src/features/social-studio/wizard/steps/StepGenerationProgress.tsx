import { SparklesIcon, RefreshCwIcon, CheckCircle2Icon, ArrowRightIcon, HistoryIcon, LayersIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'

type StepGenerationProgressProps = {
  platform?: 'xhs' | 'wechat'
  progressPercent: number
  generatedImageCount: number
  targetImageCount?: number
  currentStageLabel: string
  isDone: boolean
  onEnterStudio: () => void
  onGoHistory?: () => void
}

export function StepGenerationProgress({
  progressPercent,
  generatedImageCount,
  currentStageLabel,
  isDone,
  onEnterStudio,
  onGoHistory,
}: StepGenerationProgressProps) {
  return (
    <div className="w-full max-w-2xl mx-auto py-16 px-4 flex flex-col items-center text-center space-y-8 animate-in fade-in duration-300">
      {/* 渐变发光徽标 */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 size-24 rounded-3xl bg-primary/20 blur-xl animate-pulse" />
        <div className="relative size-20 rounded-3xl bg-gradient-to-tr from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25">
          {isDone ? (
            <CheckCircle2Icon className="size-10 stroke-[2.2] animate-in zoom-in-75" />
          ) : (
            <SparklesIcon className="size-10 stroke-[2.2] animate-bounce" />
          )}
        </div>
      </div>

      {/* 状态文字 */}
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {isDone ? 'AI 图文创作已完成' : '正在智能生成中'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {currentStageLabel || (isDone ? '所有排版配图与文案已就绪' : '正在提炼爆款逻辑并排版生成...')}
        </p>
      </div>

      {/* 进度条与数量统计 */}
      <div className="w-full max-w-md space-y-2.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
          <span>生成进度 · 已生成 {generatedImageCount} 张</span>
          <span className="font-semibold text-primary">{Math.min(100, Math.max(5, progressPercent))}%</span>
        </div>

        {/* 进度条 */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
          />
        </div>
      </div>

      {/* 正在生成的动态卡片 */}
      <div className="w-full max-w-md p-4 rounded-2xl border border-border/70 bg-card shadow-sm flex items-center gap-3 text-left">
        {isDone ? (
          <CheckCircle2Icon className="size-5 text-emerald-500 shrink-0" />
        ) : (
          <RefreshCwIcon className="size-5 text-primary animate-spin shrink-0" />
        )}
        <div className="space-y-0.5 min-w-0 flex-1">
          <span className="text-[11px] font-semibold text-primary uppercase">
            {isDone ? '就绪' : '处理中'}
          </span>
          <p className="text-xs text-foreground font-medium truncate">
            {currentStageLabel || '正在准备内容'}
          </p>
        </div>
      </div>

      {/* 任务已转入后台提示卡片 */}
      <div className="w-full max-w-md p-4 rounded-2xl border border-border/60 bg-muted/40 text-left flex items-start gap-3">
        <HistoryIcon className="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-muted-foreground flex-1">
          <span className="font-semibold text-foreground">任务已转入后台管理</span>
          <p className="leading-relaxed">
            您可以先去使用其他功能，或者开始再创作一篇。生成完成后随时可在右上角「历史」查看或一键载入。
          </p>
        </div>
      </div>

      {/* 操作入口 */}
      <div className="flex items-center gap-3 pt-2">
        {onGoHistory && (
          <Button variant="outline" onClick={onGoHistory} className="rounded-xl gap-1.5">
            <HistoryIcon className="size-4" />
            <span>查看任务历史</span>
          </Button>
        )}
        <Button
          onClick={onEnterStudio}
          className={`rounded-xl gap-2 font-medium px-6 ${
            isDone
              ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 scale-105'
              : 'bg-primary/90 text-primary-foreground'
          }`}
        >
          <LayersIcon className="size-4" />
          <span>{isDone ? '立即进入灵感创作画布' : '进入灵感创作预览'}</span>
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
