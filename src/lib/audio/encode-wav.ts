/**
 * 将 AudioBuffer 编码为 16-bit PCM WAV（默认混音为单声道，便于声音复刻上传）。
 */

function mixToMono(buffer: AudioBuffer): Float32Array {
  const { length, numberOfChannels } = buffer
  const mono = new Float32Array(length)
  if (numberOfChannels === 1) {
    mono.set(buffer.getChannelData(0))
    return mono
  }
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / numberOfChannels
    }
  }
  return mono
}

function floatTo16BitPcm(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

export function audioBufferToWav(buffer: AudioBuffer, mono = true): ArrayBuffer {
  const samples = mono ? mixToMono(buffer) : buffer.getChannelData(0)
  const pcm = floatTo16BitPcm(samples)
  const numChannels = mono ? 1 : buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.byteLength
  const headerSize = 44
  const total = headerSize + dataSize
  const out = new ArrayBuffer(total)
  const view = new DataView(out)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, total - 8, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  new Int16Array(out, 44).set(pcm)
  return out
}

export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext()
  try {
    const arrayBuffer = await blob.arrayBuffer()
    return await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await ctx.close().catch(() => {})
  }
}

export async function blobToWavFile(blob: Blob, baseName: string): Promise<File> {
  const decoded = await decodeAudioBlob(blob)
  const wav = audioBufferToWav(decoded, true)
  const safeName = baseName.replace(/\.[^.]+$/, '') || 'voice-sample'
  return new File([wav], `${safeName}.wav`, { type: 'audio/wav' })
}

/** 浏览器录音 WebM/OGG → WAV；MP3/WAV/M4A 原样提交（与复刻接口常见格式一致）。 */
export async function normalizeCloneSampleFile(file: File): Promise<File> {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  const isWebm =
    type === 'audio/webm' || type.startsWith('audio/webm;') || name.endsWith('.webm')
  const isOgg = type === 'audio/ogg' || name.endsWith('.ogg')
  if (!isWebm && !isOgg) return file
  return blobToWavFile(file, file.name)
}
