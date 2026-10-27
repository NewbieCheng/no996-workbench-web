import type { ScriptGeneratePayload } from '../../script-lab/agent/types'
import type { IPVideoAudioPayload, VoiceTtsPayload, WorkbenchTaskRecord } from '../../../services/workbench-tasks'

export function listScriptImportTasks(tasks: WorkbenchTaskRecord[]): WorkbenchTaskRecord[] {
  return tasks
    .filter((task) => task.kind === 'script_generate' && task.status === 'succeeded')
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function listVoiceImportTasks(tasks: WorkbenchTaskRecord[]): WorkbenchTaskRecord[] {
  return tasks
    .filter(
      (task) =>
        (task.kind === 'voice_tts' || task.kind === 'ip_video_audio') && task.status === 'succeeded',
    )
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function scriptTextFromPayload(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const payload = raw as ScriptGeneratePayload & { text?: string }
  const fromSegments = (payload.segments ?? [])
    .map((seg) => (typeof seg.spoken === 'string' ? seg.spoken.trim() : ''))
    .filter(Boolean)
  if (fromSegments.length) return fromSegments.join('\n')
  if (typeof payload.text === 'string' && payload.text.trim()) return payload.text.trim()
  return ''
}

export function voicePreviewFromPayload(raw: unknown, fallbackTitle: string): string {
  if (!raw || typeof raw !== 'object') return fallbackTitle
  const tts = raw as VoiceTtsPayload
  const ip = raw as IPVideoAudioPayload
  const text = (tts.textPreview || tts.text || ip.text || '').trim()
  if (!text) return fallbackTitle
  return collapsePreviewText(text, 72)
}

export function voiceMetaFromPayload(
  raw: unknown,
  task: WorkbenchTaskRecord,
): { text: string; voiceLabel: string; voiceId?: string } {
  if (!raw || typeof raw !== 'object') {
    return { text: '', voiceLabel: task.title, voiceId: undefined }
  }
  const tts = raw as VoiceTtsPayload
  const ip = raw as IPVideoAudioPayload
  const text = (tts.text || ip.text || '').trim()
  const voiceLabel = tts.voiceLabel || ip.voiceLabel || task.title
  const voiceId = tts.voiceId || ip.voiceId
  return { text, voiceLabel, voiceId }
}

/** 列表行：标题一行 + 文稿预览一行（去重，避免 title 与 preview 同文叠两遍） */
export type LibraryListRowCopy = {
  title: string
  preview?: string
}

function collapsePreviewText(text: string, maxChars: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  return flat.length > maxChars ? `${flat.slice(0, maxChars)}…` : flat
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, '').slice(0, 48)
}

export function voiceListRowFromPayload(
  raw: unknown,
  task: WorkbenchTaskRecord,
): LibraryListRowCopy {
  const meta = voiceMetaFromPayload(raw, task)
  const title =
    (task.subtitle && task.subtitle.trim()) ||
    meta.voiceLabel ||
    (task.title.includes('·') ? task.title.split('·')[0]!.trim() : '') ||
    '历史配音'
  const scriptPreview = meta.text
    ? collapsePreviewText(meta.text, 96)
    : voicePreviewFromPayload(raw, '')
  // voice_tts 常把 textPreview 写进 task.title，与文稿预览重复 → 只保留一条
  if (!scriptPreview || normalizeForCompare(scriptPreview) === normalizeForCompare(title)) {
    return { title: scriptPreview || title }
  }
  if (normalizeForCompare(task.title) === normalizeForCompare(scriptPreview)) {
    return { title: meta.voiceLabel || title, preview: scriptPreview }
  }
  return { title, preview: scriptPreview }
}

export function scriptListRowFromPayload(
  raw: unknown,
  task: WorkbenchTaskRecord,
): LibraryListRowCopy {
  const text = scriptTextFromPayload(raw)
  const preview = collapsePreviewText(text, 96)
  const title = (task.subtitle && task.subtitle.trim()) || task.title.slice(0, 28) || '历史文稿'
  if (!preview || normalizeForCompare(preview) === normalizeForCompare(title)) {
    return { title: preview || title }
  }
  return { title, preview }
}
