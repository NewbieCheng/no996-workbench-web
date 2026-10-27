import type { ComponentType, CSSProperties } from 'react'
import { contentShotLineBudget } from './content-shot-layout.ts'
export { contentShotLineBudget } from './content-shot-layout.ts'
import { useCurrentFrame, useShotProps, useVideoConfig } from './runtime/frame-context.tsx'
import { Easing, interpolate } from './runtime/interpolate.ts'

/** Content-only presentations of existing shot IDs, not copies of the demo scenes or their assets. */
export const CONTENT_SHOT_DEFINITIONS = [
  { shotId: 'typography/blur-slide', label: '柔焦滑入', variant: 'blur', curated: true },
  { shotId: 'typography/flying-words', label: '文字纵深飞入', variant: 'fly', curated: false },
  { shotId: 'typography/outline-word-fill', label: '描边点亮', variant: 'outline', curated: true },
  { shotId: 'typography/gradient-word-sweep', label: '渐变扫光', variant: 'gradient', curated: false },
  { shotId: 'typography/marker-underline-title', label: '马克笔划线', variant: 'marker', curated: true },
  { shotId: 'typography/title-demote-to-label', label: '标题收为标签', variant: 'label', curated: true },
] as const
export const CONTENT_SHOT_TEXT_LIMITS = { text: 18, subline: 36 } as const
export type ContentShotVariant = (typeof CONTENT_SHOT_DEFINITIONS)[number]['variant']
export type ContentShotText = { text: string; subline: string }

/** The command and renderer share one input contract. No truncation or demo fallback. */
export function contentShotTextError(input: Record<string, unknown>): string | undefined {
  if (Object.keys(input).some(key => key !== 'text' && key !== 'subline')) return '内容镜头只接受短标题和副标题。'
  for (const key of ['text', 'subline'] as const) {
    const text = input[key]
    const label = key === 'text' ? '短标题' : '副标题'
    if (typeof text !== 'string' || !text.trim()) return `请填写${label}。`
    if (Array.from(text).length > CONTENT_SHOT_TEXT_LIMITS[key]) return `${label}最多 ${CONTENT_SHOT_TEXT_LIMITS[key]} 字，不自动截断。`
    if (/[\u0000-\u001f\u007f-\u009f<>\u202a-\u202e\u2066-\u2069]/u.test(text)) return `${label}仅支持单行纯文本，不接受控制字符。`
  }
  return undefined
}

function linesOf(text: string, count: number): string[] {
  const chars = Array.from(text)
  const lines: string[] = []
  for (let index = 0; index < chars.length; index += count) lines.push(chars.slice(index, index + count).join(''))
  return lines
}
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.out(Easing.cubic)
const progress = (t: number, from: number, to: number) => interpolate(t, [from, to], [0, 1], { ...clamp, easing: ease })
const font = '"Alibaba PuHuiTi", sans-serif'
let contentFonts: Promise<void> | undefined

/** CSS is registered by the host. Both content weights must actually load, even when captions use another family. */
export function ensureContentShotFonts(): Promise<void> {
  if (contentFonts) return contentFonts
  if (typeof document === 'undefined' || !document.fonts) return Promise.reject(new Error('当前环境不支持内容镜头字体加载。'))
  const fontSet = document.fonts
  let timer: ReturnType<typeof setTimeout> | undefined
  const loading = Promise.all([400, 700].map(async weight => {
    const descriptor = `${weight} 32px "Alibaba PuHuiTi"`
    const sample = '中文口播标题副标题ABC0123'
    const faces = await fontSet.load(descriptor, sample)
    if (!faces.length || faces.some(face => face.status !== 'loaded') || !fontSet.check(descriptor, sample)) {
      throw new Error(`内容镜头普惠体 ${weight} 字重未就绪。`)
    }
  })).then(() => undefined)
  const pending = Promise.race([
    loading,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('内容镜头字体加载超时。')), 20_000) }),
  ]).finally(() => { if (timer !== undefined) clearTimeout(timer) })
  contentFonts = pending
  void pending.catch(() => { if (contentFonts === pending) contentFonts = undefined })
  return pending
}

