import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AudioLines } from 'lucide-react'
import { InstructionPopover } from './InstructionPopover'
import { ParamPopover } from './ParamPopover'
import {
  TTS_DEMO_TEXT,
  TTS_INPUT_MAX,
  TTS_PITCH,
  TTS_RATE,
  TTS_VOLUME,
  estimateSpeechSeconds,
  formatMmSs,
} from '../voice-constants'
import type { TtsParams } from '../hooks/useTtsSession'

type Props = {
  text: string
  onTextChange: (v: string) => void
  params: TtsParams
  onParamsChange: (patch: Partial<TtsParams>) => void
  busy: boolean
  onGenerate: () => void
}

export function TtsStage({ text, onTextChange, params, onParamsChange, busy, onGenerate }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useLayoutEffect(() => {
    syncTextareaHeight()
  }, [text, syncTextareaHeight])

  useEffect(() => {
    const onResize = () => syncTextareaHeight()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [syncTextareaHeight])

  const charCount = text.length
  const est = formatMmSs(estimateSpeechSeconds(charCount, params.rate))

  const popovers = [
    {
      key: 'rate',
      label: '语速',
      min: TTS_RATE.min,
      max: TTS_RATE.max,
      step: TTS_RATE.step,
      value: params.rate,
      onChange: (v: number) => onParamsChange({ rate: v }),
      formatDisplay: (v: number) => `${v.toFixed(1)}×`,
      presets: [
        { value: 0.8, label: '慢' },
        { value: 1, label: '正常' },
        { value: 1.3, label: '快' },
      ],
      ends: ['慢', '快'] as [string, string],
    },
    {
      key: 'volume',
      label: '音量',
      min: TTS_VOLUME.min,
      max: TTS_VOLUME.max,
      step: TTS_VOLUME.step,
      value: params.volume,
      onChange: (v: number) => onParamsChange({ volume: v }),
      formatDisplay: (v: number) => (v === 0 ? '静音' : String(v)),
      presets: [
        { value: 0, label: '静音' },
        { value: 50, label: '正常' },
        { value: 80, label: '响' },
      ],
      ends: ['轻', '响'] as [string, string],
    },
    {
      key: 'pitch',
      label: '音调',
      min: TTS_PITCH.min,
      max: TTS_PITCH.max,
      step: TTS_PITCH.step,
      value: params.pitch,
      onChange: (v: number) => onParamsChange({ pitch: v }),
      formatDisplay: (v: number) => `${v.toFixed(1)}×`,
      presets: [
        { value: 0.8, label: '低' },
        { value: 1, label: '正常' },
        { value: 1.2, label: '高' },
      ],
      ends: ['低', '高'] as [string, string],
    },
  ]

  return (
    <section className="voice-section" aria-label="文案">
    <div className="voice-block-head">
      <b>文案</b>
      <small>最多 {TTS_INPUT_MAX.toLocaleString('zh-CN')} 字</small>
    </div>
    <div className="voice-stage">
      <textarea
        ref={textareaRef}
        className="voice-stage__textarea"
        value={text}
        maxLength={TTS_INPUT_MAX}
        placeholder="在这里输入需要朗读的文字…"
        aria-label="配音文案"
        disabled={busy}
        rows={1}
        onChange={(e) => {
          onTextChange(e.target.value)
          syncTextareaHeight()
        }}
      />
      <div className="voice-hint-row">
        <button
          type="button"
          className="voice-chip"
          disabled={busy}
          onClick={() => onTextChange(TTS_DEMO_TEXT)}
        >
          填入示例
        </button>
        <button
          type="button"
          className="voice-chip"
          disabled={busy}
          onClick={() => onTextChange('')}
        >
          清空
        </button>
      </div>
      <div className="voice-dock">
        {popovers.map((p) => (
          <ParamPopover
            key={p.key}
            config={p}
            open={openKey === p.key}
            onOpenChange={(open) => setOpenKey(open ? p.key : null)}
          />
        ))}
        <InstructionPopover
          value={params.instruction}
          disabled={busy}
          open={openKey === 'instruction'}
          onOpenChange={(open) => setOpenKey(open ? 'instruction' : null)}
          onChange={(instruction) => onParamsChange({ instruction })}
        />
        <span className="voice-dock__spacer" />
        <span className="voice-dock__count">
          {charCount} 字 · 约 {est}
        </span>
        <button
          type="button"
          className="voice-btn-primary voice-dock__submit"
          disabled={busy || !text.trim()}
          aria-label={busy ? '正在提交生成任务' : '加入生成队列'}
          onClick={onGenerate}
        >
          <AudioLines size={15} aria-hidden className="voice-dock__submit-icon" />
          <span className="voice-dock__submit-label">{busy ? '提交中…' : '生成'}</span>
        </button>
      </div>
    </div>
    </section>
  )
}
