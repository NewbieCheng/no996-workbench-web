/**
 * 口播/SRT 字幕双写：文字轨 TextClipElement（时间线编辑）+ CaptionCue（烧录）。
 * 不做 ASR；估时由调用方按真实音频时长切句后传入 segments。
 */

import type { EditorInstance } from '../../core/instance.ts'
import type {
  CaptionCue,
  CaptionStyle,
  CaptionTimingSource,
  EditorDocument,
  TextClipElement,
  TextStyle,
  TimelineTrack,
  TrackElement,
  TransformBox,
} from '../../core/project.ts'
import { BatchCommand } from '../../core/commands/base.ts'
import {
  DeleteElementsCommand,
  InsertElementCommand,
  MoveElementsCommand,
  TrimElementCommand,
  UpdateCaptionsCommand,
  UpdateTextClipCommand,
} from '../../core/commands/timeline-commands.ts'
import { AddTrackCommand } from '../../core/commands/track-commands.ts'
import type { TimeUs } from '../../core/time.ts'
import { shiftCaptions } from './caption-ops.ts'
import { captionStyleToTransform } from './caption-geometry.ts'

export const CAPTION_SENTENCE_COMPONENT_ID = 'caption.sentence'
export const SUBTITLE_TRACK_NAME = '字幕'
export const TITLE_TEXT_TRACK_ID = 'track-title-text'

export type CaptionSegmentInput = {
  text: string
  startUs: TimeUs
  durationUs: TimeUs
  timingSource?: CaptionTimingSource
  boundClipId?: string
  /** 稳定 cue id；缺省自动生成。文字 clip id = captionClipIdForCue(cueId) */
  cueId?: string
}

export type ApplyCaptionSegmentsOptions = {
  boundClipId?: string
  timingSource?: CaptionTimingSource
  stylePatch?: Partial<CaptionStyle>
  /** 为 true 时不删非字幕文字（默认只清字幕轨上的 caption clip） */
  replaceExisting?: boolean
}

const MIN_DURATION_US = 33_333

export function captionClipIdForCue(cueId: string): string {
  return `caption-clip:${cueId}`
}

export function cueIdFromCaptionClipId(clipId: string): string | null {
  return clipId.startsWith('caption-clip:') ? clipId.slice('caption-clip:'.length) : null
}

export function isCaptionTextClip(element: TrackElement): element is TextClipElement {
  if (element.type !== 'text') return false
  const textEl = element as TextClipElement
  if (textEl.component?.componentId === CAPTION_SENTENCE_COMPONENT_ID) return true
  return cueIdFromCaptionClipId(textEl.id) != null
}

export function findSubtitleTextTrack(doc: EditorDocument): TimelineTrack | undefined {
  const byName = doc.tracks.find(
    (track) => track.type === 'text' && !track.locked && track.name.includes(SUBTITLE_TRACK_NAME),
  )
  if (byName) return byName

  const withCaptions = doc.tracks.find(
    (track) =>
      track.type === 'text' &&
      !track.locked &&
      track.id !== TITLE_TEXT_TRACK_ID &&
      track.elements.some((el) => isCaptionTextClip(el)),
  )
  if (withCaptions) return withCaptions

  return undefined
}

/**
 * 在文档上找到或插入「字幕」文字轨（无命令，供 IP 口播等直接改 doc 的路径）。
 */
export function ensureSubtitleTextTrackOnDocument(doc: EditorDocument): TimelineTrack {
  const existing = findSubtitleTextTrack(doc)
  if (existing) return existing

  const trackId = `track-subtitle-${crypto.randomUUID()}`
  const newTrack: TimelineTrack = {
    id: trackId,
    type: 'text',
    name: SUBTITLE_TRACK_NAME,
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  }
  const titleIdx = doc.tracks.findIndex((t) => t.id === TITLE_TEXT_TRACK_ID)
  if (titleIdx >= 0) doc.tracks.splice(titleIdx + 1, 0, newTrack)
  else doc.tracks.push(newTrack)
  return newTrack
}

/**
 * 找到或创建「字幕」文字轨。新建会执行可撤销的 AddTrackCommand。
 */
