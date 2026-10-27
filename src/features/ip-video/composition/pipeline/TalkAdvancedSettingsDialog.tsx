import { useEffect, useState } from 'react'
import { AudioLines, RefreshCw, RotateCcw, Settings2, UserRound } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import { Switch } from '@no996/ui/switch'
import { Textarea } from '@no996/ui/textarea'
import { PersonaInjectionToggle, type PersonaInjectionState } from '../../../../components/agent/PersonaInjection'
import { TALK_CAPTION_PRESETS } from '../talk-model'
import type { TalkBriefOptions } from '../talk-options'
import { useTalkV2Copy } from '../v2-copy'
import { useTemplateCopy } from '../templates/copy'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  options: TalkBriefOptions
  onOptionsChange: (next: TalkBriefOptions) => void
  persona: PersonaInjectionState
  script: string
  onScriptChange: (value: string) => void
  onScriptCommit: () => void
  hasResult: boolean
  onUseDigital: () => void
  onUseAudio: () => void
  onUploadAudio: () => void
  onRebuild: () => void
  onReset: () => void
  changedCount: number
}

export function TalkAdvancedSettingsDialog({
  open,
  onOpenChange,
  busy,
  options,
  onOptionsChange,
  persona,
  script,
  onScriptChange,
  onScriptCommit,
  hasResult,
  onUseDigital,
  onUseAudio,
  onUploadAudio,
  onRebuild,
  onReset,
  changedCount,
}: Props) {
  const { t } = useTalkV2Copy()
  const { builtinName } = useTemplateCopy()
  const [scriptDraft, setScriptDraft] = useState(script)
  useEffect(() => { if (open) setScriptDraft(script) }, [open, script])
  const set = (patch: Partial<TalkBriefOptions>) => onOptionsChange({ ...options, ...patch })
  const setPreserve = (key: keyof TalkBriefOptions['preserve'], value: boolean) => onOptionsChange({ ...options, preserve: { ...options.preserve, [key]: value } })
  const choosePreset = (id: string | undefined) => set({ captionPresetId: id, preserve: { ...options.preserve, captions: false } })
  const motionItems = [
    { value: 'auto', label: t('aiChoose') },
    { value: 'calm', label: t('calm') },
    { value: 'normal', label: t('normal') },
    { value: 'lively', label: t('lively') },
  ]
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="ipt-advanced-dialog sm:max-w-[680px]">
      <DialogHeader className="ipt-advanced-dialog__head">
        <DialogTitle><Settings2 size={17} aria-hidden />{t('advancedSettings')}</DialogTitle>
        <DialogDescription>{t('advancedSettingsHint')}</DialogDescription>
      </DialogHeader>
      <div className="ipt-advanced-dialog__body">
        <section className="ipt-advanced-section" aria-labelledby="ipt-advanced-script">
          <div className="ipt-advanced-section__head">
            <h3 id="ipt-advanced-script">{t('advancedScriptSection')}</h3>
            <span className="ipt-tag">{t('scopeNextRun')}</span>
          </div>
          <div className="ipt-seg" role="radiogroup" aria-label={t('scriptMode')}>
            {([
              ['auto', t('scriptAutoShort')],
              ['verbatim', t('scriptVerbatimShort')],
              ['rewrite', t('scriptRewriteShort')],
            ] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={options.scriptMode === value} className={options.scriptMode === value ? 'on' : undefined} disabled={busy} onClick={() => set({ scriptMode: value })}>{label}</button>)}
          </div>
          <p className="ipt-help">{t(options.scriptMode === 'verbatim' ? 'scriptVerbatimHint' : options.scriptMode === 'rewrite' ? 'scriptRewriteHint' : 'scriptAutoHint')}</p>
          <label className="ipt-field">{t('fullScript')}
            <Textarea
              value={scriptDraft}
              disabled={busy}
              rows={5}
              maxLength={12000}
              onChange={event => { setScriptDraft(event.target.value); onScriptChange(event.target.value) }}
              onBlur={onScriptCommit}
            />
          </label>
        </section>

        <section className="ipt-advanced-section" aria-labelledby="ipt-advanced-look">
          <div className="ipt-advanced-section__head">
            <h3 id="ipt-advanced-look">{t('advancedLookSection')}</h3>
            <span className="ipt-tag">{t('scopeNextRun')}</span>
          </div>
          <div className="ipt-advanced-presets" role="radiogroup" aria-label={t('captionStyle')}>
            <button type="button" role="radio" aria-checked={!options.captionPresetId && !options.preserve.captions} className={!options.captionPresetId && !options.preserve.captions ? 'on' : undefined} disabled={busy} onClick={() => choosePreset(undefined)}>{t('aiChoose')}</button>
            {TALK_CAPTION_PRESETS.map(preset => <button key={preset.id} type="button" role="radio" aria-checked={options.captionPresetId === preset.id && !options.preserve.captions} className={options.captionPresetId === preset.id && !options.preserve.captions ? 'on' : undefined} disabled={busy} onClick={() => choosePreset(preset.id)}>{builtinName(preset.id)}</button>)}
          </div>
          <div className="ipt-advanced-row">
            <span>{t('motion')}</span>
            <div className="ipt-seg" role="radiogroup" aria-label={t('motion')}>
              {motionItems.map(item => <button key={item.value} type="button" role="radio" aria-checked={options.motion === item.value} className={options.motion === item.value ? 'on' : undefined} disabled={busy} onClick={() => set({ motion: item.value as TalkBriefOptions['motion'] })}>{item.label}</button>)}
            </div>
          </div>
          <p className="ipt-help">{t('advancedLookHint')}</p>
        </section>

        <section className="ipt-advanced-section" aria-labelledby="ipt-advanced-persona">
          <div className="ipt-advanced-section__head">
            <h3 id="ipt-advanced-persona">{t('advancedPersonaSection')}</h3>
            <span className="ipt-tag">{t('scopeNextRun')}</span>
          </div>
          <div className="ipt-advanced-persona"><UserRound size={15} aria-hidden /><PersonaInjectionToggle state={persona} /></div>
        </section>

        <section className="ipt-advanced-section" aria-labelledby="ipt-advanced-preserve">
          <div className="ipt-advanced-section__head">
            <h3 id="ipt-advanced-preserve">{t('preserve')}</h3>
            <span className="ipt-tag">{t('scopeNextRun')}</span>
          </div>
          <div className="ipt-advanced-switches">
            {([
              ['captions', t('keepCaptions')],
              ['composition', t('keepComposition')],
              ['shots', t('keepShots')],
            ] as const).map(([key, label]) => <label key={key} className="ipt-advanced-switch">
              <span>{label}</span>
              <Switch checked={options.preserve[key]} disabled={busy} onCheckedChange={checked => setPreserve(key, checked)} />
            </label>)}
          </div>
          <p className="ipt-help">{t('preserveHint')}</p>
        </section>

        <section className="ipt-advanced-section" aria-labelledby="ipt-advanced-source">
          <div className="ipt-advanced-section__head"><h3 id="ipt-advanced-source">{t('advancedSourceSection')}</h3><span className="ipt-tag">{t('scopeImmediate')}</span></div>
          <div className="ipt-advanced-actions">
            <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onUseDigital}><UserRound size={14} />{t('useDigital')}</Button>
            <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onUseAudio}><AudioLines size={14} />{t('useAudio')}</Button>
            <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onUploadAudio}><RefreshCw size={14} />{t('uploadAudio')}</Button>
          </div>
        </section>

        {hasResult && <section className="ipt-advanced-section ipt-advanced-section--danger" aria-labelledby="ipt-advanced-rebuild">
          <div className="ipt-advanced-section__head"><h3 id="ipt-advanced-rebuild">{t('rebuild')}</h3><span className="ipt-tag">{t('scopeImmediate')}</span></div>
          <p className="ipt-help">{t('rebuildHint')}</p>
          <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onRebuild}><RefreshCw size={14} />{t('rebuild')}</Button>
        </section>}
      </div>
      <footer className="ipt-advanced-dialog__foot">
        <span className="ipt-help">{t('advancedChanged', { count: changedCount })}</span>
        <div className="ipt-inline-actions">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onReset}><RotateCcw size={14} />{t('defaultSettings')}</Button>
          <Button type="button" variant="toolbar" size="sm" onClick={() => onOpenChange(false)}>{t('done')}</Button>
        </div>
      </footer>
    </DialogContent>
  </Dialog>
}
