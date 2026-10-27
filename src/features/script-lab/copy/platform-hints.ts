import type { ScriptMode } from '../agent/types'

export const VIDEO_PLATFORM_HINTS: Record<string, { tagline: string; detail: string }> = {
  抖音: { tagline: '前 3 秒留人', detail: '节奏快，建议 30-60 秒起量' },
  视频号: { tagline: '熟人转发', detail: '适合讲清一件事，建议 60-120 秒' },
  小红书: { tagline: '重体验干货', detail: '真实体验与干货，建议 60-180 秒' },
  快手: { tagline: '口语信任', detail: '接地气、信任感优先，建议 60-120 秒' },
}

export const LIVE_PLATFORM_HINTS: Record<string, { tagline: string; detail: string }> = {
  抖音: { tagline: '流量场', detail: '互动与福利节奏要密' },
  视频号: { tagline: '私域转化', detail: '适合讲清信任与复购' },
  淘宝: { tagline: '成交场', detail: '福利与库存要说清' },
  快手: { tagline: '老铁经济', detail: '人设与福利并重' },
}

export function platformHints(mode: ScriptMode): Record<string, { tagline: string; detail: string }> {
  return mode === 'video' ? VIDEO_PLATFORM_HINTS : LIVE_PLATFORM_HINTS
}