export function ensureSubtitleTextTrack(editor: EditorInstance): TimelineTrack {
  const existing = findSubtitleTextTrack(editor.getDocument())
  if (existing) return existing

  const trackId = `track-subtitle-${crypto.randomUUID()}`
  const newTrack: TimelineTrack = {
    id: trackId,
    type: 'text',
    name: SUBTITLE_TRACK_NAME,
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  }

  const doc = editor.getDocument()
  const titleIdx = doc.tracks.findIndex((t) => t.id === TITLE_TEXT_TRACK_ID)
  const insertIndex = titleIdx >= 0 ? titleIdx + 1 : undefined
  editor.executeCommand(new AddTrackCommand(newTrack, insertIndex))

  const created = editor.getDocument().tracks.find((t) => t.id === trackId)
  if (!created) throw new Error(`创建字幕轨失败: ${trackId}`)
  return created
}

/**
 * 直接写入文档：字幕轨 TextClip + CaptionCue（无 EditorInstance / 无撤销栈）。
 * 供 IP 口播 TTS、导演编译等「改副本再提交」路径。
 */
export function writeCaptionSegmentsToDocument(
  doc: EditorDocument,
  segments: CaptionSegmentInput[],
  options: ApplyCaptionSegmentsOptions = {},
): number {
  const cues = segmentsToCaptionCues(segments, {
    boundClipId: options.boundClipId,
    timingSource: options.timingSource,
  })
  const track = ensureSubtitleTextTrackOnDocument(doc)
  const replaceExisting = options.replaceExisting !== false

  if (replaceExisting) {
    track.elements = track.elements.filter((el) => !isCaptionTextClip(el))
  }

  for (const cue of cues) {
    track.elements.push(
      buildCaptionTextClip(
        track.id,
        {
          text: cue.text,
          startUs: cue.startUs,
          durationUs: cue.durationUs,
          timingSource: cue.timingSource,
          boundClipId: cue.boundClipId,
          cueId: cue.id,
        },
        cue.id,
        doc,
      ),
    )
  }
  track.elements.sort((a, b) => a.startUs - b.startUs)
  doc.captions = cues
  if (options.stylePatch && doc.captionStyle) {
    Object.assign(doc.captionStyle, options.stylePatch)
  }
  return cues.length
}

/** 把已有 doc.captions 镜像到字幕文字轨（替换轨上旧 caption clip）。 */
export function mirrorCaptionsOntoTextTrack(doc: EditorDocument): number {
  const cues = doc.captions ?? []
  if (cues.length === 0) {
    const track = findSubtitleTextTrack(doc)
    if (track) {
      track.elements = track.elements.filter((el) => !isCaptionTextClip(el))
    }
    return 0
  }
  return writeCaptionSegmentsToDocument(
    doc,
    cues.map((cue) => ({
      text: cue.text,
      startUs: cue.startUs,
      durationUs: cue.durationUs,
      timingSource: cue.timingSource,
      boundClipId: cue.boundClipId,
      cueId: cue.id,
    })),
  )
}

function defaultCaptionTextStyle(captionStyle?: CaptionStyle): TextStyle {
  return {
    font: captionStyle?.font ?? 'sans-serif',
    size: Math.min(28, captionStyle?.size ?? 28),
    weight: captionStyle?.weight ?? 600,
    color: captionStyle?.color ?? '#FFD60A',
    backgroundColor: captionStyle?.backgroundColor ?? 'transparent',
    outlineColor: captionStyle?.outlineColor ?? '#000000',
    outlineWidth: captionStyle?.outlineWidth ?? 2,
    align: captionStyle?.align ?? 'center',
    lineHeight: captionStyle?.lineHeight ?? 1.2,
    letterSpacing: captionStyle?.letterSpacing ?? 0,
  }
}

function defaultCaptionTransform(doc: EditorDocument): TransformBox {
  return captionStyleToTransform(doc)
}

