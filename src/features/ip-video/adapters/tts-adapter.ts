/**
 * IP 视频 TTS 配音业务适配器
 * 核心契约：
 * 1. 提交快照与版本绑定；
 * 2. 改文稿只标记失配，不自动重新收费；
 * 3. 任务完成回填至当前 EditorDocument；
 * 4. 任务历史清理不破坏工程内已绑定的音频资产。
 */

import type { EditorDocument, AudioClipElement, ProjectAsset } from '../../../../packages/video-editor/src/core/project.ts'
import type { TimeUs } from '../../../../packages/video-editor/src/core/time.ts'
import { writeCaptionSegmentsToDocument } from '../../../../packages/video-editor/src/panels/captions/sync-text-track.ts'
import { buildAlignedTimeline } from '../lib/timeline-engine.ts'

export type ScriptAudioSnapshot = {
  scriptText: string
  voiceId: string
  speedRate: number
  submittedAt: number
  version: number
  taskId?: string
}

export type TtsBindingState = {
  snapshot?: ScriptAudioSnapshot
  isMismatched: boolean
  hasAudio: boolean
  audioDurationUs?: TimeUs
}

/**
 * 标准化文稿文本（清理首尾空白，保留内部真实换行）
 */
export function normalizeScriptText(text: string): string {
  if (!text) return ''
  return text.trim()
}

/**
 * 校验当前文稿与已绑定的配音快照是否一致
 * 若用户修改了文稿，只标失配，绝不自动重新发起收费任务
 */
export function checkScriptMismatch(
  currentScript: string,
  snapshot?: ScriptAudioSnapshot
): boolean {
  if (!snapshot) return false
  const currentNorm = normalizeScriptText(currentScript)
  const snapshotNorm = normalizeScriptText(snapshot.scriptText)
  return currentNorm !== snapshotNorm
}

/**
 * 将配音产物回填至工程文档中
 * 无论外部任务中心的任务记录是否被清理，工程内部的 Asset 和 Track 元素完全独立自洽
 */
export function applyTtsResultToDocument(
  document: EditorDocument,
  input: {
    audioBlob: Blob
    audioDurationUs: TimeUs
    snapshot: ScriptAudioSnapshot
    voiceLabel?: string
  }
): EditorDocument {
  const { audioBlob, audioDurationUs, snapshot, voiceLabel } = input
  const doc = JSON.parse(JSON.stringify(document)) as EditorDocument

  const assetId = `asset-tts-${crypto.randomUUID()}`
  const asset: ProjectAsset = {
    id: assetId,
    kind: 'audio',
    name: `配音_${voiceLabel || snapshot.voiceId}_${formatDate(snapshot.submittedAt)}`,
    mimeType: audioBlob.type || 'audio/mp3',
    sizeBytes: audioBlob.size,
    durationUs: audioDurationUs,
    createdAt: Date.now(),
    sourceVersionId: `tts-v${snapshot.version}`,
  }

  // 1. 挂入工程独立素材表（即使外部任务记录被清空，工程资产库依然保留）
  if (!doc.assets) doc.assets = {}
  doc.assets[assetId] = asset

  // 2. 查找或建立配音音频轨
  let audioTrack = doc.tracks.find((t) => t.id === 'track-voice-audio' || (t.type === 'audio' && t.name.includes('配音')))
  if (!audioTrack) {
    audioTrack = {
      id: 'track-voice-audio',
      type: 'audio',
      name: '文稿配音轨',
      muted: false,
      solo: false,
      hidden: false,
      locked: false,
      elements: [],
    }
    doc.tracks.push(audioTrack)
  }

  // 3. 填入音频片段
  const clipId = `clip-voice-${crypto.randomUUID()}`
  const audioClip: AudioClipElement = {
    id: clipId,
    trackId: audioTrack.id,
    type: 'audio',
    assetId,
    startUs: 0,
    durationUs: audioDurationUs,
    sourceInUs: 0,
    sourceOutUs: audioDurationUs,
    rate: 1,
    volume: 1,
  }

  // 清除旧配音，放入新配音
  audioTrack.elements = [audioClip]

  // 4. 按真实配音时长 + 字重估时切句，双写 CaptionCue 与「字幕」文字轨（非均分固定秒）
  const normalizedText = normalizeScriptText(snapshot.scriptText)
  if (normalizedText.length > 0 && audioDurationUs > 0) {
    const aligned = buildAlignedTimeline(normalizedText, audioDurationUs / 1_000_000)
    writeCaptionSegmentsToDocument(
      doc,
      aligned.sentences.map((sentence) => ({
        text: sentence.text,
        startUs: Math.round(sentence.start * 1_000_000),
        durationUs: Math.max(33_333, Math.round((sentence.end - sentence.start) * 1_000_000)),
        timingSource: 'estimated' as const,
        boundClipId: clipId,
      })),
      { boundClipId: clipId, timingSource: 'estimated' },
    )
  }

  // 5. 自动拓展工程总时长
  if (audioDurationUs > doc.durationUs) {
    doc.durationUs = audioDurationUs
  }

  return doc
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}${d.getDate()}_${d.getHours()}${d.getMinutes()}`
}
