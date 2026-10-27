import type { ReactNode } from 'react'
import { Captions, Film, ImagePlus, Plus, UserRound } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { useTalkV2Copy } from '../v2-copy'

export type TalkInspectorTarget = 'captions' | 'media' | 'shots'

export type TalkVisualItem = { id: string; name: string; kind: 'image' | 'video' }
export type TalkShotItem = { id: string; name: string }

export function TalkObjectRail({
  target,
  captionCount,
  visuals,
  shots,
  selectedIds,
  busy,
  onTarget,
  onSelectElement,
  onAdd,
  onDigital,
  onAiImage,
}: {
  target: TalkInspectorTarget
  captionCount: number
  visuals: TalkVisualItem[]
  shots: TalkShotItem[]
  selectedIds: string[]
  busy: boolean
  onTarget: (target: TalkInspectorTarget) => void
  onSelectElement: (id: string, target: TalkInspectorTarget) => void
  onAdd: () => void
  onDigital: () => void
  onAiImage?: () => void
}) {
  const { t } = useTalkV2Copy()
  const railButton = (id: TalkInspectorTarget, label: string, count: number, icon: ReactNode) => <button
    type="button"
    className="ipt-object-rail__group-head"
    aria-pressed={target === id}
    disabled={busy}
    onClick={() => onTarget(id)}
  >
    {icon}
    <span>{label}</span>
    <small>{count}</small>
  </button>
  return <aside className="ipt-object-rail" aria-label={t('objectRail')}>
    <div className="ipt-object-rail__group">
      {railButton('captions', t('captions'), captionCount, <Captions size={15} aria-hidden />)}
      <button type="button" className="ipt-object-rail__item" disabled={busy} onClick={() => onTarget('captions')}>
        <span>{t('captionStyle')}</span>
        <small>{t('captionCount', { count: captionCount })}</small>
      </button>
    </div>
    <div className="ipt-object-rail__group">
      {railButton('media', t('visuals'), visuals.length, <UserRound size={15} aria-hidden />)}
      {visuals.map(item => <button key={item.id} type="button" className="ipt-object-rail__item" aria-pressed={selectedIds.includes(item.id)} disabled={busy} onClick={() => onSelectElement(item.id, 'media')}>
        <span>{item.name}</span>
        <small>{item.kind === 'video' ? t('video') : t('photo')}</small>
      </button>)}
      <div className="ipt-object-rail__actions">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onAdd}><Plus size={14} />{t('addAssets')}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDigital}><UserRound size={14} />{t('useDigitalShort')}</Button>
        {onAiImage ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onAiImage}><ImagePlus size={14} />{t('aiImageOpen')}</Button> : null}
      </div>
    </div>
    <div className="ipt-object-rail__group">
      {railButton('shots', t('shots'), shots.length, <Film size={15} aria-hidden />)}
      {shots.map(item => <button key={item.id} type="button" className="ipt-object-rail__item" aria-pressed={selectedIds.includes(item.id)} disabled={busy} onClick={() => onSelectElement(item.id, 'shots')}>
        <span>{item.name}</span>
      </button>)}
    </div>
  </aside>
}
