/**
 * 结构装配与宿主锁定（纯函数）。
 *
 * 模型只负责选择既有结构、写 purpose 和 share；段数、名称、顺序、稳定 id
 * 与最终 share 归一化由宿主负责，避免 writer/reviewer/editor 使用不同版本。
 */
import type { LibraryHit, ScriptMode } from './types'

export const LIVE_FIVE_CHAPTER_NAMES = ['开场暖场', '产品介绍', '痛点共鸣', '促单环节', '复盘收尾'] as const
export const LIVE_FIVE_CHAPTER_DEFAULT_SHARES = [0.1, 0.25, 0.2, 0.3, 0.15] as const
export const MAX_LIVE_SEGMENTS = 10

export type PlannedStructureSegment = {
  id: string
  name: string
  purpose: string
  share: number
}

export type StructurePlanResult = {
  formulaId: string
  formulaName: string
  plan: PlannedStructureSegment[]
  libraryId: string
}

type RawStructureSegment = { name?: unknown; purpose?: unknown; share?: unknown }
type RawStructureOutput = { formulaId?: unknown; formulaName?: unknown; segments?: unknown }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 有限正数归一化；无有效值时按段数均分。 */
export function normalizeStructureShares(shares: number[]): number[] {
  const values = shares.map((value) => (Number.isFinite(value) && value > 0 ? value : 0))
  const sum = values.reduce((acc, value) => acc + value, 0)
  if (sum <= 0) return shares.map(() => 1 / Math.max(1, shares.length))
  return values.map((value) => value / sum)
}

/**
 * 把模型结构结果合并到宿主选定的既有结构上。
 * - 视频：保留候选结构的段数、名称与顺序，只接受模型写的 purpose/share。
 * - 直播：默认固定五章，也支持模板和自定义章节；章名、数量和顺序由宿主锁定。
 */
export function buildStructurePlan(input: {
  mode: ScriptMode
  hits: LibraryHit[]
  raw?: RawStructureOutput
  durationSec: number
}): StructurePlanResult {
  const { mode, hits, raw } = input
  if (!hits.length) throw new Error('结构库没有返回可用结构，请重试。')

  const requested = text(raw?.formulaId)
  const selected = hits.find((hit) => hit.id === requested) ?? hits[0]
  const rawSegments = Array.isArray(raw?.segments) ? (raw!.segments as RawStructureSegment[]) : []
  if (mode === 'live') {
    const base = selected
    if (base.segments.length < 2 || base.segments.length > MAX_LIVE_SEGMENTS) {
      throw new Error('直播结构必须包含 2-10 个章节，请重试。')
    }
    const names = base.segments.map((segment) => segment.name.trim())
    if (names.some((name) => !name) || new Set(names).size !== names.length) {
      throw new Error('直播章节名称不能为空或重复，请重试。')
    }
    const plan = base.segments.map((segment, index) => {
      const item = rawSegments[index]
      const fallback = base.segments[index]
      const shareRaw = Number(item?.share)
      const isDefaultFive = base.id === 'live-five-chapter'
      return {
        id: 'seg-' + (index + 1),
        name: isDefaultFive ? (LIVE_FIVE_CHAPTER_NAMES[index] ?? segment.name) : segment.name,
        purpose: text(item?.purpose) || fallback?.purpose || '完成本章职责并照顾流动观众',
        share: Number.isFinite(shareRaw) && shareRaw > 0
          ? shareRaw
          : (fallback?.share ?? LIVE_FIVE_CHAPTER_DEFAULT_SHARES[index] ?? 1 / base.segments.length),
      }
    })
    const shares = normalizeStructureShares(plan.map((segment) => segment.share))
    return {
      formulaId: base.id,
      formulaName: base.formulaName,
      plan: plan.map((segment, index) => ({ ...segment, share: shares[index] })),
      libraryId: base.id,
    }
  }
  const plan = selected.segments.map((segment, index) => {
    const item = rawSegments[index]
    const shareRaw = Number(item?.share)
    return {
      id: `seg-${index + 1}`,
      name: segment.name,
      purpose: text(item?.purpose) || segment.purpose,
      share: Number.isFinite(shareRaw) && shareRaw > 0 ? shareRaw : segment.share,
    }
  })
  const shares = normalizeStructureShares(plan.map((segment) => segment.share))
  return {
    formulaId: selected.id,
    formulaName: selected.formulaName,
    plan: plan.map((segment, index) => ({ ...segment, share: shares[index] })),
    libraryId: selected.id,
  }
}

/** 长直播先按章生成：避免单次返回被截断后用循环话术冒充完整稿。 */
export const LIVE_SPEAKING_CHARS_PER_SEC = 4
export const LIVE_SINGLE_CALL_CHAR_LIMIT = 6000

export function liveTargetChars(durationSec: number): number {
  return Math.max(1, Math.round(Math.max(1, durationSec) * LIVE_SPEAKING_CHARS_PER_SEC))
}

export function shouldGenerateLiveByChapter(durationSec: number): boolean {
  return liveTargetChars(durationSec) > LIVE_SINGLE_CALL_CHAR_LIMIT
}

export function structureCharBudget(segment: { share: number }, totalChars: number): number {
  return Math.max(1, Math.round(segment.share * Math.max(1, totalChars)))
}

/** 装配给 writer 的 structure 文本；id、占比与预算均来自宿主。 */
export function formatStructureForWriter(
  plan: PlannedStructureSegment[],
  totalChars: number,
): string {
  return plan
    .map((segment, index) =>
      `- id: ${segment.id}｜第 ${index + 1} 段｜${segment.name}｜目的：${segment.purpose}｜占比 ${Math.round(segment.share * 100)}%｜口播预算约 ${structureCharBudget(segment, totalChars)} 字`,
    )
    .join('\n')
}

/** 校验模型返回的分段 id 与宿主结构完全一致；不一致直接走既有失败/重试。 */
export function assertExpectedSegmentIds(rawSegments: unknown, expectedIds: string[]): void {
  if (!Array.isArray(rawSegments) || rawSegments.length !== expectedIds.length) {
    throw new Error('模型返回的分段数量与宿主锁定的结构不一致，请重试。')
  }
  const ids = rawSegments.map((item) => text((item as { id?: unknown })?.id))
  if (new Set(ids).size !== ids.length) throw new Error('模型返回了重复的分段 id，请重试。')
  if (ids.some((id, index) => id !== expectedIds[index])) {
    throw new Error('模型返回的分段 id 或顺序与宿主锁定的结构不一致，请重试。')
  }
}
