import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Library } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { HoverTip } from '@no996/ui/tooltip'
import { TemplateCanvas } from '../components/TemplateCanvas'
import { createTemplateProject } from '../lib/template-project'
import { TALK_LOOKS, type TalkLook } from './talk-looks'
import { useTalkV2Copy } from './v2-copy'

export function TalkLookPreview({ look, aspect, heading }: { look: TalkLook; aspect: string; heading?: string }) {
  const title = heading?.trim() || look.heading
  const project = useMemo(() => createTemplateProject({
    templateId: look.id,
    script: look.caption,
    duration: 5,
    title,
  }), [look, title])
  const portrait = aspect === '9 / 16'
  return <div className="ipt-phone" style={{ background: look.backgroundColor, aspectRatio: aspect }} aria-hidden="true">
    {portrait ? <TemplateCanvas project={project} time={0} /> : <p className="ipt-phone__title">{title.replace(/\n/g, ' ')}</p>}
  </div>
}

function LookThumb({ look, aspect }: { look: TalkLook; aspect: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const project = useMemo(() => createTemplateProject({
    templateId: look.id,
    script: look.caption,
    duration: 5,
    title: look.heading,
  }), [look])
  useEffect(() => {
    if (!host.current) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '120px' })
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  const portrait = aspect === '9 / 16'
  return <div ref={host} className="ipt-look-thumb" style={{ background: look.backgroundColor, aspectRatio: aspect }}>
    {portrait && visible && <TemplateCanvas project={project} time={0} />}
    {!portrait && <span className="ipt-look-thumb__label">{look.heading.replace(/\n/g, ' ')}</span>}
  </div>
}

export function TalkLookStrip({
  selectedId, aspect = '9 / 16', busy = false, compact = false, onSelect, onBrowse,
}: {
  selectedId?: string
  aspect?: string
  busy?: boolean
  compact?: boolean
  onSelect: (id: string) => void
  onBrowse: () => void
}) {
  const { t } = useTalkV2Copy()
  const listRef = useRef<HTMLDivElement>(null)
  const selected = selectedId && TALK_LOOKS.some(item => item.id === selectedId) ? selectedId : TALK_LOOKS[0].id
  const move = (from: string, delta: number) => {
    const index = TALK_LOOKS.findIndex(item => item.id === from)
    const next = TALK_LOOKS[(index + delta + TALK_LOOKS.length) % TALK_LOOKS.length]
    onSelect(next.id)
    queueMicrotask(() => listRef.current?.querySelector<HTMLButtonElement>(`[data-look-id="${next.id}"]`)?.focus())
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (busy) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(selected, 1) }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(selected, -1) }
    if (event.key === 'Home') { event.preventDefault(); onSelect(TALK_LOOKS[0].id) }
    if (event.key === 'End') { event.preventDefault(); onSelect(TALK_LOOKS[TALK_LOOKS.length - 1].id) }
  }
  return <section className={`ipt-look-strip${compact ? ' ipt-look-strip--compact' : ''}`} aria-label={t('lookStrip')}>
    <div className="ipt-look-strip__head">
      <p>{t('lookStripHint')}</p>
      <HoverTip label={t('browseLooksHint')} enabled>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onBrowse}><Library size={14} />{t('browseLooks')}</Button>
      </HoverTip>
    </div>
    <div ref={listRef} className="ipt-look-strip__scroller" role="listbox" aria-label={t('lookStrip')} aria-disabled={busy} tabIndex={-1} onKeyDown={onKeyDown}>
      {TALK_LOOKS.map(look => {
        const isSelected = look.id === selected
        return <button
          key={look.id}
          type="button"
          role="option"
          data-look-id={look.id}
          className="ipt-look-card"
          data-aspect={aspect}
          aria-selected={isSelected}
          aria-label={look.name}
          disabled={busy}
          onClick={() => onSelect(look.id)}
        >
          <LookThumb look={look} aspect={aspect} />
          <span>{look.name}</span>
        </button>
      })}
    </div>
  </section>
}
