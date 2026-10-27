import { useEffect, useMemo, useRef, useState } from 'react'
import type { ScriptRound } from '../../features/script-lab/agent/types'
import { findDrops } from '../../features/script-lab/agent/finalize'
import type { ScriptSegment } from '../../features/script-lab/agent/types'

/**
 * 留存曲线：把评审给出的「逐段预估留存」画成曲线。
 *
 * 诚实性要求：
 * - 起点恒为 100（由 retention.normalizeRetentionPoints 保证）
 * - 单调不增，不会出现「越讲人越多」
 * - 图上明确标注「预估」，不宣称真实播放数据
 *
 * 曲线用 Catmull-Rom 转三次贝塞尔手写生成，不引入图表依赖。
 */

const VIEW_W = 640
const VIEW_H = 240
/** 为掉点标注留出顶部空间，避免 y 贴近 0 时被 viewBox 裁切 */
const VIEW_TOP_OVERFLOW = 16
const PAD = { top: 22, right: 20, bottom: 30, left: 34 }
const DROP_LABEL_GAP = 14
const DROP_LABEL_MIN_Y = 10

function dropLabelY(pointY: number): number {
  const above = pointY - DROP_LABEL_GAP
  if (above >= DROP_LABEL_MIN_Y) return above
  return pointY + DROP_LABEL_GAP
}

type Point = { x: number; y: number }

function toPoints(values: number[]): Point[] {
  const series = [100, ...values]
  const innerW = VIEW_W - PAD.left - PAD.right
  const innerH = VIEW_H - PAD.top - PAD.bottom
  return series.map((v, i) => ({
    x: PAD.left + (series.length === 1 ? 0 : (i / (series.length - 1)) * innerW),
    y: PAD.top + (1 - Math.max(0, Math.min(100, v)) / 100) * innerH,
  }))
}

/** Catmull-Rom → 三次贝塞尔，得到平滑且不过冲的曲线 */
function smoothPath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

export type RetentionCurveProps = {
  rounds: ScriptRound[]
  segments: ScriptSegment[]
}

export function RetentionCurve({ rounds, segments }: RetentionCurveProps) {
  const [drawn, setDrawn] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // 双 rAF 触发 CSS 生长动画；减少动效时直接显示
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setDrawn(true)
      return
    }
    let id2 = 0
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setDrawn(true))
    })
    return () => {
      cancelAnimationFrame(id1)
      if (id2) cancelAnimationFrame(id2)
    }
  }, [rounds.length])

  // 只画首轮与末轮，中间轮次作为背景参考
  const primary = rounds[rounds.length - 1]
  const baseline = rounds[0]
  const primaryPoints = useMemo(
    () => (primary ? toPoints(primary.retentionPoints) : []),
    [primary],
  )
  const baselinePoints = useMemo(
    () => (baseline && rounds.length > 1 ? toPoints(baseline.retentionPoints) : []),
    [baseline, rounds.length],
  )

  if (!primary || !primaryPoints.length) return null

  const drops = findDrops(primary.retentionPoints)
  const gridLines = [100, 75, 50, 25, 0]
  const labelFor = (index: number) => segments[index]?.name ?? `第 ${index + 1} 段`

  return (
    <div className="retention-curve" ref={rootRef}>
      <div className="retention-curve__head">
        <h3>预估留存曲线</h3>
        <p>
          由独立评审逐段预测，起点 100%，单调不增。数据为创作参考，不代表真实播放数据。
        </p>
      </div>
      <svg
        className="retention-curve__svg"
        viewBox={`0 ${-VIEW_TOP_OVERFLOW} ${VIEW_W} ${VIEW_H + VIEW_TOP_OVERFLOW}`}
        role="img"
        aria-label={`预估留存曲线，末段留存 ${primary.retentionPoints.at(-1) ?? 0}%`}
      >
        <defs>
          <linearGradient id="rc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sl-acc, #ff6400)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--sl-acc, #ff6400)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 交替分段背景带：让每一段的可视范围可读 */}
        {primaryPoints.slice(0, -1).map((p, i) => {
          const next = primaryPoints[i + 1]
          if (i % 2 === 1) return null
          return (
            <rect
              key={`band-${i}`}
              x={p.x}
              y={PAD.top}
              width={Math.max(0, next.x - p.x)}
              height={VIEW_H - PAD.top - PAD.bottom}
              className="retention-curve__band"
            />
          )
        })}

        {gridLines.map((v) => {
          const y = PAD.top + (1 - v / 100) * (VIEW_H - PAD.top - PAD.bottom)
          return (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={VIEW_W - PAD.right}
                y1={y}
                y2={y}
                className="retention-curve__grid"
              />
              <text x={PAD.left - 8} y={y + 4} className="retention-curve__axis" textAnchor="end">
                {v}
              </text>
            </g>
          )
        })}

        {/* 首轮作为对比基线 */}
        {baselinePoints.length ? (
          <path className="retention-curve__path retention-curve__path--baseline" d={smoothPath(baselinePoints)} />
        ) : null}

        <path
          className="retention-curve__area"
          d={`${smoothPath(primaryPoints)} L ${primaryPoints.at(-1)?.x} ${VIEW_H - PAD.bottom} L ${primaryPoints[0].x} ${VIEW_H - PAD.bottom} Z`}
          style={{ opacity: drawn ? 1 : 0 }}
        />
        <path
          className="retention-curve__path"
          d={smoothPath(primaryPoints)}
          pathLength={1}
          style={{ strokeDashoffset: drawn ? 0 : 1 }}
        />

        {primaryPoints.map((p, i) => (
          <circle key={`dot-${i}`} className="retention-curve__dot" cx={p.x} cy={p.y} r={3} />
        ))}

        {/* 掉线 ≥12 点标红 */}
        {drops.map(({ index, drop }) => {
          const p = primaryPoints[index]
          if (!p) return null
          return (
            <g key={`drop-${index}`}>
              <circle className="retention-curve__drop" cx={p.x} cy={p.y} r={6} />
              <text
                x={p.x}
                y={dropLabelY(p.y)}
                className="retention-curve__drop-label"
                textAnchor="middle"
                dominantBaseline="auto"
              >
                -{Math.round(drop)}
              </text>
            </g>
          )
        })}

        {primaryPoints.map((p, i) => (
          <text key={`label-${i}`} x={p.x} y={VIEW_H - PAD.bottom + 16} className="retention-curve__seg" textAnchor="middle">
            {labelFor(i).slice(0, 6)}
          </text>
        ))}
      </svg>

      <ul className="retention-curve__legend">
        <li>
          <span className="retention-curve__swatch retention-curve__swatch--final" />
          终稿（第 {primary.round} 轮）
        </li>
        {rounds.length > 1 ? (
          <li>
            <span className="retention-curve__swatch retention-curve__swatch--first" />
            初稿（第 1 轮）
          </li>
        ) : null}
      </ul>
    </div>
  )
}

export default RetentionCurve
