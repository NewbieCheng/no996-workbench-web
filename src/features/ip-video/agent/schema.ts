import { CONTENT_SHOT_DEFINITIONS, contentShotTextError } from '@no996/video-editor/demos/content-variants.tsx'
import type { EditorDocument } from '@no996/video-editor'
import { TALK_CAPTION_PRESETS, hasTalkAudio, talkSettings, type TalkDocument } from '../composition/talk-model'
import type { TalkCreationInput, TalkDirection, TalkDirectorPlan } from './types'

export function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${label}必须为纯数据对象。`)
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(row, key))) throw new Error(`${label}包含缺失或未授权字段。`)
  return row
}
export function plainText(value: unknown, label: string, max: number, multiline = false): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max) throw new Error(`${label}需为 1–${max} 字纯文本。`)
  if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]|```|(?:https?|javascript|data|file):|\b(?:import|export)\s|=>/iu.test(value) || (!multiline && /[\r\n\t]/u.test(value))) throw new Error(`${label}不得包含代码、网址、标记或控制字符。`)
  return value
}
function choice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new Error(`${label}不在静态选项中。`)
  return value as T
}
export function parseTalkDirections(value: unknown): TalkDirection[] {
  const root = record(value, ['directions'], '方向结果')
  if (!Array.isArray(root.directions) || root.directions.length < 2 || root.directions.length > 3) throw new Error('需提供 2–3 个创作方向。')
  const directions = root.directions.map(value => {
    const row = record(value, ['title', 'opening', 'reason'], '方向')
    return { title: plainText(row.title, '方向标题', 36), opening: plainText(row.opening, '开场', 160), reason: plainText(row.reason, '理由', 160) }
  })
  if (new Set(directions.map(item => item.title)).size !== directions.length) throw new Error('方向标题不可重复。')
  return directions
}
export function validateTalkDirectorPlan(value: unknown): TalkDirectorPlan {
  const row = record(value, ['version', 'title', 'script', 'summary', 'captionPresetId', 'ratio', 'composition', 'motion', 'shots'], '导演计划')
  if (row.version !== 1) throw new Error('不支持的导演计划版本。')
  if (!Array.isArray(row.shots) || row.shots.length > 12) throw new Error('内容镜头最多 12 个。')
  let previous = -1
  const shots = row.shots.map(value => {
    const shot = record(value, ['shotId', 'text', 'subline', 'cueIndex'], '内容镜头')
    const shotId = choice(shot.shotId, CONTENT_SHOT_DEFINITIONS.map(item => item.shotId), '镜头')
    const error = contentShotTextError({ text: shot.text, subline: shot.subline })
    if (error) throw new Error(error)
    if (!Number.isSafeInteger(shot.cueIndex) || (shot.cueIndex as number) <= previous || (shot.cueIndex as number) > 9999) throw new Error('镜头句序号需从 0 起递增且不重复。')
    previous = shot.cueIndex as number
    return { shotId, text: plainText(shot.text, '短标题', 18), subline: plainText(shot.subline, '副标题', 36), cueIndex: previous }
  })
  if (row.script === '' && shots.length) throw new Error('无文稿时不得猜测字幕句或生成内容镜头。')
  return {
    version: 1, title: plainText(row.title, '标题', 60), script: row.script === '' ? '' : plainText(row.script, '文稿', 12000, true),
    summary: plainText(row.summary, '摘要', 300),
    captionPresetId: choice(row.captionPresetId, TALK_CAPTION_PRESETS.map(item => item.id), '字幕预设'),
    ratio: choice(row.ratio, ['9:16', '16:9', '1:1', '3:4'], '画幅'),
    composition: choice(row.composition, ['full', 'side', 'top', 'pip'], '构图'),
    motion: choice(row.motion, ['calm', 'normal', 'lively'], '动效'), shots,
  }
}
export function hasTalkOriginalSound(input: TalkCreationInput): boolean {
  return hasTalkAudio(input.document)
}
/** An empty locked script means original sound without a transcript: plan visuals only. */
export function resolveLockedTalkScript(input: TalkCreationInput): string | undefined {
  const manuscript = (input.document as TalkDocument).ipVideo?.script ?? ''
  if (input.intent === 'adjust' || hasTalkOriginalSound(input)) return manuscript
  if (input.scriptMode === 'verbatim') return plainText(input.brief, '逐字文稿', 12000, true)
  if (input.scriptMode === 'rewrite') return undefined
  return manuscript.trim() ? manuscript : undefined
}

/** Photos' placeholder duration is not a spoken program. Never clamp overlong scripts. */
export function resolveTalkProgramDuration(document: EditorDocument, script: string): number {
  const speed = talkSettings(document).speed ?? 1
  if (!Number.isFinite(speed) || speed <= 0) throw new Error('口播语速无效。')
  const estimated = script.trim() ? Math.max(1_000_000, Math.round(Array.from(script.replace(/\s/gu, '')).length / (2.8 * speed) * 1_000_000)) : 0
  if (estimated > 300_000_000) throw new Error('文稿预计超过 5 分钟，请缩短文稿后再创建，不会自动压缩时长。')
  const measured = Math.max(0, ...document.tracks.flatMap(track => track.elements.filter(element => element.type === 'audio' || element.type === 'video').map(element => element.startUs + element.durationUs)))
  if (measured > 300_000_000) throw new Error('音视频节目超过 5 分钟，请先裁剪素材。')
  return measured || estimated || document.durationUs
}
