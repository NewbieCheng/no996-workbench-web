/**
 * 脚本引擎 · 定稿（纯算法）
 *
 * 负责：时间码拼接、字数勾稽、提词稿文本、合规汇总。
 * 不含任何模型调用 —— 与阶段声明里的 kind: 'algo' 一致。
 */
// 直接用带扩展名的子路径引入：与 queue-logic.ts 同一约定，
// 便于 node --test（--experimental-strip-types）在不打包的情况下直接加载本模块。
import { runHardCheck, type HardCheckResult } from '../../../agent/hard-check.ts'
import type {
  ScriptConfig,
  ScriptReview,
  ScriptSegment,
  ScriptRound,
  ScriptGoal,
} from './types.ts'
import { videoTargetChars } from './types.ts'
import { normalizeRetentionPoints } from './retention.ts'

/** 把占比转换为每段的 [startSec, endSec)，并保证最后一段正好收在总时长上 */
export function assignTimecodes(
  segments: Array<{ share: number }>,
  durationSec: number,
): Array<{ startSec: number; endSec: number; share: number }> {
  const total = Math.max(1, Math.round(durationSec))
  // 归一化占比，避免模型给的份额之和不是 1
  const sum = segments.reduce((acc, s) => acc + (Number.isFinite(s.share) ? Math.max(0, s.share) : 0), 0)
  const normalized = sum > 0 ? segments.map((s) => Math.max(0, s.share) / sum) : segments.map(() => 1 / segments.length)

  const out: Array<{ startSec: number; endSec: number; share: number }> = []
  let cursor = 0
  normalized.forEach((share, index) => {
    const isLast = index === normalized.length - 1
    const end = isLast ? total : Math.round(cursor + share * total)
    out.push({ startSec: cursor, endSec: Math.max(cursor, end), share })
    cursor = end
  })
  return out
}

/** mm:ss */
export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/** 复制提词稿用的文本格式（对齐参考规格 2.5） */
export function buildTeleprompterText(
  segments: ScriptSegment[],
  spokenOf: (seg: ScriptSegment) => string,
  visLabel: string,
  visualOf: (seg: ScriptSegment) => string,
): string {
  return segments
    .map((seg) => {
      const head = `【${formatTimecode(seg.startSec)} ${seg.name}】`
      const visual = visualOf(seg)
      return `${head}\n${spokenOf(seg)}\n（${visLabel}：${visual}）`
    })
    .join('\n\n')
}

/** 每段字数预算（按占比分摊目标字数） */
export function segmentCharBudgets(
  segments: ScriptSegment[],
  targetChars: number,
): Array<{ id: string; budget: number }> {
  return segments.map((s) => ({ id: s.id, budget: Math.max(1, Math.round(s.share * targetChars)) }))
}

export type FinalizeInput = {
  config: ScriptConfig
  segments: ScriptSegment[]
  spokenOf: (seg: ScriptSegment) => string
  /** 用户提供的信息 + 检索结果，作为数字可追溯来源 */
  allowedNumberSources: string
}

export type FinalizeResult = {
  segments: ScriptSegment[]
  hardCheck: HardCheckResult
  targetChars?: number
}

/** 定稿：补齐时间码并做最终合规检查 */
export function finalizeScript(input: FinalizeInput): FinalizeResult {
  const { config } = input
  const codes = assignTimecodes(input.segments, config.durationSec)
  const segments = input.segments.map((seg, i) => ({
    ...seg,
    share: codes[i].share,
    startSec: codes[i].startSec,
    endSec: codes[i].endSec,
  }))

  const isVideo = config.mode === 'video'
  const targetChars = isVideo ? videoTargetChars(config.durationSec) : undefined
  const text = segments.map((s) => input.spokenOf(s)).join('\n')

  const hardCheck = runHardCheck({
    text,
    segments: segments.map((s) => ({ id: s.id, text: input.spokenOf(s) })),
    bannedWords: config.bannedWords,
    mustWords: config.mustWords,
    mode: config.mode,
    hasStockInfo: Boolean(config.offer?.trim()),
    targetChars,
    // 视频脚本用「口播字数」（去空白与标点）：目标是按每秒 4.17 字推的语速，
    // 标点不该占掉预算。标题那种平台硬上限仍用默认的 raw 口径。
    lengthCountMode: isVideo ? 'spoken' : 'raw',
    segmentCharBudgets: targetChars ? segmentCharBudgets(segments, targetChars) : undefined,
    allowedNumberSources: input.allowedNumberSources,
  })

  return { segments, hardCheck, targetChars }
}

/** 汇总多轮曲线：保证每轮都是单调不增序列 */
export function toRounds(
  raw: Array<{ round: number; retentionPoints: number[]; conversion: number; averageRetention: number; composite: number }>,
): ScriptRound[] {
  return raw.map((r) => ({
    ...r,
    retentionPoints: normalizeRetentionPoints(r.retentionPoints),
  }))
}

/** 掉线标记：相邻留存下降 ≥ 该值即在前一段末端标红 */
export const DROP_THRESHOLD = 12

export function findDrops(points: number[]): Array<{ index: number; drop: number }> {
  const out: Array<{ index: number; drop: number }> = []
  for (let i = 1; i < points.length; i += 1) {
    const drop = points[i - 1] - points[i]
    if (drop >= DROP_THRESHOLD) out.push({ index: i, drop })
  }
  return out
}

/** 视频：目标字数说明 */
export function targetCharsOf(goal: ScriptGoal, durationSec: number): number {
  void goal
  return videoTargetChars(durationSec)
}

/** 供 UI 展示的一行摘要 */
export function summarizeRound(rounds: ScriptRound[]): string {
  if (!rounds.length) return '暂无留存数据'
  const first = rounds[0]
  const last = rounds[rounds.length - 1]
  const delta = last.averageRetention - first.averageRetention
  const sign = delta >= 0 ? '+' : ''
  return `${last.averageRetention}%（相对初稿 ${sign}${delta}）`
}

export function reviewOfRound(review: ScriptReview | undefined): ScriptReview | undefined {
  return review
}
