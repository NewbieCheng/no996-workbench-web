import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { EditorDocument } from '../../core/project.ts'
import type { SceneSnapshot, RenderableVisualItem } from '../../render/plan.ts'
import { renderSceneToCanvas, ensureCaptionFonts, type CanvasAssetSource } from '../../render/compositor.ts'
import { LiveShotLayer } from './LiveShotLayer.tsx'

/** Preserve RenderPlan ordering; only adjacent non-shot items share a canvas. */
function partition(items: RenderableVisualItem[]) {
  const layers: Array<{ key: string; items: RenderableVisualItem[]; shot: boolean }> = []
  for (const item of [...items].sort((a, b) => a.zIndex - b.zIndex)) {
    const shot = item.element.type === 'shot'
    const previous = layers[layers.length - 1]
    if (!shot && previous && !previous.shot) previous.items.push(item)
    else layers.push({ key: item.element.id, items: [item], shot })
  }
  return layers
}

function CanvasLayer({ scene, resolve, onError }: {
  scene: SceneSnapshot
  resolve?: (id: string) => CanvasAssetSource
  onError: (message: string) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // Every host render also redraws: a stable resolver can acquire a new bitmap after warmup.
  useLayoutEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) { onError('浏览器无法创建预览画布。'); return }
    const sources = new Map<string, CanvasAssetSource>()
    try {
      for (const item of scene.items) sources.set(item.element.id, resolve?.(item.element.id) ?? null)
    } catch (error) { onError(`素材读取失败：${String(error)}`) }
    const draw = () => {
      try { renderSceneToCanvas(ctx, scene, id => sources.get(id) ?? null) }
      catch (error) { onError(`预览绘制失败：${String(error)}`) }
    }
    const failed = () => onError('预览素材加载失败，请检查素材格式或重新添加。')
    const targets = [...new Set([...sources.values()].filter((source): source is CanvasImageSource & EventTarget =>
      source !== null && 'addEventListener' in source))]
    const events = ['load', 'loadeddata', 'seeked', 'timeupdate']
    for (const target of targets) {
      for (const event of events) target.addEventListener(event, draw)
      target.addEventListener('error', failed)
    }
    document.fonts?.addEventListener('loadingdone', draw)
    document.fonts?.addEventListener('loadingerror', failed)
    draw()
    return () => {
      for (const target of targets) {
        for (const event of events) target.removeEventListener(event, draw)
        target.removeEventListener('error', failed)
      }
      document.fonts?.removeEventListener('loadingdone', draw)
      document.fonts?.removeEventListener('loadingerror', failed)
    }
  })
  return <canvas ref={ref} width={scene.canvasWidth} height={scene.canvasHeight}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
}

export function LayeredPlayer({ doc, scene, displayWidth, draftMode, resolve, onReady }: {
  doc: EditorDocument
  scene: SceneSnapshot
  displayWidth: number
  draftMode: boolean
  resolve?: (id: string) => CanvasAssetSource
  onReady: () => void
}) {
  const [error, setError] = useState('')
  const [fontRevision, setFontRevision] = useState(0)
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    setError('')
    const loadFonts = async () => {
      if (!document.fonts) throw new Error('浏览器未提供字体加载能力。')
      const textRequests = doc.tracks.flatMap(track => track.elements).flatMap(element =>
        element.type === 'text' && element.text.trim()
          ? [document.fonts.load(`${element.style.weight || 700} ${element.style.size || 58}px ${element.style.font || 'sans-serif'}`, element.text)] : [])
      await Promise.all([ensureCaptionFonts(doc, { timeoutMs: 6000 }), ...textRequests])
    }
    void Promise.race([
      loadFonts(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('预览字体加载超时。')), 6000) }),
    ]).then(() => { if (alive) setFontRevision(value => value + 1) })
      .catch(failure => { if (alive) setError(String(failure)) })
      .finally(() => { if (timer !== undefined) clearTimeout(timer) })
    return () => { alive = false; if (timer !== undefined) clearTimeout(timer) }
  }, [doc])
  useEffect(() => {
    const frame = requestAnimationFrame(onReady)
    return () => cancelAnimationFrame(frame)
  }, [onReady])
  const transparent = { ...scene, backgroundColor: 'transparent', activeCaption: undefined, captions: [] }
  const layers = partition(scene.items)
  return <div data-layered-shots data-font-revision={fontRevision}
    style={{ position: 'absolute', inset: 0, zIndex: 2, isolation: 'isolate', pointerEvents: 'none' }}>
    {layers.map((layer, index) => <div key={layer.key} style={{ position: 'absolute', inset: 0, zIndex: index }}>
      {layer.shot && layer.items[0].element.type === 'shot'
        ? <LiveShotLayer doc={doc} elements={[layer.items[0].element]} playheadUs={scene.timeUs}
            displayWidth={displayWidth} draftMode={draftMode} evaluateTransforms onError={setError} />
        : <CanvasLayer scene={{ ...transparent, items: layer.items }} resolve={resolve} onError={setError} />}
    </div>)}
    <div style={{ position: 'absolute', inset: 0, zIndex: layers.length }}>
      <CanvasLayer scene={{ ...scene, backgroundColor: 'transparent', items: [] }} onError={setError} />
    </div>
    {error && <div role="status" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: layers.length + 1,
      padding: 8, color: '#fff', background: 'rgba(40, 10, 10, .9)', fontSize: 12 }}>{error}</div>}
  </div>
}
