import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Download, Film } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { useTalkV2Copy } from '../v2-copy'
import { TalkStepShell } from './TalkStepShell'

export function TalkExportStep({
  coverPanel,
  issues,
  exporting,
  exportedUrl,
  exportStatus,
  onExport,
  onDownload,
  onBack,
  onOpenAdvanced,
}: {
  coverPanel: ReactNode
  issues: string[]
  exporting: boolean
  exportedUrl?: string
  exportStatus?: ReactNode
  onExport: () => void
  onDownload: () => void
  onBack: () => void
  onOpenAdvanced: () => void
}) {
  const { t } = useTalkV2Copy()
  return <TalkStepShell
    stage="export"
    title={t('stepExport')}
    hint={t('stepExportHint')}
    primary={{
      label: t(exporting ? 'exporting' : 'exportVideo'),
      onClick: onExport,
      disabled: exporting || issues.length > 0,
      busy: exporting,
      icon: 'sparkles',
      testId: 'ipt-export',
    }}
    secondary={{ label: t('advancedSettings'), onClick: onOpenAdvanced, disabled: exporting }}
    onBack={onBack}
    backLabel={t('backToEdit')}
  >
    {coverPanel}
    <section className="ipt-export-checks" aria-labelledby="ipt-export-checks-title">
      <div className="ipt-section-heading"><h3 id="ipt-export-checks-title">{t('exportChecks')}</h3><Film size={16} aria-hidden /></div>
      {issues.length ? <ul>
        {issues.map(issue => <li key={issue}><AlertCircle size={15} aria-hidden /><span>{issue}</span></li>)}
      </ul> : <p className="ipt-export-ok"><CheckCircle2 size={16} aria-hidden />{t('exportReady')}</p>}
      {issues.length ? <div className="ipt-inline-actions"><Button type="button" variant="toolbar" size="sm" onClick={onBack}>{t('backToEdit')}</Button></div> : null}
    </section>
    {exportStatus}
    {exportedUrl ? <div className="ipt-export-done">
      <CheckCircle2 size={16} aria-hidden />
      <span>{t('exportDone')}</span>
      <Button type="button" variant="toolbar" size="sm" onClick={onDownload}><Download size={14} />{t('downloadVideo')}</Button>
    </div> : null}
  </TalkStepShell>
}
