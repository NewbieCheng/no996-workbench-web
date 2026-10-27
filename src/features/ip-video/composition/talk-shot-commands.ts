import type { EditorDocument, ShotClipElement, TransformBox } from '@no996/video-editor'
import type { Command } from '@no996/video-editor/core/commands/base.ts'
import { BatchCommand } from '@no996/video-editor/core/commands/base.ts'
import { AddTrackCommand } from '@no996/video-editor/core/commands/track-commands.ts'
import { DeleteElementsCommand, UpdateElementTransformCommand } from '@no996/video-editor/core/commands/timeline-commands.ts'
import { InsertShotCommand, TrimShotCommand, SetShotRateCommand, UpdateShotClipCommand, shotDurationUs } from '@no996/video-editor/core/commands/shot-commands.ts'
import { contentShotTextError, findContentShot } from '@no996/video-editor/demos/content-variants.tsx'
import { TALK_SHOT_CATALOG, talkShotUnavailableReasons, talkShotLabel } from './talk-shot-catalog'

const TRACK_ID = 'track-ip-talk-shots'
export const talkShotFps = (doc: EditorDocument) => doc.canvas.fps.num / doc.canvas.fps.den

/** Preserve the spoken program's length, captions, audio and script. No ripple/replace operation. */
function retainProgramLength(command: Command): Command {
  let durationUs = 0
  return {
    id: command.id, type: command.type,
    execute(doc) {
      durationUs = doc.durationUs
      const result = command.execute(doc)
      return { ...result, document: { ...result.document, durationUs } }
    },
    undo(doc) {
      const result = command.undo(doc)
      return { ...result, document: { ...result.document, durationUs } }
    },
  }
}
function safeNumber(value: number, label: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label}需在 ${min}–${max} 之间。`)
  return value
}
function writable(doc: EditorDocument, id: string): ShotClipElement {
  for (const track of doc.tracks) {
    const element = track.elements.find(e => e.id === id)
    if (element?.type === 'shot') {
      if (track.locked) throw new Error('镜头所在轨道已锁定。')
      return element
    }
  }
  throw new Error('该镜头已被删除或不属于当前作品。')
}
function writableContent(doc: EditorDocument, id: string): ShotClipElement {
  const element = writable(doc, id)
  if (element.presentation !== 'content' || !findContentShot(element.shotId)) throw new Error('原始演示镜头仅允许删除，不允许冒充内容版编辑。')
  return element
}
function validateSpan(doc: EditorDocument, startUs: number, durationUs: number) {
  safeNumber(startUs, '开始时间', 0, doc.durationUs)
  safeNumber(durationUs, '镜头时长', 600_000, doc.durationUs)
  if (startUs + durationUs > doc.durationUs) throw new Error('镜头需位于当前口播时长内，不延长或挤动人物音轨。')
}
function validateOverlap(doc: EditorDocument, startUs: number, durationUs: number, exceptId?: string) {
  if (doc.tracks.some(track => track.elements.some(element => element.type === 'shot' && element.presentation === 'content' && element.id !== exceptId && startUs < element.startUs + element.durationUs && startUs + durationUs > element.startUs))) throw new Error('此区间已有内容镜头，请先调整起止，避免不透明镜头相互遮挡。')
}
function validateOverrides(overrides: Record<string, string>): Record<string, string> {
  const result = Object.fromEntries(Object.entries(overrides).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
  const error = contentShotTextError(result)
  if (error) throw new Error(error)
  return result
}

/** Only the static content presentation is insertable; never fall back to definition.load (raw demo). */
export function createTalkShotInsertCommand(doc: EditorDocument, shotId: string, startUs: number, overrides: Record<string, string>): Command {
  const entry = TALK_SHOT_CATALOG.find(item => item.shot.shotId === shotId)
  if (!entry) throw new Error('镜头不在已审查清单中。')
  const reasons = talkShotUnavailableReasons(entry, doc)
  if (reasons.length) throw new Error(reasons.join('\n'))
  const fields = validateOverrides(overrides)
  const fps = talkShotFps(doc)
  safeNumber(startUs, '开始时间', 0, doc.durationUs)
  startUs = Math.round(startUs)
  // Bound to the existing spoken program. Normalized content animation retains its final readable hold.
  const sourceDurationFrames = Math.min(entry.shot.durationInFrames, Math.floor((doc.durationUs - startUs) / 1_000_000 * fps))
  const durationUs = shotDurationUs(sourceDurationFrames, 1, fps)
  validateSpan(doc, startUs, durationUs)
  validateOverlap(doc, startUs, durationUs)
  const existing = doc.tracks.find(t => t.id === TRACK_ID)
  if (existing && (existing.type !== 'shot' || existing.locked || existing.hidden)) throw new Error('口播镜头轨不可写入，请先解锁或显示对应轨道。')
  if (existing && doc.tracks.slice(doc.tracks.indexOf(existing) + 1).some(track => !track.hidden && track.elements.some(element => element.type === 'video' || element.type === 'image'))) throw new Error('人物画面位于镜头轨上方，请先在公共编辑器调整层序。')
  const commands: Command[] = []
  if (!existing) commands.push(new AddTrackCommand({ id: TRACK_ID, type: 'shot', name: '口播内容镜头（保留原声）', muted: false, hidden: false, locked: false, elements: [] }))
  commands.push(new InsertShotCommand({ trackId: TRACK_ID, shotId, presentation: 'content', startUs, sourceDurationFrames, canvasWidth: doc.canvas.width, canvasHeight: doc.canvas.height, name: talkShotLabel(entry), overrides: fields }, fps))
  return retainProgramLength(new BatchCommand(commands))
}

export function createTalkShotTimingCommand(doc: EditorDocument, id: string, startUs: number, endUs: number, rate: number): Command {
  const shot = writableContent(doc, id)
  const fps = talkShotFps(doc)
  safeNumber(rate, '速率', 0.25, 4)
  validateSpan(doc, startUs, endUs - startUs)
  const frames = Math.round((endUs - startUs) / 1_000_000 * fps * rate)
  const definition = TALK_SHOT_CATALOG.find(entry => entry.shot.shotId === shot.shotId)?.shot
  if (!definition || frames < 1 || frames > definition.durationInFrames) throw new Error('裁剪与速率不能超出原镜头帧数。')
  const durationUs = shotDurationUs(frames, rate, fps)
  validateSpan(doc, Math.round(startUs), durationUs)
  validateOverlap(doc, Math.round(startUs), durationUs, id)
  return retainProgramLength(new BatchCommand([
    new SetShotRateCommand(id, rate, fps),
    new TrimShotCommand(id, { startUs: Math.round(startUs), durationUs }, fps),
  ]))
}

export function createTalkShotTransformCommand(doc: EditorDocument, id: string, patch: Pick<TransformBox, 'x' | 'y' | 'width' | 'height' | 'opacity'>): Command {
  writableContent(doc, id)
  // Maintain at least one third of the canvas: these are content cards, not tiny subtitle stickers.
  safeNumber(patch.width, '宽度', doc.canvas.width / 3, doc.canvas.width)
  safeNumber(patch.height, '高度', doc.canvas.height / 3, doc.canvas.height)
  safeNumber(patch.x, '横坐标', 0, doc.canvas.width - patch.width)
  safeNumber(patch.y, '纵坐标', 0, doc.canvas.height - patch.height)
  safeNumber(patch.opacity, '透明度', 0, 1)
  if (Math.abs(patch.width / patch.height - doc.canvas.width / doc.canvas.height) > 0.001) throw new Error('内容镜头需保持当前画幅比例，请使用等比缩放。')
  return new UpdateElementTransformCommand(id, patch)
}

export function createTalkShotTextCommand(doc: EditorDocument, id: string, overrides: Record<string, string>): Command {
  writableContent(doc, id)
  return new UpdateShotClipCommand(id, { overrides: validateOverrides(overrides) }, talkShotFps(doc))
}
export function createTalkShotDeleteCommand(doc: EditorDocument, id: string): Command {
  writable(doc, id)
  return retainProgramLength(new DeleteElementsCommand([id], false))
}
