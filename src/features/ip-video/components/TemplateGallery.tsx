import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronDown, Star } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Card } from '@no996/ui/card'
import { IP_VIDEO_TEMPLATES, type IPVideoTemplate } from '../templates'
import { createTemplateProject } from '../lib/template-project'
import { TemplateCanvas } from './TemplateCanvas'

export function TemplateThumbnail({ template, label }: { template: IPVideoTemplate; label: string }) {
  const element = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const project = useMemo(() => createTemplateProject({ templateId: template.id, script: template.caption, duration: 5, title: template.heading }), [template])
  useEffect(() => {
    if (!element.current) return
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() } }, { rootMargin: '160px' })
    observer.observe(element.current)
    return () => observer.disconnect()
  }, [])
  return <div className="ipv-template-thumbnail" ref={element} role="img" aria-label={label} style={{ background: template.background }}>
    {visible && <TemplateCanvas project={project} time={0} />}
  </div>
}

export function TemplateGallery({ onSelect, busy }: { onSelect: (template: IPVideoTemplate) => void; busy: boolean }) {
  const { t } = useTranslation('ipVideo')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const groups = ['all', 'knowledge', 'opinion', 'life']
  const matches = (template: IPVideoTemplate) => filter === 'all' || (filter === 'knowledge' && ['scroll', 'lesson'].includes(template.id)) || (filter === 'opinion' && ['poster', 'career', 'tiktok'].includes(template.id)) || (filter === 'life' && ['call', 'life', 'audiogram'].includes(template.id))
  return <section className="ipv-gallery">
    <div className="ipv-gallery-heading"><div><h2>{t('galleryTitle')}</h2><p>{t('galleryDescription')}</p></div><span className="ipv-format">9:16 · 1080 × 1920</span></div>
    <div className="ipv-filter" aria-label={t('templateFilter')}>{groups.map(group => <Button key={group} variant={filter === group ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter(group)} aria-pressed={filter === group}>{t(`filter.${group}`)}</Button>)}</div>
    <div className="ipv-template-grid">{IP_VIDEO_TEMPLATES.filter(matches).map(template => <Card className="ipv-template" key={template.id}>
      <div className="ipv-template-image"><TemplateThumbnail template={template} label={t(`templates.${template.id}.name`)} /><span>{t(`templates.${template.id}.category`)}</span><div className="ipv-template-duration">{template.duration}</div></div>
      <div className="ipv-template-body"><h3>{t(`templates.${template.id}.name`)}</h3><div className="ipv-stars" aria-label={t('styleRating', { n: template.stars })}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={12} fill={i < template.stars ? 'currentColor' : 'none'} opacity={i < template.stars ? 1 : .3} />)}<span>{t('styleRatingLabel')}</span></div><p>{t(`templates.${template.id}.description`)}</p>
        <div className="ipv-materials"><span>{t('prepare')}</span>{template.materials.map((item, i) => <span key={item} className="ipv-material">{t(i === 0 ? 'scriptMaterial' : 'coverMaterial')}</span>)}</div>
        <Button className="ipv-template-use" disabled={busy} onClick={() => onSelect(template)}>{t('useTemplate')}<ArrowRight size={15} /></Button>
        <Button variant="ghost" size="sm" aria-expanded={expanded === template.id} onClick={() => setExpanded(expanded === template.id ? null : template.id)}>{t('viewCases')}<ChevronDown size={14} /></Button>
        {expanded === template.id && <ul className="ipv-cases">{template.cases.map(item => <li key={item.title}><strong>{item.title}</strong><span>{t('demoCase')}</span></li>)}</ul>}
      </div>
    </Card>)}</div>
  </section>
}
