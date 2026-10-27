import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorDocument } from '@no996/video-editor'
import { buildRenderPlan, sceneAtTime } from '@no996/video-editor/render/plan.ts'
import { renderSceneToCanvas } from '@no996/video-editor/render/compositor.ts'
import { Button } from '@no996/ui/button'
import { HoverTip } from '@no996/ui/tooltip'
import { CAPTION_FONTS, captionFontByFamily, loadCaptionFont } from '../editor/caption-fonts'
import { TALK_CAPTION_PRESETS, matchingTalkPreset, type TalkCaptionPreset } from './talk-caption-presets'
import { useTemplateCopy } from './templates/copy'

export function TalkStyleLibrary({ busy, onApply, livePreview = true }: { busy: boolean; onApply: (id: string) => void; livePreview?: boolean }) {
  const doc = useEditorDocument()
  const [selected, setSelected] = useState(() => matchingTalkPreset(doc.captionStyle)?.id ?? 'studio')
  const [category, setCategory] = useState('全部')
  const { copy } = useTemplateCopy()
  const preset = TALK_CAPTION_PRESETS.find(item => item.id === selected) ?? TALK_CAPTION_PRESETS[0]
  const categories = ['全部', ...new Set(TALK_CAPTION_PRESETS.map(item => item.category))]
  return <div className="ipt-style-library" data-live-preview={livePreview}>
    <p className="ipt-help">{CAPTION_FONTS.length} 款本地字体、{TALK_CAPTION_PRESETS.length} 套字幕组合。点选先看示意，应用只改字幕，不移动人物或重新生成配音。</p>
    <div className="ipt-style-filters" role="group" aria-label="字幕风格分类">{categories.map(item => <Button key={item} size="sm" variant="ghost" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}</div>
    <div className="ipt-style-library__body">
      <div className="ipt-style-options" role="group" aria-label="选择字幕风格">{TALK_CAPTION_PRESETS.filter(item => category === '全部' || item.category === category).map(item => {
        const font = captionFontByFamily(item.style.font)
        return <Button key={item.id} variant="ghost" className="ipt-style-option" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
          <span className="ipt-style-option__specimen" style={{ fontFamily: item.style.font, fontWeight: item.style.weight, color: item.style.color, backgroundColor: item.style.backgroundColor || '#172128' }}>{copy('sample1')}</span>
          <strong>{item.name}</strong>
          <small>{font?.label ?? item.style.font} · {item.style.size}px</small>
        </Button>
      })}</div>
      <div className="ipt-style-library__preview">
        {livePreview && <StylePreview preset={preset} />}
        <HoverTip label={copy('previewNotice')} enabled={!livePreview}>
          <Button variant="generate" disabled={busy} onClick={() => onApply(preset.id)}>{busy ? copy('applying') : copy('apply')}</Button>
        </HoverTip>
      </div>
    </div>
  </div>
}

export function StylePreview({ preset, backgroundColor = '#172128' }: { preset: Pick<TalkCaptionPreset, 'name' | 'style'>; backgroundColor?: string }) {
  const { copy } = useTemplateCopy()
  const doc = useEditorDocument()
  const ref = useRef<HTMLCanvasElement>(null)
  const time = useRef(1_000_000)
  const [playing, setPlaying] = useState(false)
  const [sampleUs] = useState(1_000_000)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [retry, setRetry] = useState(0)
  const plan = useMemo(() => buildRenderPlan({
    ...doc, tracks: [], durationUs: 6_000_000,
    canvas: { ...doc.canvas, backgroundColor }, captionStyle: preset.style,
    captions: [
      { id: 'sample-1', text: copy('sample1'), startUs: 0, durationUs: 2_000_000, timingSource: 'estimated' },
      { id: 'sample-2', text: copy('sample2'), startUs: 2_000_000, durationUs: 2_000_000, timingSource: 'estimated' },
      { id: 'sample-3', text: copy('sample3'), startUs: 4_000_000, durationUs: 2_000_000, timingSource: 'estimated' },
    ],
  }), [doc.canvas.width, doc.canvas.height, preset, backgroundColor, copy])
  useEffect(() => { time.current = sampleUs }, [sampleUs])
  useEffect(() => {
    let active = true
    let frame = 0
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const font = captionFontByFamily(preset.style.font)
    setStatus('loading')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const paint = () => {
      ctx.save()
      ctx.scale(canvas.width / plan.canvasWidth, canvas.height / plan.canvasHeight)
      renderSceneToCanvas(ctx, sceneAtTime(plan, time.current), () => null)
      ctx.restore()
    }
    let last = 0
    let started = 0
    const tick = (now: number) => {
      if (!active) return
      if (!document.hidden && now - last >= 1000 / 24) {
        time.current = (sampleUs + (now - started) * 1000) % 6_000_000
        paint()
        last = now
      }
      frame = requestAnimationFrame(tick)
    }
    void (font ? loadCaptionFont(font.id) : Promise.reject(new Error('字体未登记'))).then(() => {
      if (!active) return
      setStatus('ready')
      time.current = sampleUs
      paint()
      if (playing && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { started = performance.now(); frame = requestAnimationFrame(tick) }
    }).catch(() => { if (active) setStatus('failed') })
    return () => { active = false; cancelAnimationFrame(frame) }
  }, [plan, playing, sampleUs, retry, preset.style.font])
  const ready = status === 'ready'
  const aspect = doc.canvas.width / doc.canvas.height
  return <>
    <div className="ipt-style-canvas" style={{ aspectRatio: aspect, backgroundColor }}><canvas ref={ref} width={Math.round(480 * aspect)} height={480} aria-label={`${preset.name} · ${copy('previewLabel')} · ${doc.canvas.ratio}`} /></div>
    <div className="ipt-style-preview-bar">
      {status !== 'ready' && <span className="ipt-look-font-state" role="status">{copy(status === 'loading' ? 'fontLoading' : 'fontFailed')}</span>}
      {status === 'failed' && <Button size="sm" variant="toolbar" onClick={() => setRetry(value => value + 1)}>{copy('retryFont')}</Button>}
      {status !== 'failed' && <Button variant="ghost" size="sm" disabled={!ready} onClick={() => setPlaying(value => !value)}>{copy(playing ? 'pausePreview' : 'playPreview')}</Button>}
    </div>
  </>
}
