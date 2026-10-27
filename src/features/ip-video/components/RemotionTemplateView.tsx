import { useMemo, type PointerEvent } from 'react'
import { createTemplateProject, type SubtitleStyle, type TemplateProject } from '../lib/template-project'
import { TemplateCanvas } from './TemplateCanvas'

export type RemotionTemplateProps = {
  templateId: string; script: string; duration: number; time: number; cover?: Blob
  style: SubtitleStyle; onPosition?: (y: number) => void; demo?: boolean; project?: TemplateProject
}
/** Compatibility component name; all pixels now use the shared Canvas painter, not Remotion. */
export function RemotionTemplateView({ templateId, script, duration, time, cover, style, onPosition, demo, project }: RemotionTemplateProps) {
  const fallback = useMemo(() => createTemplateProject({ templateId, script, duration, style, demo }), [templateId, script, duration, style, demo])
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!onPosition || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const bounds = event.currentTarget.getBoundingClientRect()
    onPosition(Math.min(92, Math.max(20, (event.clientY - bounds.top) / bounds.height * 100)))
  }
  return <div className="ipv-phone ipv-template-canvas" aria-label="口播视频预览" style={{ touchAction: onPosition ? 'none' : undefined }}
    onPointerDown={event => { if (onPosition) { event.currentTarget.setPointerCapture(event.pointerId); move(event) } }}
    onPointerMove={move} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}>
    <TemplateCanvas project={project ?? fallback} cover={cover} time={time} />
  </div>
}
