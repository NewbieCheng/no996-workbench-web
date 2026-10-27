/**
 * 节拍检测
 *
 * 用途：给时间轴提供「音乐节拍网格」吸附点，让镜头切换卡在鼓点上。
 *
 * 算法（纯确定性，无随机、无模型）：
 *   1. 解码成单声道 PCM
 *   2. 按 20ms 窗算能量，再做一阶差分得到「能量上升量」——鼓点处上升最猛
 *   3. 去均值后做自相关，在 60–180 BPM 范围内找峰值 → 得到周期
 *   4. 以最强上升点为锚，向外展开成整段网格
 *
 * 已知局限：自相关在弱节拍或半拍/双拍歧义上会给出错误 BPM。
 * 因此界面上必须标注「估算」，并且吸附默认关闭，由用户主动开启。
 */

export type BeatAnalysis = {
  /** 每分钟拍数，已约束在 60–180 */
  bpm: number
  /** 每拍的间隔（微秒） */
  beatIntervalUs: number
  /** 首个节拍的时间（微秒），用于对齐网格相位 */
  firstBeatUs: number
  /** 整段网格上的节拍时间点（微秒） */
  beatsUs: number[]
  /** 估算置信度 0–1；越低越不该信 */
  confidence: number
}

const BPM_MIN = 60
const BPM_MAX = 180
/** 能量窗长度：20ms，足够区分鼓点又不会太碎 */
const WINDOW_SECONDS = 0.02

/** 任意 AudioBuffer（已解码）→ 单声道能量包络 */
export function energyEnvelope(buffer: AudioBuffer, windowSeconds = WINDOW_SECONDS): Float64Array {
  const rate = buffer.sampleRate
  const windowSize = Math.max(1, Math.round(windowSeconds * rate))
  const frames = Math.floor(buffer.length / windowSize)
  const channels = Math.min(2, buffer.numberOfChannels)
  const result = new Float64Array(Math.max(0, frames))

  // 预取各声道数据，避免双层循环里反复调 getChannelData
  const data: Float32Array[] = []
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c))

  for (let frame = 0; frame < frames; frame++) {
    const start = frame * windowSize
    const end = start + windowSize
    let sum = 0
    for (const channel of data) {
      for (let i = start; i < end; i++) {
        const v = channel[i] ?? 0
        sum += v * v
      }
    }
    result[frame] = Math.sqrt(sum / (windowSize * channels))
  }
  return result
}

/** 一阶差分（只保留上升沿），鼓点检测靠在上升沿上找峰值 */
export function onsetStrength(envelope: Float64Array): Float64Array {
  const result = new Float64Array(envelope.length)
  for (let i = 1; i < envelope.length; i++) {
    const diff = envelope[i] - envelope[i - 1]
    result[i] = diff > 0 ? diff : 0
  }
  return result
}

/** 归一化自相关，只在给定 lag 范围内求值 */
function autocorrelation(signal: Float64Array, minLag: number, maxLag: number): Float64Array {
  const n = signal.length
  let mean = 0
  for (let i = 0; i < n; i++) mean += signal[i]
  mean /= n || 1

  const centered = new Float64Array(n)
  let energy = 0
  for (let i = 0; i < n; i++) {
    centered[i] = signal[i] - mean
    energy += centered[i] * centered[i]
  }
  if (energy <= 1e-12) return new Float64Array(maxLag - minLag + 1)

  const result = new Float64Array(maxLag - minLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = lag; i < n; i++) sum += centered[i] * centered[i - lag]
    result[lag - minLag] = sum / energy
  }
  return result
}

/**
 * 主入口：已解码的 AudioBuffer → 节拍分析。
 * 返回 null 表示这段音频没有可用的节拍（静音、纯人声、或能量太弱）。
 */
