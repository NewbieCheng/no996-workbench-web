import type { ReactNode } from 'react'
import { Captions, Film, UserRound } from 'lucide-react'
import { useTalkV2Copy } from '../v2-copy'
import type { TalkInspectorTarget } from './TalkObjectRail'

export function TalkInspector({
  target,
  onTarget,
  children,
}: {
  target: TalkInspectorTarget
  onTarget: (target: TalkInspectorTarget) => void
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
      {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={target === tab.id} className={target === tab.id ? 'on' : undefined} onClick={() => onTarget(tab.id)}>
        {tab.icon}{tab.label}
      </button>)}
    </div>
    <div className="ipt-inspector__body">{children}</div>
  </aside>
}