export function buildCaptionTextClip(
  trackId: string,
  segment: CaptionSegmentInput,
  cueId: string,
  doc: EditorDocument,
): TextClipElement {
  return {
    id: captionClipIdForCue(cueId),
    trackId,
    type: 'text',
    text: segment.text,
    startUs: Math.max(0, Math.round(segment.startUs)),
    durationUs: Math.max(MIN_DURATION_US, Math.round(segment.durationUs)),
    style: defaultCaptionTextStyle(doc.captionStyle),
    transform: defaultCaptionTransform(doc),
    component: {
      componentId: CAPTION_SENTENCE_COMPONENT_ID,
      props: {
        cueId,
        timingSource: segment.timingSource ?? 'estimated',
        boundClipId: segment.boundClipId ?? null,
        /** 时间线色块标签用；预览烧录仍走 CaptionCue */
        burnPreview: false,
      },
    },
  }
}

export function segmentsToCaptionCues(
  segments: CaptionSegmentInput[],
  defaults?: { boundClipId?: string; timingSource?: CaptionTimingSource },
): CaptionCue[] {
  const cues: CaptionCue[] = []
  for (const seg of segments) {
    const text = seg.text.trim()
    if (!text) continue
    const cueId = seg.cueId ?? `cue-${crypto.randomUUID()}`
    cues.push({
      id: cueId,
      startUs: Math.max(0, Math.round(seg.startUs)),
      durationUs: Math.max(MIN_DURATION_US, Math.round(seg.durationUs)),
      text,
      timingSource: seg.timingSource ?? defaults?.timingSource ?? 'estimated',
      boundClipId: seg.boundClipId ?? defaults?.boundClipId,
    })
  }
  return cues
}

/**
 * 以 segments 为真相源：清字幕轨上旧 caption clip → 插入新 clip → 更新 CaptionCue。
 * 返回写入的句数。
 */
export function applyCaptionSegments(
  editor: EditorInstance,
  segments: CaptionSegmentInput[],
  options: ApplyCaptionSegmentsOptions = {},
): number {
  const cues = segmentsToCaptionCues(segments, {
    boundClipId: options.boundClipId,
    timingSource: options.timingSource,
  })

  const track = ensureSubtitleTextTrack(editor)
  const doc = editor.getDocument()
  const replaceExisting = options.replaceExisting !== false

  const commands = []
  if (replaceExisting) {
    const oldIds = track.elements.filter((el) => isCaptionTextClip(el)).map((el) => el.id)
    if (oldIds.length > 0) {
      commands.push(new DeleteElementsCommand(oldIds, false))
    }
  }

  for (const cue of cues) {
    const clip = buildCaptionTextClip(
      track.id,
      {
        text: cue.text,
        startUs: cue.startUs,
        durationUs: cue.durationUs,
        timingSource: cue.timingSource,
        boundClipId: cue.boundClipId,
        cueId: cue.id,
      },
      cue.id,
      doc,
    )
    commands.push(new InsertElementCommand(track.id, clip))
  }

  commands.push(new UpdateCaptionsCommand(cues, options.stylePatch))
  editor.executeCommand(new BatchCommand(commands))
  return cues.length
}

/** 整轨平移字幕文字片段，并同步 CaptionCue。成功返回 true。 */
export function shiftCaptionSegmentsOnTrack(editor: EditorInstance, deltaUs: TimeUs): boolean {
  if (deltaUs === 0) return true
  const doc = editor.getDocument()
  const track = findSubtitleTextTrack(doc)
  const captionClips = track?.elements.filter((el) => isCaptionTextClip(el)) ?? []

  if (captionClips.length === 0) {
    const cues = doc.captions ?? []
    if (cues.length === 0) return false
    editor.executeCommand(new UpdateCaptionsCommand(shiftCaptions(cues, deltaUs)))
    return true
  }

  let effectiveDelta = deltaUs
  if (deltaUs < 0) {
    const minStart = Math.min(...captionClips.map((c) => c.startUs))
    if (minStart + deltaUs < 0) effectiveDelta = -minStart
  }

  const moves = captionClips.map((clip) => ({
    elementId: clip.id,
    newStartUs: Math.max(0, clip.startUs + effectiveDelta),
  }))

  const nextCues = shiftCaptions(doc.captions ?? [], effectiveDelta)
  editor.executeCommand(
    new BatchCommand([new MoveElementsCommand(moves), new UpdateCaptionsCommand(nextCues)]),
  )
  return true
}

/**
 * 从当前字幕轨上的 caption text clip 派生 CaptionCue（时间线拖移/裁剪后同步烧录）。
 */
