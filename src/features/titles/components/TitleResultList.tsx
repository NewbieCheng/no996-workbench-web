import React, { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronUp, Sparkles, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { TitleCandidate } from '../agent/types'

interface TitleResultListProps {
  candidates: TitleCandidate[]
  selectedId?: number | null
  onSelectCandidate?: (id: number) => void
}

export const TitleResultList: React.FC<TitleResultListProps> = ({
  candidates,
  selectedId,
  onSelectCandidate,
}) => {
  const { t } = useTranslation('workbench')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const handleCopy = async (candidate: TitleCandidate, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(candidate.title)
      setCopiedId(candidate.id)
      toast.success(`已复制：${candidate.title}`)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('复制失败，请手动选取复制')
    }
  }

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedId((prev) => (prev === id ? null : id))
    onSelectCandidate?.(id)
  }

  return (
    <div className="flex flex-col gap-3">
      {candidates.map((candidate) => {
        const isRec = candidate.isRecommended
        const isSelected = selectedId === candidate.id
        const isExpanded = expandedId === candidate.id
        const isCopied = copiedId === candidate.id
        const isOverLimit = candidate.charCount > candidate.maxCharCount

        return (
          <div
            key={candidate.id}
            onClick={() => onSelectCandidate?.(candidate.id)}
            className={`group relative rounded-xl border bg-card p-4 transition-all cursor-pointer ${
              isRec
                ? 'border-orange-500/80 shadow-xs ring-1 ring-orange-500/20'
                : isSelected
                  ? 'border-primary shadow-xs'
                  : 'border-border/80 hover:border-border hover:shadow-xs'
            }`}
          >
            {/* 顶层主内容区 */}
            <div className="flex items-start justify-between gap-4">
              {/* 序号与主要文本 */}
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isRec
                      ? 'bg-orange-500 text-white'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {candidate.rank}
                </span>

                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-foreground leading-snug break-words">
                    {candidate.title}
                  </h4>

                  {/* 标签与指标行 */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                    {isRec && (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-500/10 px-2 py-0.5 font-bold text-orange-600 dark:text-orange-400">
                        <Sparkles className="h-3 w-3" />
                        {t('titlesRecommendedBadge')}
                      </span>
                    )}

                    {candidate.isParetoOptimal && (
                      <span className="inline-flex items-center gap-1 rounded border border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20 px-1.5 py-0.5 font-medium text-orange-600 dark:text-orange-400 text-[11px]">
                        {t('titlesParetoPoint')}
                      </span>
                    )}

                    <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground font-medium">
                      {candidate.formulaName}
                    </span>

                    <span className="rounded bg-muted/60 px-2 py-0.5 text-muted-foreground">
                      {candidate.sourceTag}
                    </span>

                    <div className="ml-auto flex items-center gap-3 text-muted-foreground text-xs">
                      <span>
                        {t('titlesCtrLabel')} <strong className="text-foreground">{candidate.ctr}%</strong>
                      </span>
                      <span>
                        {t('titlesCredLabel')} <strong className="text-foreground">{candidate.credibility}</strong>
                      </span>
                      <span className={isOverLimit ? 'text-red-500 font-semibold' : ''}>
                        {candidate.charCount}/{candidate.maxCharCount}字
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 右侧大综合分与复制按钮 */}
              <div className="flex flex-col items-end shrink-0 pl-2">
                <div className="text-right">
                  <div className="text-2xl font-black text-foreground tracking-tight leading-none">
                    {candidate.score}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">
                    {t('titlesScoreLabel')}
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleCopy(candidate, e)}
                    className="flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {isCopied ? t('titlesCopiedBtn') : t('titlesCopyBtn')}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => toggleExpand(candidate.id, e)}
                    className="rounded-md border border-border/80 bg-background p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={isExpanded ? '收起进化轨迹' : '查看进化轨迹'}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* 展开的进化轨迹抽屉 */}
            {isExpanded && candidate.rounds && candidate.rounds.length > 0 && (
              <div className="mt-3.5 pt-3 border-t border-border/60 text-xs">
                <div className="mb-2 flex items-center gap-1 font-semibold text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>3轮AI进化轨迹</span>
                </div>

                <div className="space-y-2">
                  {candidate.rounds.map((round) => (
                    <div
                      key={round.round}
                      className="rounded-lg bg-muted/40 p-2.5 flex flex-col gap-1 border border-border/40"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground">
                          第 {round.round} 轮 {round.round === 1 ? '初稿' : round.round === 2 ? '二稿' : '终稿'}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>点击率: {round.ctr}%</span>
                          <span>可信度: {round.credibility}</span>
                          <span>得分: {round.score}</span>
                        </div>
                      </div>
                      <div className="text-foreground text-xs font-medium">{round.title}</div>
                      {round.issue && (
                        <div className="text-[11px] text-red-500 dark:text-red-400">
                          发现问题：{round.issue}
                        </div>
                      )}
                      {round.improvement && (
                        <div className="text-[11px] text-muted-foreground">
                          优化方向：{round.improvement}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
