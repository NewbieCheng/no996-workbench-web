import type { EditorDocument, ShotClipElement } from '@no996/video-editor'
import { mirrorCaptionsOntoTextTrack } from '@no996/video-editor'
import { validateEditorDocument } from '@no996/video-editor/core/schema.ts'
import { shotDurationUs } from '@no996/video-editor/core/commands/shot-commands.ts'
import { createTalkShotInsertCommand } from './talk-shot-commands'
import { TALK_SHOT_CATALOG } from './talk-shot-catalog'
import { applyTalkComposition, estimateCues, patchGlobalStyle, setTalkRatio, talkSettings, updateScript, retimePhotos, validateTalkCaptions, TALK_CAPTION_PRESETS, type TalkDocument } from './talk-model'
import { resolveLockedTalkScript, resolveTalkProgramDuration, validateTalkDirectorPlan } from '../agent/schema'
import type { TalkCreationInput, TalkDirectorMetadata, TalkDirectorPlan } from '../agent/types'

export const TALK_DIRECTOR_SHOT_PREFIX = 'ip-director-shot-'
type DirectedDocument = TalkDocument & { ipVideo?: ReturnType<typeof talkSettings> & { director?: TalkDirectorMetadata } }
const owned = (id: string) => id.startsWith(TALK_DIRECTOR_SHOT_PREFIX)
const stableKey = (value: string) => {
  let hash = 2166136261
  for (const char of value) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(36)
}

/** Normalize only IDs produced by helpers; their random IDs never escape this pure compiler. */
function stableGeneratedData(next: TalkDocument, original: EditorDocument, key: string): TalkDocument {
  const oldCues = new Set(original.captions.map(cue => cue.id))
  return {
    ...next,
    captions: next.captions.map((cue, index) => oldCues.has(cue.id) ? cue : { ...cue, id: `ip-director-cue-${key}-${index}` }),
    tracks: next.tracks.map(track => ({ ...track, elements: track.elements.map(element => {
      // Ratio/composition helpers must not modify manual shots or audio.
      const prior = original.tracks.flatMap(item => item.elements).find(item => item.id === element.id)
      if (prior && (prior.type === 'audio' || (prior.type === 'shot' && !owned(prior.id)))) return prior
      if (element.type !== 'image' || !element.id.startsWith('ip-photo-') || !element.animations) return element
      if (prior?.type === 'image' && JSON.stringify(prior) === JSON.stringify(element)) return prior
      return { ...element, animations: { channels: Object.fromEntries(Object.entries(element.animations.channels).map(([path, channel]) => [path, { ...channel, keyframes: channel.keyframes.map((frame, index) => ({ ...frame, id: `ip-director-key-${stableKey(element.id + path)}-${index}` })) }])) } }
    }) })),
  }
}

/** Resolve exact cue anchors, cap at the next anchor/manual clip, and fail rather than drop a shot. */
function insertShots(document: EditorDocument, plan: TalkDirectorPlan, taskId: string): { document: EditorDocument; shots: TalkDirectorMetadata['shots'] } {
  validateTalkCaptions(document.captions, document.durationUs)
  let next = document
  const refs: TalkDirectorMetadata['shots'] = []
  const fps = document.canvas.fps.num / document.canvas.fps.den
  if (!Number.isFinite(fps) || fps <= 0 || fps > 120) throw new Error('无法按当前帧率编排镜头。')
  for (let index = 0; index < plan.shots.length; index++) {
    const shot = plan.shots[index]
    const cue = document.captions[shot.cueIndex]
    if (!cue) throw new Error(`镜头 ${index + 1} 引用了不存在的字幕句 ${shot.cueIndex + 1}。`)
    const following = plan.shots[index + 1]
    const nextCue = following ? document.captions[following.cueIndex] : undefined
    if (following && !nextCue) throw new Error('后续镜头引用的字幕句不存在。')
    const startUs = cue.startUs
    let endUs = Math.min(document.durationUs, nextCue?.startUs ?? document.durationUs)
    for (const element of next.tracks.flatMap(track => track.elements)) {
      if (element.type !== 'shot') continue
      if (element.startUs <= startUs && element.startUs + element.durationUs > startUs) throw new Error(`镜头 ${index + 1} 与已有镜头重叠，请修改句序号或保留镜头。`)
      if (element.startUs > startUs) endUs = Math.min(endUs, element.startUs)
    }
    const definition = TALK_SHOT_CATALOG.find(entry => entry.shot.shotId === shot.shotId)?.shot
    if (!definition) throw new Error('内容镜头不在静态目录。')
    const frames = Math.min(definition.durationInFrames, Math.floor((endUs - startUs) / 1_000_000 * fps))
    const span = shotDurationUs(frames, 1, fps)
    if (!Number.isSafeInteger(startUs) || span < 600_000 || startUs + span > endUs) throw new Error(`镜头 ${index + 1} 没有至少 0.6 秒的不重叠展示空间。`)
    // A bounded working copy makes the existing insert command validate precisely the chosen span.
    const beforeIds = new Set(next.tracks.flatMap(track => track.elements.map(element => element.id)))
    const inserted = createTalkShotInsertCommand({ ...next, durationUs: startUs + span }, shot.shotId, startUs, { text: shot.text, subline: shot.subline }).execute({ ...next, durationUs: startUs + span }).document
    const id = `${TALK_DIRECTOR_SHOT_PREFIX}${stableKey(taskId)}-${index}`
    if (beforeIds.has(id)) throw new Error('导演镜头标识与现有内容冲突。')
    let count = 0
    next = { ...inserted, durationUs: document.durationUs, tracks: inserted.tracks.map(track => ({ ...track, elements: track.elements.map(element => {
      if (beforeIds.has(element.id)) return element
      if (element.type !== 'shot' || element.presentation !== 'content') throw new Error('镜头命令产生了未授权元素。')
      count++
      return { ...element, id }
    }) })) }
    if (count !== 1) throw new Error('镜头命令未产生唯一内容镜头。')
    const element = next.tracks.flatMap(track => track.elements).find(element => element.id === id) as ShotClipElement
    refs.push({ elementId: id, cueIndex: shot.cueIndex, timing: { startUs: element.startUs, durationUs: element.durationUs, sourceDurationFrames: element.sourceDurationFrames, rate: element.rate } })
  }
  return { document: next, shots: refs }
}

