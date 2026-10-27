import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@no996/ui/checkbox'
import { Field, FieldLabel } from '@no996/ui/field'
import { Check, Mic, RotateCcw, Upload } from 'lucide-react'
import { normalizeCloneSampleFile } from '../../../lib/audio/encode-wav'
import { toastError } from '../../../lib/toast'
import { CLONE_DISPLAY_NAME_MAX } from '../voice-constants'
import {
  CLONE_READ_SCENE_IDS,
  cloneNameSuggestions,
  cloneSceneLabel,
  cloneSceneText,
  type CloneReadSceneId,
} from '../voice-i18n'
import { cloneSampleDisplayName } from '../clone-sample-display'
import { resolveCloneBenefitCopy, resolveClonePricing } from '../voice-clone-pricing'
import type { VoiceCloneMeta } from '../../../api/voice-clone'
import { VoiceLiveWaveform } from './VoiceLiveWaveform'

const UPLOAD_ACCEPT = 'audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/mp4'
const MAX_MB = 20
const CLONE_RECORD_GUIDE_SEC = 30

type Props = {
  meta: VoiceCloneMeta | null
  busy: boolean
  error?: string
  embedded?: boolean
  onCancel?: () => void
  onSubmit: (payload: { displayName: string; file: File }) => void
}

