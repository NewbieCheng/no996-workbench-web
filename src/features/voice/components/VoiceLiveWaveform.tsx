import { useEffect, useRef } from 'react'

const BAR_COUNT = 24
const MIN_HZ = 60
const MAX_HZ = 10_000

type Props = {
  analyser: AnalyserNode | null
  active: boolean
  className?: string
  /** 深色录音台内：浅色柱 / 空闲时点阵 */
  tone?: 'default' | 'deck'
}

function readCssColor(token: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return v || fallback
}

/** 对数刻度：每根柱对应一段频带，取该段内峰值（人声基频+谐波会铺满多段） */
function bandLevels(freqBuf: Uint8Array, sampleRate: number): number[] {
  const nyquist = sampleRate / 2
  const maxF = Math.min(MAX_HZ, nyquist * 0.98)
  const levels: number[] = []

  for (let i = 0; i < BAR_COUNT; i++) {
    const t0 = i / BAR_COUNT
    const t1 = (i + 1) / BAR_COUNT
    const f0 = MIN_HZ * (maxF / MIN_HZ) ** t0
    const f1 = MIN_HZ * (maxF / MIN_HZ) ** t1
    const b0 = Math.max(0, Math.floor((f0 / nyquist) * freqBuf.length))
    const b1 = Math.min(freqBuf.length, Math.max(b0 + 1, Math.ceil((f1 / nyquist) * freqBuf.length)))

    let peak = 0
    for (let b = b0; b < b1; b++) {
      peak = Math.max(peak, freqBuf[b] / 255)
    }
    levels.push(peak)
  }
  return levels
}

export function VoiceLiveWaveform({ analyser, active, className, tone = 'default' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)

    const freqBuf = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
    const timeBuf = new Float32Array(analyser.fftSize)
    const sampleRate = analyser.context.sampleRate

    const tick = () => {
      analyser.getByteFrequencyData(freqBuf as Uint8Array<ArrayBuffer>)
      analyser.getFloatTimeDomainData(timeBuf)

      let rms = 0
      for (let i = 0; i < timeBuf.length; i++) {
        rms += timeBuf[i] * timeBuf[i]
      }
      rms = Math.sqrt(rms / timeBuf.length)

      const bands = bandLevels(freqBuf, sampleRate)
      const loudness = Math.min(1, rms * 4)

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w <= 0 || h <= 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      ctx.clearRect(0, 0, w, h)
      const gap = 2
      const barW = Math.max(2, (w - gap * (BAR_COUNT - 1)) / BAR_COUNT)
      const fill =
        tone === 'deck'
          ? active
            ? '#ffb347'
            : 'rgba(255, 255, 255, 0.35)'
          : readCssColor('--destructive', '#dc2626')

      for (let i = 0; i < BAR_COUNT; i++) {
        const band = bands[i]
        const amp = active
          ? Math.min(1, band * 2.2 + loudness * 0.35)
          : tone === 'deck'
            ? 0.12
            : 0.08
        const barH = Math.max(tone === 'deck' && !active ? 4 : 3, amp * h * 0.96)
        const x = i * (barW + gap)
        const y = h - barH

        ctx.fillStyle = fill
        ctx.beginPath()
        ctx.roundRect(x, y, barW, barH, 1.5)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [active, analyser])

  const rootClass = ['voice-live-waveform', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} aria-hidden={!active} data-active={active ? '1' : '0'}>
      <canvas ref={canvasRef} className="voice-live-waveform__canvas" />
    </div>
  )
}