/** Pure preparation only. The caller commits this document through one editTalk command. */
export function compileTalkDirectorPlan(document: EditorDocument, value: TalkDirectorPlan, input: TalkCreationInput, taskId: string): EditorDocument {
  const plan = validateTalkDirectorPlan(value)
  if (!taskId.trim()) throw new Error('缺少可信任务标识。')
  if (document.id !== input.document.id || document.revision !== input.document.revision) throw new Error('工程已变化，请重新生成或确认后应用。')
  const locked = resolveLockedTalkScript({ ...input, document })
  if (locked !== undefined && plan.script !== locked) throw new Error('导演计划不得改写已有文稿或原声文稿。')
  let next: DirectedDocument = JSON.parse(JSON.stringify(document)) as DirectedDocument
  const oldDirector = next.ipVideo?.director
  const state = talkSettings(document)
  const protectedCaptions = input.preserve.captions || document.captions.some(cue => cue.timingSource !== 'estimated')
  if (protectedCaptions && document.captions.length && state.script !== plan.script) throw new Error('现有字幕被保留或已人工校时，请先明确处理文稿差异。')
  const durationUs = resolveTalkProgramDuration(document, plan.script)
  if (plan.script !== state.script || next.durationUs <= 0) next = updateScript(next, plan.script)
  next = { ...next, durationUs, name: input.intent === 'adjust' ? document.name : plan.title }
  next.captions = protectedCaptions && document.captions.length ? document.captions : (state.script === plan.script && document.captions.length && durationUs === document.durationUs ? document.captions : estimateCues(plan.script, durationUs))
  if (!input.preserve.composition) {
    next = setTalkRatio(next, input.ratio === 'auto' ? plan.ratio : input.ratio)
    next = applyTalkComposition(next, plan.composition)
    next.ipVideo = { ...talkSettings(next), photoMotion: (input.motion === 'auto' ? plan.motion : input.motion) !== 'calm' }
    next = retimePhotos(next)
  }
  if (!input.preserve.captions) {
    const presetId = input.captionPresetId ?? plan.captionPresetId
    const preset = TALK_CAPTION_PRESETS.find(item => item.id === presetId)
    if (!preset) throw new Error('字幕预设不存在。')
    const motion = input.motion === 'auto' ? plan.motion : input.motion
    next = patchGlobalStyle(next, { ...preset.style, motion: motion === 'calm' ? 0 : motion === 'lively' ? .8 : .45 })
    next.ipVideo = { ...talkSettings(next), captionPresetId: presetId }
  }
  if (input.preserve.composition) {
    const visuals = new Map(document.tracks.flatMap(track => track.elements).filter(element => element.type === 'image' || element.type === 'video').map(element => [element.id, element]))
    next = { ...next, tracks: next.tracks.map(track => ({ ...track, elements: track.elements.map(element => visuals.get(element.id) ?? element) })) }
    if (durationUs !== document.durationUs) next = retimePhotos(next)
  }
  next = stableGeneratedData(next, document, stableKey(taskId))
  // cue id 稳定化之后再镜像到字幕文字轨，避免 clip 与 cue id 错位
  mirrorCaptionsOntoTextTrack(next)
  let refs = oldDirector?.shots ?? []
  if (!input.preserve.shots) {
    if (next.tracks.some(track => track.locked && track.elements.some(element => owned(element.id)))) throw new Error('AI 镜头轨道已锁定，不能替换。')
    next = { ...next, tracks: next.tracks.map(track => ({ ...track, elements: track.elements.filter(element => element.type !== 'shot' || !owned(element.id)) })) }
    const compiled = insertShots(next, plan, taskId)
    next = compiled.document as DirectedDocument
    refs = compiled.shots
  }
  const director: TalkDirectorMetadata = {
    version: 1, preserveShots: input.preserve.shots, taskId: input.preserve.shots && oldDirector ? oldDirector.taskId : taskId,
    plan: input.preserve.shots ? { ...plan, shots: plan.script ? oldDirector?.plan.shots ?? [] : [] } : plan, shots: refs,
  }
  next = { ...next, ipVideo: { ...talkSettings(next), director } }
  validateTalkCaptions(next.captions, next.durationUs)
  validateShotBounds(next)
  validateEditorDocument(next)
  return next
}

