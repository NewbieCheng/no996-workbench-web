/**
 * SRT 字幕导入与导出模块（保留微秒精度，实现往返无损 Roundtrip）
 */

import type { CaptionCue } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'

/**
 * 将微秒时间转换为 SRT 标准时间戳 (00:00:01,234)
 */
export function timeUsToSrtTimestamp(timeUs: TimeUs): string {
  const safeUs = Math.max(0, timeUs)
  const totalMs = Math.round(safeUs / 1000)
  const ms = totalMs % 1000
  const totalSeconds = Math.floor(totalMs / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(ms, 3)}`
}

/**
 * 解析 SRT 时间戳为微秒 (00:00:01,234 -> 1_234_000)
 */
export function srtTimestampToTimeUs(timestamp: string): TimeUs {
  const parts = timestamp.trim().replace('.', ',').split(/[:,]/)
  if (parts.length !== 4) return 0

  const hours = parseInt(parts[0], 10) || 0
  const minutes = parseInt(parts[1], 10) || 0
  const seconds = parseInt(parts[2], 10) || 0
  const milliseconds = parseInt(parts[3], 10) || 0

  return (hours * 3600 + minutes * 60 + seconds) * 1_000_000 + milliseconds * 1000
}

/**
 * 解析标准 SRT 文本内容为 CaptionCue 数组
 */
export function parseSrt(srtContent: string): CaptionCue[] {
  if (!srtContent || srtContent.trim().length === 0) return []

  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.trim().split(/\n\s*\n/)
  const cues: CaptionCue[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    // 寻找包含 --> 的行
    let timeLineIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i
        break
      }
    }

    if (timeLineIndex === -1) continue

    const timeLine = lines[timeLineIndex]
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim())
    const startUs = srtTimestampToTimeUs(startStr)
    const endUs = srtTimestampToTimeUs(endStr)
    const durationUs = Math.max(1000, endUs - startUs)

    const textLines = lines.slice(timeLineIndex + 1)
    const text = textLines.join('\n').trim()

    cues.push({
      id: `cue-${cues.length + 1}-${crypto.randomUUID()}`,
      startUs,
      durationUs,
      text,
      timingSource: 'srt',
    })
  }

  return cues
}

/**
 * 将 CaptionCue 数组导出为标准 SRT 字符串
 */
export function exportSrt(cues: CaptionCue[]): string {
  if (cues.length === 0) return ''

  const sorted = [...cues].sort((a, b) => a.startUs - b.startUs)

  return sorted
    .map((cue, index) => {
      const startStr = timeUsToSrtTimestamp(cue.startUs)
      const endStr = timeUsToSrtTimestamp(cue.startUs + cue.durationUs)
      return `${index + 1}\n${startStr} --> ${endStr}\n${cue.text}`
    })
    .join('\n\n')
}
