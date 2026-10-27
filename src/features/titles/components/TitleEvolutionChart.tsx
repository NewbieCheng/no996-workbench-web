import React, { useMemo, useState, useEffect } from 'react'
import { Maximize2, X, ZoomIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AgentMetrics, { type AgentMetric } from '../../../components/agent/AgentMetrics'
import type { TitleCandidate } from '../agent/types'

interface TitleEvolutionChartProps {
  candidates: TitleCandidate[]
  selectedId?: number | null
  onSelectCandidate?: (id: number) => void
  metricItems?: AgentMetric[]
}

export const TitleEvolutionChart: React.FC<TitleEvolutionChartProps> = ({
  candidates,
  selectedId,
  onSelectCandidate,
  metricItems,
}) => {
  const { t } = useTranslation('workbench')
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)

  // 坐标系定义
  // X轴: 点击率 4% ~ 12%
  // Y轴: 可信度 40 ~ 100
  const width = 640
  const height = 400
  const padding = { top: 35, right: 40, bottom: 50, left: 55 }

  const xMin = 4.0
  const xMax = 12.0
  const yMin = 40
  const yMax = 100

  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const scaleX = (ctr: number) => {
    const clamped = Math.max(xMin, Math.min(xMax, ctr))
    return padding.left + ((clamped - xMin) / (xMax - xMin)) * innerWidth
  }

  const scaleY = (cred: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, cred))
    return padding.top + innerHeight - ((clamped - yMin) / (yMax - yMin)) * innerHeight
  }

  // Pareto 最优连线（按点击率升序连接）
  const paretoPoints = useMemo(() => {
    const paretoItems = candidates
      .filter((c) => c.isParetoOptimal)
      .sort((a, b) => a.ctr - b.ctr)

    if (paretoItems.length < 2) return ''
    return paretoItems
      .map((item, idx) => {
        const x = scaleX(item.ctr)
        const y = scaleY(item.credibility)
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [candidates])

  const activeCandidate = useMemo(() => {
    const targetId = hoveredId ?? selectedId
    return candidates.find((c) => c.id === targetId)
  }, [candidates, hoveredId, selectedId])

  // 按 ESC 关闭放大弹窗
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsZoomed(false)
    }
    if (isZoomed) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isZoomed])

  // 渲染内部 SVG 核心内容
  const renderSvgContent = (customWidth = width, customHeight = height) => {
    return (
      <svg
        viewBox={`0 0 ${customWidth} ${customHeight}`}
        className="h-auto w-full select-none"
      >
        <defs>
          <linearGradient id="betterZoneGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.14" />
          </linearGradient>
          <filter id="shadowGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* 右上角高亮背景区（更好 ↗） */}
        <rect
          x={scaleX(8)}
          y={scaleY(100)}
          width={innerWidth - (scaleX(8) - padding.left)}
          height={scaleY(60) - scaleY(100)}
          fill="url(#betterZoneGradient)"
          rx="8"
        />
        <text
          x={customWidth - padding.right - 10}
          y={padding.top + 22}
          textAnchor="end"
          className="text-xs font-semibold fill-orange-500"
          style={{ fontSize: '12px' }}
        >
          {t('titlesBetterZone')}
        </text>

        {/* Y 轴刻度 (40, 60, 80, 100) */}
        {[40, 60, 80, 100].map((val) => {
          const y = scaleY(val)
          return (
            <g key={`y-${val}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={customWidth - padding.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeDasharray={val === 40 ? 'none' : '3 3'}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
                style={{ fontSize: '11px' }}
              >
                {val}
              </text>
            </g>
          )
        })}

        {/* X 轴刻度 (4%, 6%, 8%, 10%, 12%) */}
        {[4, 6, 8, 10, 12].map((val) => {
          const x = scaleX(val)
          return (
            <g key={`x-${val}`}>
              <line
                x1={x}
                y1={padding.top}
                x2={x}
                y2={customHeight - padding.bottom}
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeDasharray={val === 4 ? 'none' : '3 3'}
              />
              <text
                x={x}
                y={customHeight - padding.bottom + 18}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
                style={{ fontSize: '11px' }}
              >
                {val}%
              </text>
            </g>
          )
        })}

        {/* 坐标轴标签 */}
        <text
          x={padding.left}
          y={padding.top - 12}
          className="fill-muted-foreground text-[11px] font-medium"
          style={{ fontSize: '11px' }}
        >
          {t('titlesYAxisLabel')}
        </text>
        <text
          x={customWidth / 2}
          y={customHeight - 12}
          textAnchor="middle"
          className="fill-muted-foreground text-[11px] font-medium"
          style={{ fontSize: '11px' }}
        >
          {t('titlesXAxisLabel')}
        </text>

        {/* 轨迹线 */}
        {candidates.map((c) => {
          if (!c.rounds || c.rounds.length < 2) return null
          const r1 = c.rounds[0]
          const r2 = c.rounds[1]
          const r3 = c.rounds[2] || r2

          const p1 = { x: scaleX(r1.ctr), y: scaleY(r1.credibility) }
          const p2 = { x: scaleX(r2.ctr), y: scaleY(r2.credibility) }
          const p3 = { x: scaleX(r3.ctr), y: scaleY(r3.credibility) }

          const isFocus = selectedId === c.id || hoveredId === c.id

          return (
            <g key={`path-${c.id}`}>
              <path
                d={`M ${p1.x} ${p1.y} Q ${(p1.x + p2.x) / 2} ${p2.y} ${p2.x} ${p2.y} T ${p3.x} ${p3.y}`}
                fill="none"
                stroke={isFocus ? '#f97316' : '#94a3b8'}
                strokeWidth={isFocus ? 2.2 : 1.2}
                strokeDasharray="3 3"
                strokeOpacity={isFocus ? 0.9 : 0.45}
              />
              <circle
                cx={p1.x}
                cy={p1.y}
                r={3.5}
                fill="#cbd5e1"
                stroke="#64748b"
                strokeWidth={1}
              />
              {r1.issue && (
                <circle
                  cx={p1.x}
                  cy={p1.y}
                  r={6.5}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              )}
              <circle
                cx={p2.x}
                cy={p2.y}
                r={3.5}
                fill="#cbd5e1"
                stroke="#64748b"
                strokeWidth={1}
              />
            </g>
          )
        })}

        {/* Pareto 最优连线 */}
        {paretoPoints && (
          <path
            d={paretoPoints}
            fill="none"
            stroke="#f97316"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#shadowGlow)"
          />
        )}

        {/* 终稿点 */}
        {candidates.map((c) => {
          const cx = scaleX(c.ctr)
          const cy = scaleY(c.credibility)
          const isPareto = c.isParetoOptimal
          const isRec = c.isRecommended
          const isFocus = selectedId === c.id || hoveredId === c.id
          const pointColor = isPareto ? '#f97316' : '#14b8a6'

          return (
            <g
              key={`point-${c.id}`}
              className="cursor-pointer transition-transform duration-150"
              onClick={() => onSelectCandidate?.(c.id)}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {isRec && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={15}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={2.5}
                  className="dark:stroke-white animate-pulse"
                />
              )}

              {isFocus && !isRec && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={14}
                  fill="none"
                  stroke={pointColor}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                />
              )}

              <circle
                cx={cx}
                cy={cy}
                r={isRec ? 10.5 : 9}
                fill={pointColor}
                stroke="#ffffff"
                strokeWidth={2}
                filter="url(#shadowGlow)"
              />

              <text
                x={cx}
                y={cy + 3.5}
                textAnchor="middle"
                fill="#ffffff"
                className="font-bold select-none text-[10px]"
                style={{ fontSize: '10px' }}
              >
                {c.id}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
      {/* 头部标题与放大查看按钮 */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-foreground">{t('titlesEvolutionChartTitle')}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('titlesEvolutionChartSubtitle')}
          </p>
          {metricItems?.length ? (
            <div className="mt-3 -mx-1 overflow-x-auto">
              <AgentMetrics label="本方案指标" items={metricItems} />
            </div>
          ) : null}
        </div>

        {/* 纯 SVG 图标按钮放大查看 */}
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          title={t('titlesChartZoomTitle')}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* 图例 */}
      <div className="mb-2 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#14b8a6]" />
          <span className="text-muted-foreground text-[11px]">{t('titlesCandidatePoint')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f97316]" />
          <span className="text-muted-foreground text-[11px]">{t('titlesParetoPoint')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-red-500 bg-transparent" />
          <span className="text-muted-foreground text-[11px]">{t('titlesIssuePoint')}</span>
        </div>
      </div>

      {/* 常规 SVG 画布 */}
      <div
        className="group relative w-full overflow-hidden rounded-lg cursor-pointer"
        onClick={() => setIsZoomed(true)}
      >
        {renderSvgContent()}

        {/* 鼠标移入时提示放大图标 */}
        <div className="absolute right-2 top-2 rounded-md bg-background/70 p-1 text-muted-foreground opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
          <ZoomIn className="h-4 w-4" />
        </div>
      </div>

      {/* 悬停/选中卡片提示 */}
      {activeCandidate && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
          <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {activeCandidate.id}
            </span>
            <span className="font-semibold text-foreground truncate" title={activeCandidate.title}>
              {activeCandidate.title}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span className="whitespace-nowrap">{t('titlesCtrLabel')}: <strong className="text-foreground">{activeCandidate.ctr}%</strong></span>
            <span className="whitespace-nowrap">{t('titlesCredLabel')}: <strong className="text-foreground">{activeCandidate.credibility}</strong></span>
            <span className="whitespace-nowrap">{t('titlesScoreLabel')}: <strong className="text-orange-600 dark:text-orange-400 font-bold">{activeCandidate.score}</strong></span>
            {activeCandidate.isRecommended && (
              <span className="whitespace-nowrap rounded bg-orange-500/10 px-1.5 py-0.5 font-bold text-orange-600 dark:text-orange-400">
                {t('titlesRecommendedBadge')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 弹窗放大模态框（轻柔毛玻璃模糊，不变暗） */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 dark:bg-black/25 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">{t('titlesChartZoomTitle')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('titlesChartZoomDesc')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 大尺寸 SVG 画布 */}
            <div className="w-full flex-1 overflow-hidden">
              {renderSvgContent(800, 480)}
            </div>

            {/* 弹窗底部方案明细 */}
            {activeCandidate && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-3 text-xs">
                <div className="flex min-w-0 flex-1 basis-64 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs">
                    {activeCandidate.id}
                  </span>
                  <span className="font-semibold text-foreground text-sm truncate" title={activeCandidate.title}>
                    {activeCandidate.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                  <span className="whitespace-nowrap">句式：<strong>{activeCandidate.formulaName}</strong> ({activeCandidate.sourceTag})</span>
                  <span className="whitespace-nowrap">{t('titlesCtrLabel')}：<strong>{activeCandidate.ctr}%</strong></span>
                  <span className="whitespace-nowrap">{t('titlesCredLabel')}：<strong>{activeCandidate.credibility}</strong></span>
                  <span className="whitespace-nowrap text-orange-600 dark:text-orange-400 font-bold text-sm">
                    {t('titlesScoreLabel')}：{activeCandidate.score}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