export function analyzeBeats(
  buffer: AudioBuffer,
  options: { minBpm?: number; maxBpm?: number } = {},
): BeatAnalysis | null {
  const minBpm = options.minBpm ?? BPM_MIN
  const maxBpm = options.maxBpm ?? BPM_MAX
  const envelope = energyEnvelope(buffer)
  if (envelope.length < 8) return null

  // 整段太安静就别硬报节拍
  let peak = 0
  for (const v of envelope) peak = Math.max(peak, v)
  if (peak < 1e-4) return null

  const onset = onsetStrength(envelope)
  const framesPerSecond = 1 / WINDOW_SECONDS
  // 拍间隔对应的帧数范围：60 BPM = 1s/拍，180 BPM = 0.333s/拍
  const minLag = Math.max(1, Math.round(framesPerSecond * (60 / maxBpm)))
  const maxLag = Math.min(onset.length - 1, Math.round(framesPerSecond * (60 / minBpm)))
  if (maxLag <= minLag) return null

  const acf = autocorrelation(onset, minLag, maxLag)
  let bestIndex = 0
  let bestValue = -Infinity
  for (let i = 0; i < acf.length; i++) {
    if (acf[i] > bestValue) {
      bestValue = acf[i]
      bestIndex = i
    }
  }
  if (!Number.isFinite(bestValue) || bestValue <= 0.05) return null

  const bestLag = minLag + bestIndex
  const bpm = (60 * framesPerSecond) / bestLag
  if (!Number.isFinite(bpm) || bpm < minBpm || bpm > maxBpm) return null

  const beatIntervalUs = Math.round((bestLag / framesPerSecond) * 1_000_000)

  // 相位：在第一个拍周期的范围内找上升最强的位置作为首拍
  let anchorFrame = 0
  let anchorValue = -Infinity
  for (let i = 0; i < Math.min(bestLag, onset.length); i++) {
    if (onset[i] > anchorValue) {
      anchorValue = onset[i]
      anchorFrame = i
    }
  }
  const firstBeatUs = Math.round((anchorFrame / framesPerSecond) * 1_000_000)

  // 展开整段网格
  const totalUs = Math.round(buffer.duration * 1_000_000)
  const beatsUs: number[] = []
  // 先补首拍之前的拍点（可能为负，裁掉）
  for (let t = firstBeatUs; t <= totalUs; t += beatIntervalUs) {
    if (t >= 0) beatsUs.push(t)
  }

  // 置信度：自相关峰值高度，映射到 0–1 并做温和缩放
  const confidence = Math.max(0, Math.min(1, bestValue * 1.6))

  return { bpm: Math.round(bpm * 10) / 10, beatIntervalUs, firstBeatUs, beatsUs, confidence }
}

/**
 * 从 PCM Blob 检测节拍。主线程解码（Worker 拿不到 AudioContext）。
 */
export async function detectBeatsFromBlob(blob: Blob, signal?: AbortSignal): Promise<BeatAnalysis | null> {
  const Offline = globalThis.OfflineAudioContext
  const Realtime = globalThis.AudioContext
  if (!Offline && !Realtime) return null
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError')

  const context = Offline ? new Offline(2, 1, 48_000) : new Realtime({ sampleRate: 48_000 })
  try {
    const bytes = await blob.arrayBuffer()
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError')
    const buffer = await context.decodeAudioData(bytes)
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError')
    return analyzeBeats(buffer)
  } finally {
    if ('close' in context && context.state !== 'closed') {
      void context.close().catch(() => undefined)
    }
  }
}

/**
 * 把节拍网格混进已有的吸附参考点。
 * 节拍点优先级低于片段边界 —— 用户裁好的边界不该被拍点抢走。
 */
export function mergeBeatPoints(referencePoints: number[], beatsUs: number[], maxPoints = 4000): number[] {
  if (!beatsUs.length) return referencePoints
  // 太长的时间轴不必把每一拍都塞进去，按比例抽稀，避免吸附计算变成瓶颈
  const step = Math.max(1, Math.ceil(beatsUs.length / maxPoints))
  const merged = new Set(referencePoints)
  for (let i = 0; i < beatsUs.length; i += step) merged.add(beatsUs[i])
  return Array.from(merged).sort((a, b) => a - b)
}
