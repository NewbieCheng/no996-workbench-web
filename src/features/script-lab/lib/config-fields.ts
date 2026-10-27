import type { ScriptConfig } from '../agent/types'

/** 选填项计数（预览轨「已补充 N/8 项」） */
export function countFilledOptionalFields(config: ScriptConfig): { filled: number; total: number } {
  const isVideo = config.mode === 'video'
  const checks = [
    Boolean(config.intro?.trim()),
    Boolean(config.audience?.trim()),
    Boolean(config.sellingPoints?.trim()),
    Boolean(config.pain?.trim()),
    config.strength !== 50,
    Boolean(config.mustWords?.length),
    Boolean(config.bannedWords?.length),
    Boolean(config.refGood?.trim()),
    Boolean(config.refCompetitor?.trim()),
    !isVideo && Boolean(config.offer?.trim()),
    !isVideo && (config.interactionNodes ?? 3) !== 3,
  ]
  const relevant = isVideo ? checks.slice(0, 8) : checks
  const filled = relevant.filter(Boolean).length
  return { filled, total: relevant.length }
}
