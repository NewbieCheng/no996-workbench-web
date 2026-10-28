import { libraryProvider, structureCustomText } from '../agent/library.ts'
import type { ScriptConfig } from '../agent/types.ts'
import { isHookSegment, SEGMENT_WEIGHT } from '../copy/structure-segments.ts'

export type PreviewSegment = {
  name: string
  seconds: number
  highlight: boolean
  flexWeight: number
}

export function resolvePreviewSegments(config: ScriptConfig): PreviewSegment[] {
  const customStructure = structureCustomText(config)
  const hits = libraryProvider.search({
    mode: config.mode,
    goal: config.goal,
    durationSec: config.durationSec,
    // 视频：预览必须跟着用户选定的结构走，否则「预览一套、生成另一套」
    presetId: config.structure.kind === 'preset' ? config.structure.presetId : undefined,
    customStructure,
  })
  const hit = hits[0]
  if (!hit?.segments?.length) return []

  const weights = hit.segments.map((s) => {
    if (typeof s.share === 'number' && s.share > 0) return s.share
    return SEGMENT_WEIGHT[s.name] ?? 1
  })
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const total = config.durationSec

  return hit.segments.map((s, i) => {
    const w = weights[i] ?? 1
    const seconds = Math.max(1, Math.round((total * w) / weightSum))
    return {
      name: s.name,
      seconds,
      highlight: isHookSegment(s.name),
      flexWeight: w,
    }
  })
}
