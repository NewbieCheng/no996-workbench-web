import { useEffect, useRef, useState } from 'react'
import type { TemplateProject } from '../lib/template-project'
import { TemplatePainter, loadTemplateFonts, loadTemplateImage } from '../lib/template-renderer'
import { ShotBackdropRenderer, templateHasShots } from '../lib/shot-backdrop'

export function TemplateCanvas({ project, cover, time, className, onOverflow }: { project: TemplateProject; cover?: Blob; time: number; className?: string; onOverflow?: (value: boolean) => void }) {
  const design = project.design ?? { width: 1080, height: 1920 }
  const canvas = useRef<HTMLCanvasElement>(null)
  const painter = useRef<TemplatePainter>()
  const image = useRef<ImageBitmap>()
  const [mediaRevision, setMediaRevision] = useState(0)
  const currentTime = useRef(time)
  currentTime.current = time
  const overflowHandler = useRef(onOverflow)
  overflowHandler.current = onOverflow
  const [error, setError] = useState('')
  const lastOverflow = useRef<boolean>()
  // 动效背景：预览与导出走同一个 ShotBackdropRenderer，只是分辨率更低
  const backdrop = useRef<ShotBackdropRenderer | null>(null)
  if (!backdrop.current) backdrop.current = new ShotBackdropRenderer({ width: 540, height: 960 })
  useEffect(() => {
    return () => {
      backdrop.current?.dispose()
      backdrop.current = null
    }
  }, [])
  function paint() {
    const context = canvas.current?.getContext('2d')
    if (!context || !painter.current) return
    context.save(); context.scale(.5, .5); painter.current.draw(context, currentTime.current); context.restore()
    if (painter.current.overflow !== lastOverflow.current) {
      lastOverflow.current = painter.current.overflow
      overflowHandler.current?.(painter.current.overflow)
    }
  }
  // Media lifetime is independent from drag/typography state: no image decode per pointer move.
  useEffect(() => {
    let live = true
    let bitmap: ImageBitmap | undefined
    const controller = new AbortController()
    image.current = undefined
    painter.current = undefined
    setMediaRevision(revision => revision + 1)
    if (cover) void loadTemplateImage(cover, controller.signal).then(loaded => {
      if (!live) { loaded.close(); return }
      bitmap = loaded; image.current = loaded; painter.current = undefined; setMediaRevision(revision => revision + 1)
    }).catch(reason => { if (live && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => { live = false; controller.abort(); image.current = undefined; bitmap?.close() }
  }, [cover])
  useEffect(() => {
    let live = true
    void loadTemplateFonts(project).then(() => {
      if (!live) return
      if (painter.current) painter.current.updateProject(project)
      else painter.current = new TemplatePainter(project, image.current)
      setError('')
      paint()
    }).catch(() => {
      if (live) {
        // Fallback to system typography if font loading fails
        if (painter.current) painter.current.updateProject(project)
        else painter.current = new TemplatePainter(project, image.current)
        setError('')
        paint()
      }
    })
    return () => { live = false }
  }, [project, mediaRevision])
  // 有动效背景时需要先异步出帧；没有镜头时退回同步 paint，行为不变
  useEffect(() => {
    const active = painter.current
    const engine = backdrop.current
    if (!active || !engine || !templateHasShots(project)) {
      paint()
      return
    }
    let cancelled = false
    void engine.frameAt(project, time).then((frame) => {
      if (cancelled || !painter.current) return
      painter.current.setBackdrop(frame)
      paint()
    }).catch(() => { if (!cancelled) paint() })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, project])
  return <div className={className} style={{ position: 'relative', width: '100%', aspectRatio: `${design.width} / ${design.height}` }}>
    <canvas ref={canvas} width={Math.round(design.width / 2)} height={Math.round(design.height / 2)} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true" />
    {error && (
      <div
        role="alert"
        className="absolute bottom-3 left-3 right-3 p-2 rounded-md text-xs text-white/90 bg-black/75 backdrop-blur-sm border border-white/10"
      >
        <span>{error}</span>
      </div>
    )}
  </div>
}
