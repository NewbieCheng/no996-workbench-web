import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@no996/ui/card'
import {
  AlignLeft,
  ChevronDown,
  Eraser,
  FileText,
  IndentIncrease,
  Loader2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { Button } from '@no996/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'
import { useLocalDocumentImport } from '@/lib/chat-attachments/use-local-document-import'
import { sanitizeManuscriptForVoice } from '../lib/manuscript-sanitize'
import { TTS_INPUT_MAX, estimateSpeechSeconds, formatMmSs } from '../voice-constants'

type Props = {
  text: string
  onTextChange: (text: string) => void
  disabled?: boolean
  busy?: boolean
  sampleText?: string
  placeholder?: string
  maxChars?: number
  rate?: number
}

export function VoiceManuscriptCard({
  text,
  onTextChange,
  disabled = false,
  busy = false,
  sampleText,
  placeholder,
  maxChars = TTS_INPUT_MAX,
  rate = 1,
}: Props) {
  const { t, i18n } = useTranslation('voice')
  const resolvedPlaceholder = placeholder ?? t('manuscript.placeholder')
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'zh-CN'
  const undoStackRef = useRef<string[]>([])
  const updateText = (nextText: string) => {
    if (nextText === text) return
    undoStackRef.current = [...undoStackRef.current.slice(-19), text]
    onTextChange(nextText)
  }
  const undoText = () => {
    const previousText = undoStackRef.current.pop()
    if (previousText !== undefined) onTextChange(previousText)
  }
  const { fileInputRef, importing, importHint, accept, openFilePicker, handleFileChange } =
    useLocalDocumentImport({
      profile: 'manuscriptTextOnly',
      onSuccess: (imported) => updateText(sanitizeManuscriptForVoice(imported)),
    })

  const charCount = text.length
  const estSeconds = estimateSpeechSeconds(charCount, rate)
  const estFormatted = formatMmSs(estSeconds)
  const controlsDisabled = disabled || busy || importing
  const indentManuscript = () => {
    const indentedText = text.replace(/^(?=[^\r\n]*\S)[ \t\u3000]*/gm, '　　')
    updateText(indentedText)
  }
  const removeBlankLines = () => {
    updateText(text.split(/\r\n|\n|\r/).filter((line) => line.trim()).join('\n'))
  }
  const stripFormatSymbols = () => {
    updateText(sanitizeManuscriptForVoice(text))
  }

  return (
    <Card className="voice-panel-card voice-ms-card">
      <div className="voice-ms-editor-wrap">
        <textarea
          className="voice-ms-textarea"
          value={text}
          onChange={(e) => updateText(e.target.value)}
          maxLength={maxChars}
          placeholder={resolvedPlaceholder}
          disabled={controlsDisabled}
          aria-label={t('manuscript.aria')}
          aria-busy={importing}
        />
        {importing ? (
          <div className="voice-ms-import-overlay" role="status" aria-live="polite">
            <Loader2 className="size-5 voice-spin" aria-hidden="true" />
            <span>{importHint ?? t('manuscript.parsing')}</span>
          </div>
        ) : null}
      </div>
      <div className="voice-ms-bar">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled}>
                <AlignLeft className="size-3.5" aria-hidden="true" />
                <span>{t('manuscript.tools')}</span>
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-44">
            {sampleText ? (
              <DropdownMenuItem disabled={controlsDisabled} onClick={() => updateText(sampleText)}>
                <FileText className="size-4" aria-hidden="true" />
                <span>{t('manuscript.fillSample')}</span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={controlsDisabled} onClick={openFilePicker}>
              <Upload className="size-4" aria-hidden="true" />
              <span>{t('manuscript.upload')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={controlsDisabled || !text.trim()} onClick={indentManuscript}>
              <IndentIncrease className="size-4" aria-hidden="true" />
              <span>{t('manuscript.indent')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={controlsDisabled || !text.trim()} onClick={removeBlankLines}>
              <Eraser className="size-4" aria-hidden="true" />
              <span>{t('manuscript.removeBlank')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={controlsDisabled || !text.trim()} onClick={stripFormatSymbols}>
              <Eraser className="size-4" aria-hidden="true" />
              <span>{t('manuscript.stripMarkdown')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={controlsDisabled || undoStackRef.current.length === 0} onClick={undoText}>
              <Undo2 className="size-4" aria-hidden="true" />
              <span>{t('manuscript.undo')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={controlsDisabled || !text}
              variant="destructive"
              onClick={() => updateText('')}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              <span>{t('manuscript.clear')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => void handleFileChange(e)}
        />
        <span className="voice-ms-spacer" />
        <span
          className="voice-ms-count"
          title={t('manuscript.charCountTitle', { max: maxChars.toLocaleString(locale) })}
        >
          {t('manuscript.charCount', {
            current: charCount.toLocaleString(locale),
            max: maxChars.toLocaleString(locale),
            duration: estFormatted,
          })}
        </span>
      </div>
    </Card>
  )
}