export function captionsFromSubtitleTextClips(doc: EditorDocument): CaptionCue[] | null {
  const track = findSubtitleTextTrack(doc)
  if (!track) return null
  const clips = track.elements.filter((el) => isCaptionTextClip(el)) as TextClipElement[]
  if (clips.length === 0) return null

  const prevById = new Map((doc.captions ?? []).map((c) => [c.id, c]))
  const cues: CaptionCue[] = []
  for (const clip of clips.sort((a, b) => a.startUs - b.startUs)) {
    const cueId =
      (typeof clip.component?.props?.cueId === 'string' && clip.component.props.cueId) ||
      cueIdFromCaptionClipId(clip.id) ||
      `cue-${crypto.randomUUID()}`
    const prev = prevById.get(cueId)
    const timingFromProps = clip.component?.props?.timingSource
    const timingSource: CaptionTimingSource =
      timingFromProps === 'srt' || timingFromProps === 'manual' || timingFromProps === 'estimated'
        ? timingFromProps
        : prev?.timingSource ?? 'manual'
    const boundFromProps = clip.component?.props?.boundClipId
    cues.push({
      id: cueId,
      startUs: clip.startUs,
      durationUs: clip.durationUs,
      text: clip.text,
      timingSource,
      boundClipId:
        typeof boundFromProps === 'string'
          ? boundFromProps
          : boundFromProps === null
            ? undefined
            : prev?.boundClipId,
      styleOverride: prev?.styleOverride,
    })
  }
  return cues
}

/** 时间线移动/裁剪 caption clip 后，把 Cue 时间对齐到 clip。 */
export function syncCaptionsFromTextTrack(editor: EditorInstance): boolean {
  const cues = captionsFromSubtitleTextClips(editor.getDocument())
  if (!cues) return false
  editor.executeCommand(new UpdateCaptionsCommand(cues))
  return true
}

function documentTouchesCaptionClips(doc: EditorDocument, elementIds: string[]): boolean {
  const idSet = new Set(elementIds)
  for (const track of doc.tracks) {
    for (const el of track.elements) {
      if (idSet.has(el.id) && isCaptionTextClip(el)) return true
    }
  }
  return false
}

/**
 * 移动元素；若含字幕文字片段，同批同步 CaptionCue（一条撤销）。
 */
export function commitMovesSyncingCaptions(
  editor: EditorInstance,
  moves: Array<{ elementId: string; newStartUs: TimeUs }>,
): void {
  if (moves.length === 0) return
  const doc = editor.getDocument()
  const ids = moves.map((m) => m.elementId)
  if (!documentTouchesCaptionClips(doc, ids)) {
    editor.executeCommand(new MoveElementsCommand(moves))
    return
  }

  const moveMap = new Map(moves.map((m) => [m.elementId, m.newStartUs]))
  const projected = cloneDocWithProjectedClipTimes(doc, moveMap, null)
  const cues = captionsFromSubtitleTextClips(projected)
  if (!cues) {
    editor.executeCommand(new MoveElementsCommand(moves))
    return
  }
  editor.executeCommand(
    new BatchCommand([new MoveElementsCommand(moves), new UpdateCaptionsCommand(cues)]),
  )
}

/**
 * 裁剪元素；若为字幕文字片段，同批同步 CaptionCue。
 */
export function commitTrimSyncingCaptions(
  editor: EditorInstance,
  elementId: string,
  patch: { startUs?: TimeUs; durationUs?: TimeUs; sourceInUs?: TimeUs; sourceOutUs?: TimeUs },
): void {
  const doc = editor.getDocument()
  if (!documentTouchesCaptionClips(doc, [elementId])) {
    editor.executeCommand(new TrimElementCommand(elementId, patch))
    return
  }

  const startMap =
    patch.startUs !== undefined ? new Map([[elementId, patch.startUs]]) : null
  const durationMap =
    patch.durationUs !== undefined ? new Map([[elementId, patch.durationUs]]) : null
  const projected = cloneDocWithProjectedClipTimes(doc, startMap, durationMap)
  const cues = captionsFromSubtitleTextClips(projected)
  if (!cues) {
    editor.executeCommand(new TrimElementCommand(elementId, patch))
    return
  }
  editor.executeCommand(
    new BatchCommand([new TrimElementCommand(elementId, patch), new UpdateCaptionsCommand(cues)]),
  )
}

