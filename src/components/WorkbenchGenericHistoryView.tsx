import React, { useState } from 'react'
import { History, LayoutGrid, List, Copy, Check, ArrowRight, Trash2, ArrowUpRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export interface GenericHistoryItem {
  id: string
  title: string // 核心标题/推荐内容
  subtitle?: string // 次要描述（如受众/主题/参数）
  badge?: string // 标签（如平台或分类）
  highlightLabel?: string // 高亮小标签（如“推荐”或“已完成”）
  scoreText?: string // 分数或核心指标
  createdAt: number // 时间戳
  raw?: any
}

interface WorkbenchGenericHistoryViewProps {
  moduleName?: string // 模块名称，如“爆款标题”、“声音克隆”、“数字人”
  records: GenericHistoryItem[]
  onRestore: (item: GenericHistoryItem) => void
  onDelete: (id: string) => void
  onClearAll: () => void
  onGoCreate: () => void
  emptyTitle?: string
  emptyDescription?: string
}

export const WorkbenchGenericHistoryView: React.FC<WorkbenchGenericHistoryViewProps> = ({
  records,
  onRestore,
  onDelete,
  onClearAll,
  onGoCreate,
  emptyTitle,
  emptyDescription,
}) => {
  const { t } = useTranslation('workbench')
  // 视图模式：'cards' (卡片) | 'list' (列表)
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    return (localStorage.getItem('no996_history_view_mode') as 'cards' | 'list') || 'cards'
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleToggleViewMode = (mode: 'cards' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('no996_history_view_mode', mode)
  }

  const handleCopy = async (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success(t('titlesCopiedBtn'))
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const month = d.getMonth() + 1
    const date = d.getDate()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${month}/${date} ${hours}:${minutes}`
  }

  // 空态展示
  if (records.length === 0) {
    return (
      <div className="flex min-h-[420px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-10 text-center animate-in fade-in duration-200">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <History className="h-7 w-7" />
        </div>

        <h3 className="mt-4 text-base font-bold text-foreground">
          {emptyTitle || t('titlesHistoryEmptyTitle')}
        </h3>
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {emptyDescription || t('titlesHistoryEmptyDesc')}
        </p>

        <button
          type="button"
          onClick={onGoCreate}
          className="mt-6 flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-orange-600 active:scale-98"
        >
          <span>{t('titlesHistoryGoCreate')}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 animate-in fade-in duration-200">
      {/* 顶栏工具：计数、视图切换（卡片/列表）与清空操作 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              {t('pageTabHistory')}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {records.length}
            </span>
          </div>

          {/* 卡片 / 列表 切换按钮 */}
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => handleToggleViewMode('cards')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                viewMode === 'cards'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleToggleViewMode('list')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted-foreground transition-colors hover:text-red-500"
        >
          {t('titlesHistoryClear')}
        </button>
      </div>

      {/* 视图展现 */}
      {viewMode === 'cards' ? (
        /* 卡片视图 */
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {records.map((rec) => {
            const isCopied = copiedId === rec.id
            return (
              <div
                key={rec.id}
                onClick={() => onRestore(rec)}
                className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-orange-500/60 hover:shadow-xs cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {rec.badge && (
                        <span className="rounded bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                          {rec.badge}
                        </span>
                      )}
                      <span className="text-muted-foreground text-[11px]">
                        {formatTime(rec.createdAt)}
                      </span>
                    </div>

                    {rec.scoreText && (
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                        {rec.scoreText}
                      </span>
                    )}
                  </div>

                  {rec.subtitle && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {rec.subtitle}
                    </div>
                  )}

                  {/* 核心内容 */}
                  <div className="mt-2 rounded-lg bg-muted/40 p-2.5 border border-border/40">
                    {rec.highlightLabel && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 mb-1">
                        <Sparkles className="h-3 w-3" />
                        <span>{rec.highlightLabel}</span>
                      </div>
                    )}
                    <div className="text-sm font-semibold text-foreground leading-snug break-words">
                      {rec.title}
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleCopy(rec.title, rec.id, e)}
                      className="flex items-center gap-1 rounded bg-muted/60 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {isCopied ? t('titlesCopiedBtn') : t('titlesCopyBtn')}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(rec.id)
                      }}
                      className="p-1 text-muted-foreground/60 transition-colors hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 group-hover:translate-x-0.5 transition-transform">
                    <span>{t('titlesHistoryRestore')}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* 列表视图（紧凑表格/条目形态） */
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card divide-y divide-border/60">
          {records.map((rec) => {
            const isCopied = copiedId === rec.id
            return (
              <div
                key={rec.id}
                onClick={() => onRestore(rec)}
                className="group flex items-center justify-between gap-4 p-3.5 transition-colors hover:bg-muted/40 cursor-pointer"
              >
                {/* 左侧主要内容 */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {rec.badge && (
                    <span className="shrink-0 rounded bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                      {rec.badge}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {rec.title}
                      </span>
                      {rec.highlightLabel && (
                        <span className="shrink-0 rounded bg-orange-500/10 px-1.5 py-0.2 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                          {rec.highlightLabel}
                        </span>
                      )}
                    </div>
                    {rec.subtitle && (
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {rec.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                {/* 右侧指标与操作 */}
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  {rec.scoreText && (
                    <span className="font-bold text-orange-600 dark:text-orange-400 text-xs">
                      {rec.scoreText}
                    </span>
                  )}

                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    {formatTime(rec.createdAt)}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleCopy(rec.title, rec.id, e)}
                    className="flex items-center gap-1 rounded bg-muted/60 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {isCopied ? t('titlesCopiedBtn') : t('titlesCopyBtn')}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(rec.id)
                    }}
                    className="p-1 text-muted-foreground/50 transition-colors hover:text-red-500"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
