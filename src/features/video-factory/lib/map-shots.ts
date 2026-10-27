/**
 * 文案 → 镜头映射（确定性规则，不调模型）
 *
 * 决策 D2：不做「AI 挑镜头」。用户给的文稿按位置与内容特征映射到固定镜头池，
 * 同一份文稿永远得到同一组镜头 —— 可复现、可解释、可预测。
 *
 * 映射策略：
 *   - 首段 → 开场池（品牌 / 标题出场）
 *   - 末段 → 收尾池（logo / 结束卡）
 *   - 中间段按「段内特征」轮转：
 *       含数字 / 百分比 → 数据池
 *       含问句 / 呼告     → 强调池
 *       其余              → 版式池与界面池轮转
 *   - 相邻两段之间插入一个转场镜头（可选）
 */

import { SHOT_CATALOG, type ShotDefinition } from '@no996/video-editor'
import type { ScriptSegment } from './segment-script.ts'

export type MappedBeat = {
  segment: ScriptSegment
  shot: ShotDefinition
  /** 该镜头在时间轴上的时长；与段落的建议时长取较大者，保证不截断动效 */
  durationUs: number
  /** 这次映射的可解释理由（UI 会显示） */
  reason: string
  /** 镜头参数覆盖（主标题、高亮词、副标、数值等） */
  overrides?: Record<string, string>
}

/**
 * 固定镜头池。id 都经过存在性校验：注册表里没有就跳过，绝不静默用错镜头。
 */
const POOLS = {
  opening: ['opening/spotlight-hero-card', 'opening/letterspace-materialize', 'opening/orbit-ring-title-open'],
  typography: [
    'typography/marker-underline-title',
    'typography/gradient-word-sweep',
    'typography/lead-word-zoom-assemble',
    'typography/word-relay-geometry',
  ],
  data: ['data/chart-live-moves~AxisRescaleShockV2', 'data/gauge-readout-moves~TapeScrollFixedPointer'],
  emphasis: ['effects/impact-feedback~AnimeImpact', 'effects/slam-entrance-moves~KanadaPerspectiveSnap'],
  ui: [
    'ui-entrance/card-stack',
    'ui-entrance/list-reveal',
    'ui-entrance/value-stagger-gradient',
    'ui-entrance/product-card-progressive-assemble',
  ],
  outro: ['outro/grain-dissolve', 'outro/logo-shrink-wordmark-lockup', 'outro/ui-strip-away-outro'],
} as const

const HAS_NUMBER = /\d|百分之|倍|万|亿|%/
const HAS_QUESTION = /[？?]|吗|如何|为什么|怎么/

/** 按 id 取镜头，缺失即跳过（保持规则可解释，不猜替代品）。 */
function pick(poolId: keyof typeof POOLS): ShotDefinition[] {
  return POOLS[poolId]
    .map((shotId) => SHOT_CATALOG.find((shot) => shot.shotId === shotId))
    .filter((shot): shot is ShotDefinition => Boolean(shot))
}

export type MapOptions = {
  /** 是否在段落之间插入转场镜头 */
  transitions?: boolean
  /** 每个镜头的最短展示时长（微秒） */
  minDurationUs?: number
}

export function mapSegmentsToShots(
  segments: ScriptSegment[],
  options: MapOptions = {},
): MappedBeat[] {
  const { transitions = false, minDurationUs = 1_200_000 } = options
  if (!segments.length) return []

  const openingPool = pick('opening')
  const typographyPool = pick('typography')
  const dataPool = pick('data')
  const emphasisPool = pick('emphasis')
  const uiPool = pick('ui')
  const outroPool = pick('outro')
  const transitionPool = pick('ui').slice(0, 0) // 转场池留空时自动跳过

  const beats: MappedBeat[] = []
  let rotation = 0

  for (const segment of segments) {
    const isFirst = segment.index === 0
    const isLast = segment.index === segments.length - 1

    let shot: ShotDefinition | undefined
    let reason = ''

    if (isFirst && openingPool.length) {
      shot = openingPool[0]
      reason = '首段用开场动效立住标题'
    } else if (isLast && outroPool.length) {
      shot = outroPool[segment.index % outroPool.length]
      reason = '末段用收尾动效定格'
    } else if (HAS_NUMBER.test(segment.text) && dataPool.length) {
      shot = dataPool[rotation % dataPool.length]
      reason = '段内出现数字，用数据动效'
    } else if (HAS_QUESTION.test(segment.text) && emphasisPool.length) {
      shot = emphasisPool[rotation % emphasisPool.length]
      reason = '段内是提问，用强调动效'
    } else if (rotation % 2 === 0 && typographyPool.length) {
      shot = typographyPool[rotation % typographyPool.length]
      reason = '常规叙述，用版式动效'
    } else if (uiPool.length) {
      shot = uiPool[rotation % uiPool.length]
      reason = '常规叙述，用界面动效'
    } else if (typographyPool.length) {
      shot = typographyPool[rotation % typographyPool.length]
      reason = '常规叙述，用版式动效'
    }

    if (!shot) continue
    rotation++

    // 镜头时长 = max(建议时长, 镜头原始时长 * 0.7, 下限)
    const sourceUs = (shot.durationInFrames / 30) * 1_000_000
    const durationUs = Math.round(Math.max(segment.suggestedDurationUs, sourceUs * 0.7, minDurationUs))
    beats.push({ segment, shot, durationUs, reason })

    if (transitions && !isLast && transitionPool.length) {
      const transition = transitionPool[segment.index % transitionPool.length]
      beats.push({
        segment: { index: segment.index, text: '', suggestedDurationUs: 400_000 },
        shot: transition,
        durationUs: Math.round((transition.durationInFrames / 30) * 1_000_000),
        reason: '段落间的过渡镜头',
      })
    }
  }

  return beats
}

/** 供 UI 展示：本次映射用到的镜头统计。 */
export function mappingSummary(beats: MappedBeat[]): { totalUs: number; shotCount: number } {
  return {
    totalUs: beats.reduce((sum, beat) => sum + beat.durationUs, 0),
    shotCount: beats.length,
  }
}