/** 浅投影 start/duration，仅用于派生 Cue，不进撤销栈 */
function cloneDocWithProjectedClipTimes(
  doc: EditorDocument,
  startMap: Map<string, TimeUs> | null,
  durationMap: Map<string, TimeUs> | null,
): EditorDocument {
  return {
    ...doc,
    tracks: doc.tracks.map((track) => ({
      ...track,
      elements: track.elements.map((el) => {
        if (!startMap?.has(el.id) && !durationMap?.has(el.id)) return el
        return {
          ...el,
          startUs: startMap?.get(el.id) ?? el.startUs,
          durationUs: durationMap?.get(el.id) ?? el.durationUs,
        }
      }),
    })),
  }
}

/**
 * 若本次移动/裁剪涉及字幕文字片段，同步 CaptionCue。
 * 供已单独执行 Move/Trim 后的兜底调用。
 */
export function syncCaptionsIfCaptionClipsTouched(
  editor: EditorInstance,
  elementIds: string[],
): boolean {
  if (elementIds.length === 0) return false
  if (!documentTouchesCaptionClips(editor.getDocument(), elementIds)) return false
  return syncCaptionsFromTextTrack(editor)
}

/** 选中字幕轨上全部 caption clip 的 id。 */
export function selectAllCaptionClipIds(doc: EditorDocument, trackId?: string): string[] {
  const track = trackId
    ? doc.tracks.find((t) => t.id === trackId)
    : findSubtitleTextTrack(doc)
  if (!track || track.type !== 'text') return []
  return track.elements.filter((el) => isCaptionTextClip(el)).map((el) => el.id)
}

/** 面板改单句文案时，同步对应文字 clip。 */
export function syncCaptionClipText(editor: EditorInstance, cueId: string, text: string): void {
  const clipId = captionClipIdForCue(cueId)
  const doc = editor.getDocument()
  for (const track of doc.tracks) {
    const el = track.elements.find((e) => e.id === clipId)
    if (el && el.type === 'text') {
      editor.executeCommand(new UpdateTextClipCommand(clipId, { text }))
      return
    }
  }
}

/** 舞台/Inspector 改字幕正文：Cue 真源 + marker 镜像（单次 Batch）。 */
export function commitCaptionCueText(editor: EditorInstance, cueId: string, text: string): void {
  const doc = editor.getDocument()
  const cues = (doc.captions || []).map((c) => (c.id === cueId ? { ...c, text } : c))
  const clipId = captionClipIdForCue(cueId)
  const hasClip = doc.tracks.some((t) => t.elements.some((e) => e.id === clipId))
  const commands: Array<UpdateCaptionsCommand | UpdateTextClipCommand> = [
    new UpdateCaptionsCommand(cues),
  ]
  if (hasClip) {
    commands.push(new UpdateTextClipCommand(clipId, { text }))
  }
  editor.executeCommand(new BatchCommand(commands))
}

/** 从字幕 clip id 提交正文 */
export function commitCaptionTextFromClipId(editor: EditorInstance, clipId: string, text: string): boolean {
  const cueId = cueIdFromCaptionClipId(clipId)
  if (!cueId) return false
  commitCaptionCueText(editor, cueId, text)
  return true
}

export function syncCaptionClipTiming(
  editor: EditorInstance,
  cueId: string,
  startUs: TimeUs,
  durationUs: TimeUs,
): void {
  const clipId = captionClipIdForCue(cueId)
  const doc = editor.getDocument()
  for (const track of doc.tracks) {
    const el = track.elements.find((e) => e.id === clipId)
    if (!el || el.type !== 'text') continue
    const commands = []
    if (el.startUs !== startUs) {
      commands.push(new MoveElementsCommand([{ elementId: clipId, newStartUs: startUs }]))
    }
    if (el.durationUs !== durationUs) {
      commands.push(new TrimElementCommand(clipId, { durationUs }))
    }
    if (commands.length > 0) {
      editor.executeCommand(new BatchCommand(commands))
    }
    return
  }
}