export function CloneWizard({ meta, busy, error, embedded = false, onCancel, onSubmit }: Props) {
  const { t, i18n } = useTranslation('voice')
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'zh-CN'
  const [step, setStep] = useState(1)
  const [scene, setScene] = useState<CloneReadSceneId>('random')
  const [sampleFile, setSampleFile] = useState<File | null>(null)
  const [samplePreviewUrl, setSamplePreviewUrl] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordSec, setRecordSec] = useState(0)
  const [name, setName] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [samplePreparing, setSamplePreparing] = useState(false)
  const [sampleDurationSec, setSampleDurationSec] = useState(0)
  const [liveAnalyser, setLiveAnalyser] = useState<AnalyserNode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordSecRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      if (samplePreviewUrl) URL.revokeObjectURL(samplePreviewUrl)
      stopRecordCleanup()
    }
  }, [samplePreviewUrl])

  useEffect(() => {
    if (error) toastError(error)
  }, [error])

  function stopRecordCleanup() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    setLiveAnalyser(null)
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  async function applySampleFile(file: File, durationSec = 0) {
    const err = validateFile(file)
    if (err) {
      toastError(err)
      return
    }
    setSamplePreparing(true)
    try {
      const normalized = await normalizeCloneSampleFile(file)
      setSample(normalized)
      if (durationSec > 0) setSampleDurationSec(durationSec)
    } catch {
      toastError(t('clone.error.audioProcess'))
    } finally {
      setSamplePreparing(false)
    }
  }

  function setSample(file: File | null) {
    if (samplePreviewUrl) URL.revokeObjectURL(samplePreviewUrl)
    setSampleFile(file)
    setSamplePreviewUrl(file ? URL.createObjectURL(file) : '')
    if (!file) setSampleDurationSec(0)
  }

  function validateFile(file: File): string | null {
    if (file.size === 0 || file.size > MAX_MB * 1024 * 1024) {
      return t('clone.error.fileEmpty', { max: MAX_MB })
    }
    const okTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/x-m4a',
      'audio/webm',
      'audio/ogg',
    ]
    if (!okTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.webm')) {
      return t('clone.error.fileFormat')
    }
    return null
  }

  function onPickFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    void applySampleFile(file)
  }

  function shuffleScene() {
    const keys = [...CLONE_READ_SCENE_IDS]
    const pool = keys.length > 1 ? keys.filter((k) => k !== scene) : keys
    const next = pool[Math.floor(Math.random() * pool.length)] ?? 'random'
    setScene(next)
  }

  async function toggleRecord() {
    if (recording) {
      const rec = mediaRecorderRef.current
      if (!rec || rec.state === 'inactive') return
      rec.stop()
      return
    }
    if (!authorized) {
      toastError(t('clone.error.authRequired'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      await ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.55
      analyser.minDecibels = -90
      analyser.maxDecibels = -10
      const silentGain = ctx.createGain()
      silentGain.gain.value = 0
      source.connect(analyser)
      source.connect(silentGain)
      silentGain.connect(ctx.destination)
      audioCtxRef.current = ctx
      setRecording(true)
      setLiveAnalyser(analyser)
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        setRecording(false)
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current)
          recordTimerRef.current = null
        }
        const blob = new Blob(chunksRef.current, { type: mime })
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setLiveAnalyser(null)
        void audioCtxRef.current?.close().catch(() => {})
        audioCtxRef.current = null
        const sec = recordSecRef.current
        setRecordSec(0)
        recordSecRef.current = 0
        if (sec < 5) {
          toastError(t('clone.error.tooShort'))
          return
        }
        const ext = mime.includes('webm') ? 'webm' : 'audio'
        const file = new File([blob], `${t('clone.recordFileName')}.${ext}`, { type: blob.type })
        void applySampleFile(file, sec)
      }
      mediaRecorderRef.current = rec
      rec.start(250)
      setRecordSec(0)
      recordSecRef.current = 0
      recordTimerRef.current = setInterval(() => {
        recordSecRef.current += 1
        setRecordSec(recordSecRef.current)
      }, 1000)
    } catch {
      toastError(t('clone.error.micDenied'))
    }
  }

  const pricing = resolveClonePricing(meta)
  const cloneBenefits = resolveCloneBenefitCopy(pricing)
  const stepLabels = t('clone.stepLabels', { returnObjects: true }) as string[]
  const introTitle = step === 1 ? t('clone.step1Title') : t('clone.step2Title')
  const introLead = step === 1 ? t('clone.step1Lead') : t('clone.step2Lead')
  const nameSuggestions = cloneNameSuggestions(t)
  const guideItems = t('clone.guideItems', { returnObjects: true }) as string[]

  function formatDeckClock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  const recordProgressPct = sampleFile
    ? 100
    : recording
      ? Math.min(100, (recordSec / CLONE_RECORD_GUIDE_SEC) * 100)
      : 0

  const panelClass = [
    'voice-clone-panel',
    embedded ? 'voice-clone-panel--embedded' : 'voice-clone-panel--dialog',
  ].join(' ')

  return (
    <div className={panelClass}>
      <div className="voice-clone-panel__scroll">
        <div className="voice-clone-intro-bar">
          <div className="voice-clone-intro-bar__copy">
            <h2 className="voice-clone-page-title" id="voice-clone-intro-title">{introTitle}</h2>
            <p className="voice-clone-page-subtitle">{introLead}</p>
          </div>
          <div className="voice-steps voice-steps--ref" aria-label={t('clone.stepsAria')}>
            {stepLabels.map((label, i) => {
              const n = i + 1
              const state = step === n ? 'on' : step > n ? 'done' : 'pending'
              return (
                <div key={label} className="voice-step-ref">
                  {i > 0 ? <span className="voice-step-ref__rail" aria-hidden /> : null}
                  <div
                    className={`voice-step-dot voice-step-dot--${state}`}
                    aria-current={step === n ? 'step' : undefined}
                  >
                    <div className="voice-step-dot__row">
                      <span className="voice-step-dot__badge" aria-hidden>
                        {state === 'done' ? <Check size={12} strokeWidth={2.75} /> : n}
                      </span>
                      <span className="voice-step-dot__label">{label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {step === 1 ? (
          <section className="voice-clone-step1-ref" aria-labelledby="voice-clone-intro-title">
            <div className="voice-clone-sheet">
            <div className="voice-clone-step1-ref__grid">
              <div className="voice-clone-step1-ref__script">
                <div className="voice-clone-scene-toolbar">
                  <div className="voice-hint-row voice-clone-scenes">
                    {CLONE_READ_SCENE_IDS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className="voice-chip voice-chip--scene"
                        aria-pressed={scene === key}
                        onClick={() => setScene(key)}
                      >
                        {cloneSceneLabel(t, key)}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="voice-clone-shuffle" onClick={shuffleScene}>
                    <RotateCcw size={14} strokeWidth={2} aria-hidden />
                    {t('clone.shuffle')}
                  </button>
                </div>
                <div className="voice-read-box voice-read-box--ref" key={scene}>
                  <div className="voice-read-box__passage">
                    <p className="voice-read-box__copy">{cloneSceneText(t, scene)}</p>
                  </div>
                </div>
                <Field
                  orientation="horizontal"
                  className="voice-clone-auth voice-clone-auth--script"
                >
                  <Checkbox
                    className="voice-clone-auth__checkbox"
                    checked={authorized}
                    disabled={busy}
                    onCheckedChange={(checked) => setAuthorized(checked === true)}
                  />
                  <FieldLabel className="voice-clone-auth__text">
                    {t('clone.auth')}
                  </FieldLabel>
                </Field>
              </div>

              <div className="voice-clone-capture-deck">
                <button
                  type="button"
                  className={['voice-clone-deck-mic', recording ? 'voice-clone-deck-mic--rec' : ''].filter(Boolean).join(' ')}
                  aria-label={t('clone.recordAria', {
                    action: recording
                      ? t('clone.recordStop')
                      : sampleFile
                        ? t('clone.recordAgain')
                        : t('clone.recordStart'),
                  })}
                  disabled={busy || samplePreparing}
                  onClick={() => void toggleRecord()}
                >
                  <Mic size={28} strokeWidth={1.75} />
                </button>
                <p className="voice-clone-deck-title">
                  {samplePreparing
                    ? t('clone.recordPreparing')
                    : recording
                      ? t('clone.recording')
                      : sampleFile
                        ? t('clone.recordAgain')
                        : t('clone.recordCta')}
                </p>
                <p className="voice-clone-deck-sub">
                  {samplePreparing ? t('clone.recordHintPreparing') : t('clone.recordHintActive')}
                </p>

                <VoiceLiveWaveform
                  className="voice-clone-deck-wave"
                  tone="deck"
                  analyser={liveAnalyser}
                  active={recording && liveAnalyser != null}
                />

                <div className="voice-clone-deck-progress" aria-hidden>
                  <div
                    className="voice-clone-deck-progress__fill"
                    style={{ width: `${recordProgressPct}%` }}
                  />
                </div>
                <div className="voice-clone-deck-times">
                  <span>{formatDeckClock(recording ? recordSec : sampleDurationSec)}</span>
                  <span className="voice-clone-deck-times__hint">{t('clone.guideSeconds')}</span>
                  <span>{t('clone.guideSecondsValue', { sec: CLONE_RECORD_GUIDE_SEC })}</span>
                </div>

                <button
                  type="button"
                  className="voice-clone-deck-upload"
                  disabled={busy || samplePreparing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} strokeWidth={2} aria-hidden />
                  {t('clone.uploadInstead')}
                </button>
                <p className="voice-clone-deck-upload-hint">{t('clone.uploadFormats')}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept={UPLOAD_ACCEPT}
                  onChange={(e) => {
                    onPickFile(e.target.files)
                    e.target.value = ''
                  }}
                />

                {sampleFile ? (
                  <div className="voice-clone-deck-sample" aria-label={t('clone.sampleAria')}>
                    <div className="voice-clone-deck-sample__head">
                      <span className="voice-clone-deck-sample__status">{t('clone.sampleSelected')}</span>
                      <span className="voice-clone-deck-sample__name" title={sampleFile.name}>
                        {cloneSampleDisplayName(sampleFile)}
                      </span>
                      <button
                        type="button"
                        className="voice-clone-deck-sample__remove"
                        onClick={() => setSample(null)}
                      >
                        {t('clone.removeSample')}
                      </button>
                    </div>
                    <audio
                      controls
                      src={samplePreviewUrl}
                      aria-label={t('clone.previewSampleAria')}
                      className="voice-clone-deck-sample__audio"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="voice-clone-step2-ref" aria-labelledby="voice-clone-intro-title">
            <div className="voice-clone-sheet voice-clone-sheet--step2">
              <div className="voice-clone-step2-ref__grid">
                <div className="voice-clone-step2-form">
                  <div className="voice-clone-form__field">
                    <label className="voice-field-label" htmlFor="voice-clone-name">{t('clone.nameLabel')}</label>
                    <p className="voice-clone-form__hint">{t('clone.nameHint')}</p>
                    <div className="voice-clone-form__input-wrap">
                      <input
                        id="voice-clone-name"
                        className="voice-text-input voice-clone-form__input"
                        maxLength={CLONE_DISPLAY_NAME_MAX}
                        value={name}
                        disabled={busy}
                        placeholder={t('clone.namePlaceholder')}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <span className="voice-clone-form__counter" aria-live="polite">
                        {name.length} / {CLONE_DISPLAY_NAME_MAX}
                      </span>
                    </div>
                  </div>
                  <div className="voice-clone-form__suggestions" role="group" aria-label={t('clone.suggestionsAria')}>
                    {nameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="voice-chip voice-chip--scene voice-clone-form__suggestion"
                        disabled={busy}
                        aria-pressed={name === suggestion}
                        onClick={() => setName(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <div className="voice-clone-form__guide" aria-labelledby="voice-clone-step2-guide-title">
                    <p className="voice-clone-form__guide-title" id="voice-clone-step2-guide-title">
                      {t('clone.guideTitle')}
                    </p>
                    <ul className="voice-clone-form__guide-list">
                      {guideItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="voice-clone-form__auth-readonly">
                    <Checkbox
                      className="voice-clone-auth__checkbox"
                      checked={authorized}
                      disabled
                      aria-hidden
                      tabIndex={-1}
                    />
                    <p className="voice-clone-form__auth-copy">
                      {t('clone.auth')}
                    </p>
                  </div>
                </div>

                <aside className="voice-clone-billing-deck" aria-label={t('clone.billingAria')}>
                  <p className="voice-clone-billing-deck__lead">{t('clone.billingLead')}</p>
                  {pricing.points != null ? (
                    <p className="voice-clone-billing-deck__points">
                      <span className="voice-clone-billing-deck__points-value">
                        {pricing.points.toLocaleString(locale)}
                      </span>
                      <span className="voice-clone-billing-deck__points-unit">{t('clone.pointsUnit')}</span>
                    </p>
                  ) : (
                    <p className="voice-clone-billing-deck__points voice-clone-billing-deck__points--pending">
                      {t('clone.pricingLoading')}
                    </p>
                  )}
                  {pricing.saleYuan ? (
                    <p className="voice-clone-billing-deck__yuan">{t('clone.approxYuan', { yuan: pricing.saleYuan })}</p>
                  ) : null}
                  <div className="voice-clone-billing-deck__perks">
                    <p className="voice-clone-billing-deck__perk-title">{cloneBenefits.perkTitle}</p>
                    <p className="voice-clone-billing-deck__perk-lead">{cloneBenefits.perkLead}</p>
                    <ul className="voice-clone-billing-deck__perk-list">
                      {cloneBenefits.perks.map((perk) => (
                        <li key={perk}>{perk}</li>
                      ))}
                    </ul>
                  </div>
                  <ul className="voice-clone-billing-deck__facts">
                    <li>
                      <Check size={14} strokeWidth={2.5} aria-hidden />
                      {t('clone.noChargeOnFail')}
                    </li>
                    <li>
                      <Check size={14} strokeWidth={2.5} aria-hidden />
                      {t('clone.afterApprove')}
                    </li>
                  </ul>
                </aside>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <footer className={['voice-clone-panel__footer', step === 1 ? 'voice-clone-panel__footer--step1' : ''].filter(Boolean).join(' ')}>
        {step === 1 ? (
          <>
            <div className="voice-clone-footer-bar">
              <p className="voice-clone-footer-hint">{t('clone.footerHint')}</p>
              <div className="voice-clone-footer-actions">
                {onCancel ? (
                  <button type="button" className="voice-btn-ghost voice-clone-btn-cancel" disabled={busy} onClick={onCancel}>
                    {t('clone.cancel')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="voice-btn-primary voice-clone-btn-next"
                  disabled={!sampleFile || !authorized || busy || samplePreparing}
                  onClick={() => setStep(2)}
                >
                  {t('clone.next')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="voice-clone-nav">
            <button type="button" className="voice-btn-ghost" disabled={busy} onClick={() => setStep(1)}>
              {t('clone.prev')}
            </button>
            <button
              type="button"
              className="voice-btn-primary"
              disabled={busy || !authorized || !name.trim() || !sampleFile || !meta?.enabled}
              onClick={() => {
                if (!sampleFile) return
                onSubmit({ displayName: name.trim(), file: sampleFile })
              }}
            >
              <Mic size={18} style={{ marginRight: 6, verticalAlign: -3 }} />
              {busy ? t('clone.submitting') : t('clone.submit')}
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
