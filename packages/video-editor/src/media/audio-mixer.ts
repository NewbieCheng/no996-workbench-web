/** 多轨离线混音：显式音轨与视频原声共用源时间映射、静音和音量规则。 */
import type { EditorDocument, AudioClipElement, VideoClipElement } from '../core/project.ts'
import { mapPlaybackToSourceTimeUs } from '../core/speed/mapping.ts'
import { evaluateAudioGain } from '../render/evaluator.ts'
import {
  AUDIO_SAMPLE_RATE, abortable, createPCM, decodeAudioPCM,
  softClip, throwIfAborted, yieldTask, type PCM,
} from './pcm.ts'

export type AudioAssetResolver = (assetId: string) => Promise<Blob | null>
export type MixOptions = { totalDurationUs?: number; sampleRate?: number; signal?: AbortSignal }
type AudibleClip = AudioClipElement | VideoClipElement

/** 未声明 hasAudio 的视频必须尝试解码，只有明确 false 才可视为无声。 */
export function collectDocumentAudioClips(doc: EditorDocument): AudibleClip[] {
  const hasSolo = doc.tracks.some((track) => track.solo && !track.muted)
  const clips = doc.tracks.flatMap((track) => {
    if (track.muted || (hasSolo && !track.solo)) return []
    return track.elements.filter((elem): elem is AudibleClip =>
      (elem.type === 'audio' || (elem.type === 'video' && doc.assets[elem.assetId]?.hasAudio !== false)) &&
      elem.durationUs > 0 && ((elem.volume ?? 1) > 0 || Boolean(elem.animations?.channels?.volume)) && elem.startUs < doc.durationUs,
    )
  })
  const sameSource = (a: AudibleClip, b: AudibleClip) => a.assetId === b.assetId || (
    Boolean(doc.assets[a.assetId]?.blobId) && doc.assets[a.assetId]?.blobId === doc.assets[b.assetId]?.blobId
  )
  // 分离音频后若原视频尚未静音，显式音轨优先，避免同一原声叠加两遍。
  return clips.filter((clip) => clip.type !== 'video' || !clips.some((other) =>
    other.type === 'audio' && sameSource(clip, other) &&
    other.startUs === clip.startUs && other.durationUs === clip.durationUs &&
    other.sourceInUs === clip.sourceInUs && other.sourceOutUs === clip.sourceOutUs &&
    other.rate === clip.rate && Boolean(other.reverse) === Boolean(clip.reverse) &&
    other.freeze?.sourceTimeUs === clip.freeze?.sourceTimeUs,
  ))
}

/** 素材缺失、解码失败必须终止导出；全静音工程才返回静音 PCM。 */
export async function mixDocumentAudio(
  doc: EditorDocument,
  resolveAsset: AudioAssetResolver,
  options: MixOptions = {},
): Promise<PCM> {
  const { signal } = options
  const sampleRate = options.sampleRate ?? AUDIO_SAMPLE_RATE
  const totalUs = options.totalDurationUs ?? doc.durationUs
  throwIfAborted(signal)
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(totalUs) || totalUs <= 0) {
    throw new Error('音频输出时长或采样率无效')
  }
  const totalSamples = Math.max(1, Math.ceil(totalUs / 1_000_000 * sampleRate))
  const channels = [new Float32Array(totalSamples), new Float32Array(totalSamples)]
  const decoded = new Map<string, PCM>()
  for (const element of collectDocumentAudioClips(doc)) {
    throwIfAborted(signal)
    const asset = doc.assets[element.assetId]
    const key = asset?.blobId || element.assetId
    let pcm = decoded.get(key)
    if (!pcm) {
      try {
        const blob = await abortable(resolveAsset(element.assetId), signal)
        if (!blob?.size) throw new Error('媒体文件缺失或为空')
        pcm = await decodeAudioPCM(blob, signal)
        decoded.set(key, pcm)
      } catch (error) {
        throwIfAborted(signal)
        throw new Error(`音频素材「${asset?.name || element.assetId}」无法读取或解码：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const gainElement: AudioClipElement = { ...element, type: 'audio' }
    const start = Math.max(0, Math.ceil(element.startUs / 1_000_000 * sampleRate))
    const end = Math.min(totalSamples, Math.ceil((element.startUs + element.durationUs) / 1_000_000 * sampleRate))
    for (let index = start; index < end; index++) {
      if ((index - start) % 16_384 === 0) await yieldTask(signal)
      const localUs = index / sampleRate * 1_000_000 - element.startUs
      const sourceUs = mapPlaybackToSourceTimeUs(element, localUs)
      // sourceOut 是半开区间，反放起点落在边界时取最后一个源采样。
      const position = Math.min(pcm.length - 1, sourceUs / 1_000_000 * pcm.sampleRate)
      if (sourceUs < 0 || sourceUs > pcm.length / pcm.sampleRate * 1_000_000 + 1 || position < 0) continue
      const base = Math.floor(position)
      const fraction = position - base
      const gain = evaluateAudioGain(gainElement, localUs)
      for (let channel = 0; channel < 2; channel++) {
        const source = pcm.channels[channel] ?? pcm.channels[0]
        const a = source[base] ?? 0
        const b = source[Math.min(base + 1, pcm.length - 1)] ?? a
        channels[channel][index] += (a + (b - a) * fraction) * gain
      }
    }
  }
  decoded.clear()
  for (let index = 0; index < totalSamples; index++) {
    if (index % 65_536 === 0) await yieldTask(signal)
    channels[0][index] = softClip(channels[0][index])
    channels[1][index] = softClip(channels[1][index])
  }
  throwIfAborted(signal)
  return createPCM(channels, sampleRate)
}

export function gainAt(element: AudioClipElement, localTimeUs: number): number {
  return evaluateAudioGain(element, localTimeUs)
}