function ContentTypography({ variant, ...direct }: Record<string, unknown> & { variant: ContentShotVariant }) {
  const injected = useShotProps()
  const values = { ...injected, ...direct }
  const frame = useCurrentFrame()
  const { width, height, durationInFrames } = useVideoConfig()
  // Imported invalid data fails visibly in preview and rejects export; never render demo text or an empty success.
  const inputError = contentShotTextError(values)
  if (inputError) throw new Error(inputError)
  const { text, subline } = values as ContentShotText
  const t = Math.max(0, Math.min(1, frame / Math.max(1, durationInFrames - 1)))
  const { titleCols, subCols } = contentShotLineBudget(width, height)
  const titleLines = linesOf(text, titleCols)
  const subLines = linesOf(subline, subCols)
  const innerWidth = width * 0.82
  // Conservative full-em budget handles Chinese, Latin, emoji and fullwidth punctuation without DOM measurement.
  const titleSize = Math.min(innerWidth / (titleCols * 1.16), height * 0.115)
  const subSize = Math.min(innerWidth / (subCols * 1.16), height * 0.038)
  const gap = height * 0.035
  const titleHeight = titleLines.length * titleSize * 1.28
  const subHeight = subLines.length * subSize * 1.5
  const blockHeight = titleHeight + gap + subHeight
  const top = height * 0.12 + Math.max(0, (height * 0.52 - blockHeight) / 2)
  const dark = variant === 'outline' || variant === 'gradient' || variant === 'fly'
  const ink = dark ? '#f8f6ef' : '#17242b'
  const accent = variant === 'gradient' ? '#cf9bff' : dark ? '#e3b866' : '#b14c31'
  const label = variant === 'label' ? progress(t, 0.3, 0.58) : 0
  const enter = progress(t, 0, 0.22)
  const root: CSSProperties = {
    position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: font,
    background: dark ? 'linear-gradient(145deg, #111d30, #10151e)' : 'linear-gradient(145deg, #fbf6ec, #e9eee8)',
    color: ink, boxSizing: 'border-box',
  }
  const titleStyle: CSSProperties = {
    position: 'relative', fontSize: titleSize, fontWeight: 700, lineHeight: 1.28,
    letterSpacing: 0, width: innerWidth, whiteSpace: 'pre',
    transformOrigin: 'left top',
    transform: variant === 'label' ? `translateY(${-height * 0.045 * label}px) scale(${1 - label * 0.4})` : undefined,
  }
  return <div style={root} data-content-shot={variant}>
    <div style={{ position: 'absolute', left: width * 0.09, top, width: innerWidth }}>
      <div style={titleStyle}>
        {titleLines.map((line, row) => <div key={row} style={{ position: 'relative', minHeight: titleSize * 1.28 }}>
          {Array.from(line).map((char, column) => {
            const index = row * titleCols + column
            const delay = index * 0.006
            const p = progress(t, delay, 0.22 + delay)
            const fill = progress(t, 0.34, 0.53)
            const lit = t >= 0.53
            const style: CSSProperties = { display: 'inline-block', position: 'relative', verticalAlign: 'top', opacity: 0.24 + p * 0.76 }
            if (variant === 'blur') {
              style.transform = `translateY(${(1 - p) * titleSize * 0.28}px)`
              style.filter = p >= 0.999 ? undefined : `blur(${(1 - p) * titleSize * 0.045}px)`
            } else if (variant === 'fly') {
              // Depth cue is bounded inside the text safe area; never fly words across the caption region.
              style.transform = `translate(${(1 - p) * titleSize * (index % 2 ? 0.16 : -0.16)}px, ${(1 - p) * titleSize * 0.18}px) scale(${0.72 + p * 0.28})`
              style.transformOrigin = 'center center'
            } else if (variant === 'outline') {
              style.color = lit ? ink : 'transparent'
              style.WebkitTextStroke = `${Math.max(0.45, titleSize * 0.012)}px ${lit ? ink : accent}`
              style.transform = `scale(${1.04 - p * 0.04})`
              style.textShadow = lit && fill < 1 ? `0 0 ${titleSize * 0.12}px ${accent}` : undefined
            } else if (variant === 'gradient') {
              const sweep = progress(t, 0.12 + index * 0.012, 0.38 + index * 0.012)
              style.color = sweep > 0.55 ? accent : ink
              style.backgroundImage = 'linear-gradient(100deg, #a4d4ff, #cf9bff, #ffbca2)'
              style.backgroundSize = '200% 100%'
              style.backgroundPosition = `${100 - sweep * 100}% 50%`
              style.backgroundClip = 'text'
              style.WebkitBackgroundClip = 'text'
              style.WebkitTextFillColor = sweep > 0.05 ? 'transparent' : ink
            } else {
              style.transform = `translateY(${(1 - p) * titleSize * 0.1}px)`
            }
            return <span key={column} style={style}>{char}</span>
          })}
          {variant === 'marker' && <svg aria-hidden="true" width={Math.min(innerWidth, Array.from(line).length * titleSize)} height={titleSize * 0.18} viewBox="0 0 100 10" preserveAspectRatio="none" style={{ display: 'block', position: 'absolute', left: 0, bottom: titleSize * 0.02, overflow: 'visible' }}><path d="M2 7 Q27 2 51 6 T98 4" pathLength={1} fill="none" stroke={accent} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - progress(t, 0.3 + row * 0.04, 0.5 + row * 0.04)} /></svg>}
        </div>)}
      </div>
      <div style={{ marginTop: variant === 'label' ? gap - titleHeight * 0.34 * label : gap, fontSize: subSize, fontWeight: 400, lineHeight: 1.5, color: dark ? '#c8d1dd' : '#46575c', opacity: 0.28 + 0.72 * progress(t, variant === 'label' ? 0.42 : 0.12, variant === 'label' ? 0.67 : 0.38), transform: `translateY(${(1 - enter) * subSize * 0.16}px)` }}>
        {subLines.map((line, index) => <div key={index} style={{ whiteSpace: 'pre' }}>{line}</div>)}
      </div>
    </div>
    <div aria-hidden="true" style={{ position: 'absolute', left: width * 0.09, top: height * 0.095, width: width * (0.045 + 0.08 * enter), height: Math.max(1, height * 0.003), background: accent }} />
  </div>
}

function wrap(variant: ContentShotVariant): ComponentType<Record<string, unknown>> {
  return function ContentShot(props: Record<string, unknown>) { return <ContentTypography {...props} variant={variant} /> }
}
const CONTENT_SHOTS = new Map<string, { load: () => Promise<ComponentType<Record<string, unknown>>> }>(
  CONTENT_SHOT_DEFINITIONS.map(definition => {
    const Component = wrap(definition.variant)
    return [definition.shotId, { load: () => Promise.resolve(Component) }]
  }),
)

/** Static allowlist only. The caller must request presentation='content'; no demo fallback is appropriate. */
export function findContentShot(shotId: string): { load: () => Promise<ComponentType<Record<string, unknown>>> } | undefined {
  return CONTENT_SHOTS.get(shotId)
}
