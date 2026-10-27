import { useEffect, useState } from 'react'
import type { SubtitleStyle, TemplateProject } from '../lib/template-project'
import { RemotionTemplateView } from './RemotionTemplateView'

export function useBlobUrl(blob: Blob | null | undefined): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) { setUrl(''); return }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}
export function SubtitlePreview({ templateId = 'scroll', cover, script, duration, time, style, onPosition, demo, project }: {
  templateId?: string; cover?: Blob | null; script: string; duration: number; time: number
  style: SubtitleStyle; onPosition?: (y: number) => void; demo?: boolean; project?: TemplateProject
}) {
  return <RemotionTemplateView templateId={templateId} script={script} duration={duration} time={time} cover={cover ?? undefined} style={style} onPosition={onPosition} demo={demo} project={project} />
}
