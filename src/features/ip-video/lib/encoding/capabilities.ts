import { canEncodeAudio, canEncodeVideo, Quality } from 'mediabunny'
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from '../template-project.ts'
import { AUDIO_BITRATE, FRAME_RATE, VIDEO_BITRATE, abortable, chooseEncoding, throwIfAborted, type EncodingChoice } from './policy.ts'

export type AudioShape = { sampleRate: number; numberOfChannels: number }
export async function detectEncoding(audio?: AudioShape, signal?: AbortSignal): Promise<EncodingChoice | null> {
  throwIfAborted(signal)
  if (typeof globalThis.VideoEncoder !== 'function' || typeof globalThis.VideoFrame !== 'function' || (audio && (typeof globalThis.AudioEncoder !== 'function' || typeof globalThis.AudioData !== 'function'))) return null
  const videoQuality = new Quality({ bitrate: VIDEO_BITRATE })
  const audioQuality = new Quality({ bitrate: AUDIO_BITRATE })
  return abortable(chooseEncoding(
    codec => canEncodeVideo(codec, { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, frameRate: FRAME_RATE, quality: videoQuality, latencyMode: 'quality' }),
    audio ? codec => canEncodeAudio(codec, { ...audio, quality: audioQuality }) : undefined
  ), signal)
}
