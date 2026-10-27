import i18next from 'i18next'
import { tools, type ToolId } from '../../prompts/text-tools'
import type { WorkbenchTaskKind, WorkbenchTaskRecord } from './types'

// 保留三个旧 toolId：已入队的历史任务仍需要正确显示功能名
const TEXT_TOOL_IDS = new Set<string>(['titles', 'video-script', 'live-script'])

export function textToolTitle(toolId: string): string | undefined {
  if (!TEXT_TOOL_IDS.has(toolId)) return undefined
  return tools[toolId as ToolId]?.title
}

/** 任务中心与各页历史列表用的功能名称 */
export function taskModuleLabel(task: Pick<WorkbenchTaskRecord, 'kind' | 'meta'>): string {
  if (task.kind === 'digital_human_retalk') return '数字人口播'
  if (task.kind === 'ip_video_create') return i18next.language?.startsWith('en') ? 'IP video creation' : 'IP 视频创作'
  if (task.kind === 'ip_video_audio') return 'IP 口播视频'
  if (task.kind === 'video_factory_export') return '视频导出'
  if (task.kind === 'voice_tts') return '声音配音'
  if (task.kind === 'voice_clone') return '声音克隆'
  if (task.kind === 'voice_dub_advanced') return '高阶配音'
  if (task.kind === 'persona_generate') return '人设定位'
  if (task.kind === 'titles_generate') return '爆款标题'
  if (task.kind === 'moments_plan') return i18next.language?.startsWith('en') ? 'Moments plan' : '朋友圈排期'
  if (task.kind === 'moments_copy') {
    return task.meta?.runKind === 'rewrite'
      ? i18next.language?.startsWith('en')
        ? 'Moments rewrite'
        : '朋友圈重写'
      : i18next.language?.startsWith('en')
        ? 'Moments copy'
        : '朋友圈文案'
  }
  if (task.kind === 'script_generate') return task.meta?.mode === 'live' ? '直播脚本' : '视频脚本'
  if (task.kind === 'text_sections') {
    const fromMeta = task.meta?.toolId ? textToolTitle(task.meta.toolId) : undefined
    return fromMeta ?? '文案生成'
  }
  return task.kind
}

export function taskSuccessToast(kind: WorkbenchTaskKind, title: string, meta?: Record<string, string>): string {
  const short = title.length > 24 ? `${title.slice(0, 24)}…` : title
  switch (kind) {
    case 'ip_video_create':
      return i18next.language?.startsWith('en') ? `IP video plan is ready: ${short}` : `IP 视频方案已生成，请打开查看：${short}`
    case 'ip_video_audio':
      return `IP 口播配音已完成：${short}`
    case 'voice_tts':
      return `配音已完成：${short}`
    case 'voice_clone': {
      const name = meta?.display_name?.trim() || short.replace(/^声音克隆 ·\s*/, '')
      if (meta?.ready === '1') {
        return `音色「${name}」已创建，可以开始配音`
      }
      const pts =
        meta?.points_charged && meta.points_charged !== '0'
          ? `，已扣 ${Number(meta.points_charged).toLocaleString('zh-CN')} 积分`
          : ''
      return `音色「${name}」已提交审核${pts}`
    }
    case 'voice_dub_advanced':
      return meta?.awaiting_confirm === '1' ? `分段方案已就绪：${short}` : `高阶配音已完成：${short}`
    case 'persona_generate':
      return `人设生成已完成：${short}`
    case 'moments_plan':
      return i18next.language?.startsWith('en') ? `Moments plan is ready: ${short}` : `朋友圈排期已完成：${short}`
    case 'moments_copy':
      return i18next.language?.startsWith('en') ? `Moments copy is ready: ${short}` : `朋友圈文案已完成：${short}`
    case 'titles_generate': {
      if (meta?.fallback === '1') return `标题已生成（部分步骤降级）：${short}`
      const score = meta?.score ? `，最高 ${meta.score} 分` : ''
      const pareto = meta?.pareto && meta.pareto !== '0' ? `，Pareto ${meta.pareto} 条` : ''
      return `爆款标题已完成${score}${pareto}：${short}`
    }
    case 'script_generate': {
      if (meta?.fallback === '1') return `脚本已生成（部分步骤降级）：${short}`
      const retention = meta?.retention ? `，预估留存 ${meta.retention}%` : ''
      return `${meta?.mode === 'live' ? '直播' : '视频'}脚本已完成${retention}：${short}`
    }
    case 'text_sections': {
      const label = meta?.toolId ? textToolTitle(meta.toolId) : undefined
      return label ? `${label}已完成：${short}` : `文案生成已完成：${short}`
    }
    case 'source_create':
      return `创作已完成：${short}`
    case 'video_factory_export': {
      const res = meta?.resolution === '1080p' ? '1080P' : '720P'
      return `视频导出已完成（${res}）：${short}`
    }
    default:
      return '后台任务已完成'
  }
}

export const QUEUED_FEATURE_HINT =
  '人设定位、爆款标题、视频脚本、直播脚本、朋友圈运营、声音配音（演示页与待接入能力不入队）'
