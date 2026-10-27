/**
 * 脚本任务的标题与文案推导（页面与 executor 共用，避免两处漂移）。
 */
import type { ScriptConfig } from './types'

export function scriptTaskTitle(config: ScriptConfig): string {
  const product = config.product?.trim() || '未命名产品'
  return config.mode === 'live' ? `${product} · 直播脚本` : `${product} · 视频脚本`
}

export function scriptRouteOf(mode: ScriptConfig['mode']): string {
  return mode === 'live' ? '/workbench/live-script' : '/workbench/video-script'
}
