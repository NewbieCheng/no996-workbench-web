import { useEffect, useState } from 'react'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { Textarea } from '@no996/ui/textarea'
import { useTalkV2Copy } from '../v2-copy'

const SIZES = [
  { value: '1024x1024', label: 'imageSquare' },
  { value: '1024x1536', label: 'imagePortrait' },
  { value: '1536x1024', label: 'imageLandscape' },
] as const

export function TalkAiImageDialog({
  open,
  onOpenChange,
  defaultPrompt,
  disabled = false,
  onGenerate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPrompt: string
  disabled?: boolean
  onGenerate: (prompt: string, size: string) => Promise<boolean>
}) {
  const { t } = useTalkV2Copy()
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [size, setSize] = useState('1024x1024')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    setPrompt(defaultPrompt)
    setError('')
  }, [open, defaultPrompt])
  const submit = async () => {
    if (busy || disabled || !prompt.trim()) return
    setBusy(true); setError('')
    try {
      const ok = await onGenerate(prompt.trim(), size)
      if (ok) onOpenChange(false)
      else setError(t('aiImageAddFailed'))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
    <DialogContent className="ipt-library-dialog sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle><ImagePlus size={17} aria-hidden />{t('aiImageTitle')}</DialogTitle>
        <DialogDescription>{t('aiImageHint')}</DialogDescription>
      </DialogHeader>
      <div className="ipt-ai-image-form">
        <label className="ipt-field">画面描述
          <Textarea value={prompt} rows={4} maxLength={2000} disabled={busy || disabled} placeholder={t('aiImagePromptPlaceholder')} onChange={event => setPrompt(event.target.value)} />
        </label>
        <div className="ipt-advanced-row">
          <span>图片比例</span>
          <Select items={SIZES.map(item => ({ value: item.value, label: t(item.label) }))} value={size} onValueChange={value => setSize(String(value ?? '1024x1024'))}>
            <SelectTrigger aria-label="图片比例" disabled={busy || disabled}><SelectValue /></SelectTrigger>
            <SelectContent>{SIZES.map(item => <SelectItem key={item.value} value={item.value}>{t(item.label)} · {item.value}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {error && <p className="ipt-template-error" role="alert">{error}</p>}
        <p className="ipt-help">{t('aiImagePaidHint')}</p>
        <div className="ipt-inline-actions">
          <Button type="button" variant="toolbar" disabled={busy} onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button type="button" variant="generate" disabled={busy || disabled || !prompt.trim()} onClick={() => void submit()}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ImagePlus size={15} />}
            {busy ? t('aiImageGenerating') : t('aiImageGenerate')}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