/** Kept user shots may not outlive a newly bound, shorter spoken program. */
function validateShotBounds(document: EditorDocument): void {
  for (const element of document.tracks.flatMap(track => track.elements)) {
    if (element.type !== 'shot') continue
    if (!Number.isSafeInteger(element.startUs) || !Number.isSafeInteger(element.durationUs) || element.startUs < 0 || element.durationUs <= 0 || element.startUs + element.durationUs > document.durationUs) throw new Error('配音或文稿时长变短后，现有镜头超出节目范围。请先调整镜头起止；不会自动删除或截断受保护镜头。')
  }
}

/** Called after audio binding; manual edits/protection conservatively retain all AI shots. */
export function retimeTalkDirectorShots(document: EditorDocument): EditorDocument {
  const director = (document as DirectedDocument).ipVideo?.director
  if (!director) { validateShotBounds(document); return document }
  const existing = document.tracks.flatMap(track => track.elements).filter((element): element is ShotClipElement => element.type === 'shot' && owned(element.id))
  if (!existing.length) { validateShotBounds(document); return document }
  const protectedShots = talkSettings(document).aiProtected?.shots || director.preserveShots || document.tracks.some(track => (track.locked || track.hidden) && track.elements.some(element => owned(element.id)))
  const referencesMatch = director.version === 1 && typeof director.taskId === 'string' && Array.isArray(director.shots) && Array.isArray(director.plan?.shots)
    && existing.length === director.shots.length && director.plan.shots.length === existing.length
    && director.shots.every((ref, index) => {
      const element = existing.find(element => element.id === ref.elementId)
      const planned = director.plan.shots[index]
      if (!element || !planned || !owned(ref.elementId) || ref.cueIndex !== planned.cueIndex || element.shotId !== planned.shotId || element.presentation !== 'content') return false
      // A manually moved/trimmed/retimed AI shot is now user-owned for automatic retiming.
      return !ref.timing || (['startUs', 'durationUs', 'sourceDurationFrames', 'rate'] as const).every(key => element[key] === ref.timing![key])
    })
  if (protectedShots || !referencesMatch) {
    validateShotBounds(document)
    return document
  }
  const plan = validateTalkDirectorPlan(director.plan)
  const base = { ...document, tracks: document.tracks.map(track => ({ ...track, elements: track.elements.filter(element => !owned(element.id)) })) }
  const compiled = insertShots(base, plan, director.taskId)
  const generated = new Map(compiled.document.tracks.flatMap(track => track.elements).filter(element => owned(element.id)).map(element => [element.id, element]))
  // Only timing fields move: user edits to AI shot text/transform remain intact.
  const next: DirectedDocument = { ...document, ipVideo: { ...talkSettings(document), director: { ...director, shots: compiled.shots } }, tracks: document.tracks.map(track => ({ ...track, elements: track.elements.map(element => {
    const timing = generated.get(element.id)
    if (!timing || element.type !== 'shot' || timing.type !== 'shot') return element
    return { ...element, startUs: timing.startUs, durationUs: timing.durationUs, sourceDurationFrames: timing.sourceDurationFrames, rate: timing.rate }
  }) })) }
  validateShotBounds(next)
  validateEditorDocument(next)
  return next
}
