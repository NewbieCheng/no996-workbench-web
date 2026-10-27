/**
 * 视频工厂：把口播稿或镜头 beat 同步到工程字幕（CaptionCue 烧录 + 字幕文字轨双写）。
 * 估时按真实配音时长 + 字重铺开，非固定每句秒数，非 ASR。
 */

import {
  applyCaptionSegments,
  buildCaptionCuesFromBeats,
  type EditorInstance,
} from '@no996/video-editor'
import { buildAlignedTimeline } from '../../ip-video/lib/timeline-engine.ts'
import type { MappedBeat } from './map-shots.ts'

function shotSlicesFromDocument(editor: EditorInstance) {
  const doc = editor.getDocument()
  const shotTrack = doc.tracks.find((track) => track.type === 'shot')
  if (!shotTrack) return []
  return shotTrack.elements
    .filter((element) => element.type === 'shot')
    .sort((a, b) => a.startUs - b.startUs)
    .map((element) => ({
      id: element.id,
      startUs: element.startUs,
      durationUs: element.durationUs,
    }))
}

/** 字幕时间跟镜头片段对齐（无配音或仅需跟镜时）。 */
export function syncCaptionsToBeats(editor: EditorInstance, beats: MappedBeat[]): number {
  const cues = buildCaptionCuesFromBeats(beats, shotSlicesFromDocument(editor))
  if (!cues.length) return 0
  return applyCaptionSegments(
    editor,
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

/**
 * 字幕时间跟配音真实时长对齐（与 IP 口播同款估时算法，非语音识别）。
 * 写入 CaptionCue +「字幕」文字轨 TextClipElement。
 */
export function syncCaptionsToVoiceScript(
  editor: EditorInstance,
  script: string,
  durationUs: number,
  boundClipId?: string,
): number {
  const trimmed = script.trim()
  if (!trimmed || durationUs <= 0) return 0

  const aligned = buildAlignedTimeline(trimmed, durationUs / 1_000_000)
  const segments = aligned.sentences.map((sentence) => ({
    text: sentence.text,
    startUs: Math.round(sentence.start * 1_000_000),
    durationUs: Math.max(33_333, Math.round((sentence.end - sentence.start) * 1_000_000)),
    timingSource: 'estimated' as const,
    boundClipId,
  }))

  if (!segments.length) return 0
  return applyCaptionSegments(editor, segments, {
    boundClipId,
    timingSource: 'estimated',
  })
}
