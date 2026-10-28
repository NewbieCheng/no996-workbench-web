import type { ReactNode } from 'react'
import { Captions, Film, UserRound } from 'lucide-react'
import { useTalkV2Copy } from '../v2-copy'

export type TalkInspectorTarget = 'captions' | 'media' | 'shots'

export function TalkInspector({
  target,
  onTarget,
  counts,
  children,
}: {
  target: TalkInspectorTarget
  onTarget: (target: TalkInspectorTarget) => void
  counts?: Partial<Record<TalkInspectorTarget, number>>
  children: ReactNode
}) {
  const { t } = useTalkV2Copy()
  const tabs: Array<{ id: TalkInspectorTarget; label: string; icon: ReactNode }> = [
    { id: 'captions', label: t('captions'), icon: <Captions size={14} /> },
    { id: 'media', label: t('visuals'), icon: <UserRound size={14} /> },
    { id: 'shots', label: t('shots'), icon: <Film size={14} /> },
  ]
  return <aside className="ipt-inspector" aria-label={t('inspectorLabel')}>
    <div className="ipt-inspector__tabs" role="tablist" aria-label={t('inspectorLabel')}>
      {tabs.map(tab => {
        const count = counts?.[tab.id]
        return <button key={tab.id} type="button" role="tab" aria-selected={target === tab.id} className={target === tab.id ? 'on' : undefined} onClick={() => onTarget(tab.id)}>
          {tab.icon}
          <span>{tab.label}</span>
          {typeof count === 'number' ? <small className="ipt-inspector__count">{count}</small> : null}
        </button>
      })}
    </div>
    <div className="ipt-inspector__body">{children}</div>
  </aside>
}
