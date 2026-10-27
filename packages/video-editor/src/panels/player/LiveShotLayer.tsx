/** Live React shots share the export frame runtime; preview never rasterizes DOM. */
import React, { useEffect, useRef, useState } from 'react'
import type { ShotClipElement, EditorDocument } from '../../core/project.ts'
import { findShot } from '../../demos/registry.generated.ts'
import { contentShotTextError, ensureContentShotFonts, findContentShot } from '../../demos/content-variants.tsx'
import { FrameProvider } from '../../demos/runtime/frame-context.tsx'
import { waitForImages } from '../../demos/runtime/assets.tsx'
import { waitForRenderGate } from '../../demos/runtime/render-gate.ts'
import { resolveShotFrame } from '../../render/shot-cache.ts'
import { evaluateElementOpacity, evaluateElementTransform } from '../../render/evaluator.ts'

type ShotComponent = React.ComponentType<Record<string, unknown>>

class ShotErrorBoundary extends React.Component<{
  children: React.ReactNode; onError?: (message: string) => void
}, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { this.props.onError?.(`镜头渲染失败：${error.message}`) }
  render() { return this.state.failed ? <div role="status">镜头渲染失败</div> : this.props.children }
}

function LiveShot({ element, doc, playheadUs, onReady, onError, evaluateTransforms }: {
  element: ShotClipElement
  doc: EditorDocument
  playheadUs: number
  onReady?: () => void
  onError?: (message: string) => void
  evaluateTransforms: boolean
}) {
  const [loaded, setLoaded] = useState<{ id: string; component: ShotComponent } | null>(null)
  const [error, setError] = useState('')
  const host = useRef<HTMLDivElement>(null)
  const original = findShot(element.shotId)
  // A content presentation never loads the original demo, including on errors.
  const definition = element.presentation === 'content' ? findContentShot(element.shotId) : original
  const props = { ...element.slots, ...element.overrides }
  const inputError = element.presentation === 'content'
    ? contentShotTextError(props) || (!Number.isInteger(element.sourceDurationFrames) || element.sourceDurationFrames < 1 ? '内容镜头必须提供有效源帧长。' : undefined)
    : undefined
  const requestKey = JSON.stringify([element.id, element.shotId, element.presentation, props, element.sourceDurationFrames])
  const Shot = loaded?.id === requestKey ? loaded.component : null
  useEffect(() => {
    let alive = true
    setLoaded(null)
    setError('')
    const fail = (failure: unknown) => {
      if (!alive) return
      const message = `镜头加载失败 ${element.shotId}：${String(failure)}`
      setError(message); onError?.(message)
    }
    if (!definition || !original) fail('未登记的镜头或内容适配')
    else if (inputError) fail(inputError)
    else void (async () => {
      if (element.presentation === 'content') await ensureContentShotFonts()
      const component = await definition.load()
      if (alive) setLoaded({ id: requestKey, component })
    })().catch(fail)
    return () => { alive = false }
  }, [requestKey, definition, original, element.shotId, element.presentation, inputError, onError])
  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  const frame = resolveShotFrame({ playheadUs, startUs: element.startUs, rate: element.rate,
    fps, sourceDurationFrames: element.sourceDurationFrames })

  useEffect(() => {
    if (!Shot) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    // Wait after child layout effects; use the same image/render gates as export without resetting
    // their global state (another live shot may still own a gate).
    void Promise.race([
      Promise.resolve().then(async () => {
        await document.fonts?.ready
        if (!await waitForImages(6000)) throw new Error('镜头图片加载超时')
        await waitForRenderGate()
        const failedImage = Array.from(host.current?.querySelectorAll('img') ?? [])
          .some(image => image.complete && image.naturalWidth === 0)
        if (failedImage) throw new Error('镜头图片加载失败')
      }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('镜头资源加载超时')), 6500) }),
    ]).then(() => { if (alive) onReady?.() })
      .catch(failure => { if (alive) { setError(String(failure)); onError?.(String(failure)) } })
      .finally(() => { if (timer !== undefined) clearTimeout(timer) })
    return () => { alive = false; if (timer !== undefined) clearTimeout(timer) }
  }, [Shot, element.slots, element.overrides, onReady, onError])

  // Full transform channels are opt-in; legacy preview retains static geometry.
  const localTimeUs = Math.max(0, playheadUs - element.startUs)
  const transform = evaluateTransforms
    ? evaluateElementTransform(element.transform, element.animations, localTimeUs)
    : { ...element.transform, opacity: evaluateElementOpacity(element.animations, localTimeUs, element.transform.opacity ?? 1) }
  const scale = Math.max(transform.width / doc.canvas.width, transform.height / doc.canvas.height)
  const cssTransform = [
    transform.rotationDeg ? `rotate(${transform.rotationDeg}deg)` : '',
    transform.flipX ? 'scaleX(-1)' : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined
  return <div ref={host} data-live-shot={element.shotId} style={{
    position: 'absolute', left: transform.x, top: transform.y,
    width: transform.width, height: transform.height,
    transform: cssTransform,
    transformOrigin: 'center center', opacity: Math.max(0, Math.min(1, transform.opacity ?? 1)),
    overflow: 'hidden', borderRadius: transform.round || 0, pointerEvents: 'none',
  }}>
    <div style={{ position: 'absolute',
      left: (transform.width - doc.canvas.width * scale) / 2,
      top: (transform.height - doc.canvas.height * scale) / 2,
      width: doc.canvas.width, height: doc.canvas.height,
      // Export's DOM renderer has an opaque black root before centered cover composition.
      background: '#000', overflow: 'hidden',
      transform: `scale(${scale})`, transformOrigin: 'top left',
    }}>
      {Shot ? <ShotErrorBoundary key={requestKey} onError={onError}>
        <FrameProvider frame={frame} durationInFrames={element.sourceDurationFrames}
          fps={fps} width={doc.canvas.width} height={doc.canvas.height}
          props={props}>
          <Shot {...props} />
        </FrameProvider>
      </ShotErrorBoundary> : <div style={{ color: '#a1a1aa', padding: 24, fontSize: 28 }}>{error || '正在加载镜头…'}</div>}
      {Shot && error ? <div role="status" style={{ position: 'absolute', inset: 0, color: '#fff', background: '#210b0b', padding: 24 }}>{error}</div> : null}
    </div>
  </div>
}

export type LiveShotLayerProps = {
  doc: EditorDocument
  elements: ShotClipElement[]
  playheadUs: number
  displayWidth: number
  draftMode?: boolean
  onReady?: () => void
  onError?: (message: string) => void
  /** Full geometry keyframes; enable alongside layered preview. */
  evaluateTransforms?: boolean
}

export function LiveShotLayer({ doc, elements, playheadUs, displayWidth, draftMode = false,
  onReady, onError, evaluateTransforms = false }: LiveShotLayerProps) {
  const layerScale = displayWidth > 0 ? displayWidth / doc.canvas.width : 1
  return <div aria-hidden="true" className={draftMode ? 've-liveshot-draft-mode' : undefined}
    style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
    <div style={{ position: 'absolute', left: 0, top: 0,
      width: doc.canvas.width, height: doc.canvas.height,
      // Keep CSS zoom: transforming the whole filter-heavy stage creates huge offscreen textures.
      zoom: layerScale }}>
      {elements.map(element => <LiveShot key={element.id} element={element} doc={doc}
        playheadUs={playheadUs} onReady={onReady} onError={onError} evaluateTransforms={evaluateTransforms} />)}
    </div>
  </div>
}
