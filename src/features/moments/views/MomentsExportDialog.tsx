import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DownloadIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@no996/ui/dialog'
import { Input } from '@no996/ui/input'
import { Label } from '@no996/ui/label'
import { toastError } from '../../../lib/toast'
import { downloadText } from '../../../services/browser'
import { listContents, listItems } from '../../../services/moments/idb-repository'
import { resolveMomentsBody } from '../domain/moments'

export function MomentsExportDialog({ weekStart, weekEnd }: { weekStart: string; weekEnd: string }) {
  const { t } = useTranslation('workbench')
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(weekStart)
  const [end, setEnd] = useState(weekEnd)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function exportMarkdown() {
    if (!start || !end || start > end) { setError(t('momentsExportInvalidRange')); return }
    setBusy(true)
    setError('')
    try {
      const [allItems, allContents] = await Promise.all([listItems(), listContents()])
      const items = allItems.filter((item) => item.date >= start && item.date <= end)
      if (!items.length) { setError(t('momentsExportEmpty')); return }
      const contents = new Map(allContents.map((content) => [content.scheduleItemId, content]))
      const lines = [`# ${t('momentsExportTitle')}`, '', `> ${start} — ${end}`, '']
      for (const date of [...new Set(items.map((item) => item.date))]) {
        lines.push(`## ${date}`, '')
        for (const item of items.filter((row) => row.date === date)) {
          const content = contents.get(item.id)
          lines.push(`### ${String(item.publishOrder).padStart(2, '0')} · ${item.topic}`, '', `**${t('momentsContentDirection')}**：${item.contentDirection}`, '')
          if (item.captureSuggestion?.trim()) lines.push(`**${t('momentsCaptureSuggestion')}**：${item.captureSuggestion.trim()}`, '')
          if (content) {
            if (content.usedMock) lines.push(`> ${t('momentsExportDemo')}`, '')
            lines.push(resolveMomentsBody(content), '')
          } else lines.push(`> ${t('momentsExportPending')}`, '')
          lines.push('---', '')
        }
      }
      downloadText(lines.join('\n'), `moments-${start}-${end}.md`, 'text/markdown;charset=utf-8')
      setOpen(false)
    } catch {
      toastError(t('momentsExportFailed'))
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setStart(weekStart); setEnd(weekEnd); setError('') } }}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}><DownloadIcon className="h-4 w-4" />{t('momentsExportButton')}</DialogTrigger>
      <DialogContent showCloseButton className="gap-2.5 sm:max-w-md">
        <DialogHeader className="gap-0.5">
          <DialogTitle>{t('momentsExportTitle')}</DialogTitle>
          <DialogDescription>{t('momentsExportDescription')}</DialogDescription>
        </DialogHeader>
        <div className="moments-export__dates">
          <div><Label htmlFor="moments-export-start">{t('momentsExportStart')}</Label><Input id="moments-export-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></div>
          <div><Label htmlFor="moments-export-end">{t('momentsExportEnd')}</Label><Input id="moments-export-end" type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></div>
        </div>
        {error && <p role="alert" className="moments-export__error">{error}</p>}
        <DialogFooter className="mt-0.5">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{t('momentsCancel')}</Button>
          <Button size="sm" disabled={busy} onClick={() => void exportMarkdown()}>{t('momentsExportMarkdown')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
