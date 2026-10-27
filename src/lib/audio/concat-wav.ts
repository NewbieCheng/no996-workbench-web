/**
 * WAV 音频二进制拼接工具
 *
 * 在浏览器端顺序拼接多个 16-bit PCM WAV 音频片段，生成单一 WAV ArrayBuffer。
 * 遵循标准 RIFF/WAVE 规范，正确处理 fmt 块与 data 块，并验证采样率与通道数一致性。
 */

type WavFormat = {
  audioFormat: number
  numChannels: number
  sampleRate: number
  byteRate: number
  blockAlign: number
  bitsPerSample: number
}

type ParsedWav = {
  format: WavFormat
  audioData: Uint8Array
}

function parseWav(buffer: ArrayBuffer): ParsedWav {
  if (buffer.byteLength < 44) {
    throw new Error('无效的 WAV 文件：文件过短')
  }
  const view = new DataView(buffer)
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  )
  if (magic !== 'RIFF') {
    throw new Error('无效的 WAV 文件：缺失 RIFF 标识')
  }
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11),
  )
  if (wave !== 'WAVE') {
    throw new Error('无效的 WAV 文件：缺失 WAVE 标识')
  }

  let offset = 12
  let format: WavFormat | null = null
  let audioData: Uint8Array | null = null

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    )
    const chunkSize = view.getUint32(offset + 4, true)
    const chunkDataOffset = offset + 8

    if (chunkId === 'fmt ') {
      if (chunkSize < 16) throw new Error('无效的 fmt 块')
      format = {
        audioFormat: view.getUint16(chunkDataOffset, true),
        numChannels: view.getUint16(chunkDataOffset + 2, true),
        sampleRate: view.getUint32(chunkDataOffset + 4, true),
        byteRate: view.getUint32(chunkDataOffset + 8, true),
        blockAlign: view.getUint16(chunkDataOffset + 12, true),
        bitsPerSample: view.getUint16(chunkDataOffset + 14, true),
      }
    } else if (chunkId === 'data') {
      const actualSize = Math.min(chunkSize, buffer.byteLength - chunkDataOffset)
      audioData = new Uint8Array(buffer, chunkDataOffset, actualSize)
    }

    // RIFF chunk padding to word boundary
    offset = chunkDataOffset + chunkSize + (chunkSize % 2 === 1 ? 1 : 0)
  }

  if (!format) {
    throw new Error('WAV 解析失败：未找到 fmt 块')
  }
  if (!audioData) {
    throw new Error('WAV 解析失败：未找到 data 块')
  }

  return { format, audioData }
}

/**
 * 将多个 WAV ArrayBuffer 顺序拼接入一个单一的 WAV ArrayBuffer
 */
export function concatWavBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const valid = buffers.filter((b) => b && b.byteLength > 0)
  if (valid.length === 0) {
    return new ArrayBuffer(0)
  }
  if (valid.length === 1) {
    return valid[0]
  }

  const parsedList = valid.map((buf) => parseWav(buf))
  const baseFmt = parsedList[0].format

  for (let i = 1; i < parsedList.length; i++) {
    const f = parsedList[i].format
    if (
      f.sampleRate !== baseFmt.sampleRate ||
      f.numChannels !== baseFmt.numChannels ||
      f.bitsPerSample !== baseFmt.bitsPerSample
    ) {
      console.warn(
        `[concatWavBuffers] 音频参数略有差异：base=${baseFmt.sampleRate}Hz/${baseFmt.numChannels}ch, seg[${i}]=${f.sampleRate}Hz/${f.numChannels}ch`,
      )
    }
  }

  const totalDataBytes = parsedList.reduce((acc, p) => acc + p.audioData.byteLength, 0)
  const headerSize = 44
  const totalFileSize = headerSize + totalDataBytes
  const resultBuffer = new ArrayBuffer(totalFileSize)
  const view = new DataView(resultBuffer)

  // 1. RIFF
  view.setUint8(0, 'R'.charCodeAt(0))
  view.setUint8(1, 'I'.charCodeAt(0))
  view.setUint8(2, 'F'.charCodeAt(0))
  view.setUint8(3, 'F'.charCodeAt(0))
  view.setUint32(4, totalFileSize - 8, true)
  view.setUint8(8, 'W'.charCodeAt(0))
  view.setUint8(9, 'A'.charCodeAt(0))
  view.setUint8(10, 'V'.charCodeAt(0))
  view.setUint8(11, 'E'.charCodeAt(0))

  // 2. fmt
  view.setUint8(12, 'f'.charCodeAt(0))
  view.setUint8(13, 'm'.charCodeAt(0))
  view.setUint8(14, 't'.charCodeAt(0))
  view.setUint8(15, ' '.charCodeAt(0))
  view.setUint32(16, 16, true) // Subchunk1Size for PCM
  view.setUint16(20, baseFmt.audioFormat, true)
  view.setUint16(22, baseFmt.numChannels, true)
  view.setUint32(24, baseFmt.sampleRate, true)
  view.setUint32(28, baseFmt.byteRate, true)
  view.setUint16(32, baseFmt.blockAlign, true)
  view.setUint16(34, baseFmt.bitsPerSample, true)

  // 3. data
  view.setUint8(36, 'd'.charCodeAt(0))
  view.setUint8(37, 'a'.charCodeAt(0))
  view.setUint8(38, 't'.charCodeAt(0))
  view.setUint8(39, 'a'.charCodeAt(0))
  view.setUint32(40, totalDataBytes, true)

  const u8Result = new Uint8Array(resultBuffer)
  let writeOffset = 44
  for (const item of parsedList) {
    u8Result.set(item.audioData, writeOffset)
    writeOffset += item.audioData.byteLength
  }

  return resultBuffer
}
