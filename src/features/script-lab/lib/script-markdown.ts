/**
 * 导出 Markdown 脚本（带时间码、画面/互动提示、留存备注）。
 */
import type { ScriptConfig, ScriptRound, ScriptSegment } from '../agent/types'

function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function buildScriptMarkdown(options: {
  config: ScriptConfig
  segments: ScriptSegment[]
  spokenOf: (seg: ScriptSegment) => string
  rounds?: ScriptRound[]
  demo?: boolean
}): string {
  const { config, segments, spokenOf, rounds, demo } = options
  const isVideo = config.mode === 'video'
  const lines: string[] = []

  lines.push(`# ${config.product} · ${isVideo ? '视频脚本' : '直播脚本'}${demo ? '（演示）' : ''}`)
  lines.push('')
  lines.push(`- 目标：${config.goal}`)
  lines.push(`- 平台：${config.platform}`)
  lines.push(`- 时长：${isVideo ? `${config.durationSec} 秒` : `${Math.round(config.durationSec / 60)} 分钟`}`)
  if (config.audience?.trim()) lines.push(`- 人群：${config.audience.trim()}`)
  if (config.sellingPoints?.trim()) lines.push(`- 卖点：${config.sellingPoints.trim()}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const seg of segments) {
    lines.push(`## ${formatTimecode(seg.startSec)} – ${formatTimecode(seg.endSec)}｜${seg.name}`)
    if (seg.purpose) lines.push(`> ${seg.purpose}`)
    lines.push('')
    lines.push(spokenOf(seg))
    const aside = isVideo ? seg.visual : seg.action
    if (aside) {
      lines.push('')
      lines.push(`（${isVideo ? '画面' : '互动与动作'}：${aside}）`)
    }
    if (seg.nodes?.length) {
      lines.push('')
      lines.push(`节点：${seg.nodes.map((n) => `[${n.type}] ${n.action}`).join('；')}`)
    }
    lines.push('')
  }

  if (rounds?.length) {
    lines.push('---')
    lines.push('')
    lines.push('## 预估留存（创作参考，非真实播放数据）')
    lines.push('')
    for (const round of rounds) {
      lines.push(
        `- 第 ${round.round} 轮：平均留存 ${round.averageRetention}%，转化力 ${round.conversion}%，综合 ${round.composite}`,
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function scriptMarkdownFilename(config: ScriptConfig): string {
  const safe = (config.product || '未命名').replace(/[\\/:*?"<>|]/g, '').slice(0, 40)
  return `${safe}-${config.mode === 'live' ? '直播' : '视频'}脚本.md`
}
