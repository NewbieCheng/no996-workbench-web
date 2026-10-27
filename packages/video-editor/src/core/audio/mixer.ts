/**
 * 多轨音频混音、Mute/Solo 判定与峰值软限幅纯数学算法
 */

import type { TimelineTrack, AudioClipElement } from '../project.ts'
import type { TimeUs } from '../time.ts'
import { evaluateAudioGain } from '../../render/evaluator.ts'

export type AudioSourceSample = {
  elementId: string
  trackId: string
  gain: number
  sampleValue: number // 原始音频采样值（归一化 -1.0 到 1.0）
}

export type MixedAudioFrame = {
  timeUs: TimeUs
  activeSources: AudioSourceSample[]
  rawSum: number
  limitedOutput: number // 软限幅后的最终输出采样值 (-1.0 到 1.0)
}

/**
 * 软限幅算法 (Soft-Clipping Peak Limiter)
 * 防止多轨混音叠加超过 1.0 产生硬件破音
 */
export function softClipLimiter(sample: number): number {
  if (sample > 1.0) {
    return (2 / Math.PI) * Math.atan(sample * (Math.PI / 2))
  }
  if (sample < -1.0) {
    return (2 / Math.PI) * Math.atan(sample * (Math.PI / 2))
  }
  return sample
}

/**
 * 判定轨道是否允许出声（Solo 优先级高于 Mute）
 */
export function isTrackAudible(track: TimelineTrack, allTracks: TimelineTrack[]): boolean {
  if (track.type !== 'audio' && track.type !== 'video') return false

  const hasAnySolo = allTracks.some((t) => t.solo === true)
  if (hasAnySolo) {
    return track.solo === true
  }

  return !track.muted
}

/**
 * 计算多轨音频在特定时刻的混音采样
 * generator: 模拟真实 PCM 样本发生器，默认生成可预测的正弦波/指定振幅
 */
export function mixAudioTracksAtTime(
  tracks: TimelineTrack[],
  timeUs: TimeUs,
  generator?: (element: AudioClipElement, localTimeUs: TimeUs) => number
): MixedAudioFrame {
  const activeSources: AudioSourceSample[] = []

  for (const track of tracks) {
    if (!isTrackAudible(track, tracks)) continue

    for (const elem of track.elements) {
      if (elem.type !== 'audio') continue
      const audioElem = elem as AudioClipElement

      if (timeUs >= audioElem.startUs && timeUs < audioElem.startUs + audioElem.durationUs) {
        const localTimeUs = timeUs - audioElem.startUs
        const gain = evaluateAudioGain(audioElem, localTimeUs)

        // 默认生成 440Hz 标准测试正弦波，方便自动化数学断言
        let sampleValue = 0
        if (generator) {
          sampleValue = generator(audioElem, localTimeUs)
        } else {
          const tSec = localTimeUs / 1_000_000
          sampleValue = Math.sin(2 * Math.PI * 440 * tSec)
        }

        activeSources.push({
          elementId: audioElem.id,
          trackId: track.id,
          gain,
          sampleValue,
        })
      }
    }
  }

  // 线性加权求和
  let rawSum = 0
  for (const src of activeSources) {
    rawSum += src.sampleValue * src.gain
  }

  const limitedOutput = softClipLimiter(rawSum)

  return {
    timeUs,
    activeSources,
    rawSum,
    limitedOutput,
  }
}
