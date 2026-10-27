import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import WorkflowRunCard from '../../../components/agent/WorkflowRunCard'
import type { AgentRunSnapshot, AgentStageDef } from '../../../agent'
import type { MomentsRunKind } from '../lib/route-state'

interface AgentRunningViewProps {
  kind: MomentsRunKind
  headline: string
  snapshot: AgentRunSnapshot | null
  defs: AgentStageDef[]
  streamingText?: string
  mock?: boolean
  error?: string
  onCancel: () => void
  onBack: () => void
}

export function AgentRunningView({
  kind,
  headline,
  snapshot,
  defs,
  streamingText,
  mock,
  error,
  onCancel,
  onBack,
}: AgentRunningViewProps) {
  const { t } = useTranslation('workbench')
  const titleKey =
    kind === 'plan'
      ? 'momentsRunningPlanTitle'
      : kind === 'rewrite'
        ? 'momentsRunningRewriteTitle'
        : 'momentsRunningCopyTitle'
  const descKey =
    kind === 'plan'
      ? 'momentsRunningPlanDesc'
      : kind === 'rewrite'
        ? 'momentsRunningRewriteDesc'
        : 'momentsRunningCopyDesc'

  const progressIds = useMemo(() => defs.map((def) => def.id), [defs])

  return (
    <div className="moments-running">
      <header className="moments-running__head">
        <div>
          <h2 className="moments-running__title">{t(titleKey)}</h2>
          <p className="moments-running__desc">{t(descKey)}</p>
        </div>
        <div className="moments-running__head-actions">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t('momentsStop')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onBack}>
            {t('momentsBackToOverview')}
          </Button>
        </div>
      </header>
      <p className="moments-running__tip">{t('momentsRunningTip')}</p>
      <WorkflowRunCard
        title={headline || t('momentsPreparing')}
        status={error ? 'failed' : 'running'}
        chips={[t(kind === 'plan' ? 'momentsPlanAgentName' : 'momentsCopyAgentName')]}
        snapshot={snapshot}
        defs={defs}
        progressIds={progressIds}
        progressFromSnapshot
        defaultStepsOpen
        streamingText={streamingText}
        mock={mock}
        error={error}
        onCancel={onCancel}
      />
    </div>
  )
}
