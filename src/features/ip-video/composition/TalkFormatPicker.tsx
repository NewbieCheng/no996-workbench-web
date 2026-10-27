import { TALK_FORMAT_CHOICES, type TalkFormatRatio } from './talk-format'
import { useTalkV2Copy } from './v2-copy'

const LABELS: Record<TalkFormatRatio, 'formatPortrait' | 'formatLandscape' | 'square'> = {
  '9:16': 'formatPortrait',
  '16:9': 'formatLandscape',
  '1:1': 'square',
}

export function TalkFormatPicker({
  value, busy = false, onSelect,
}: {
  value: string
  busy?: boolean
  onSelect: (ratio: TalkFormatRatio) => void
}) {
  const { t } = useTalkV2Copy()
  return <div className="ipt-format-picker" role="group" aria-label={t('formatPicker')}>
    {TALK_FORMAT_CHOICES.map(item => {
      const selected = value === item.ratio
      return <button
        key={item.ratio}
        type="button"
        className="ipt-format-choice"
        aria-pressed={selected}
        disabled={busy}
        onClick={() => onSelect(item.ratio)}
      >
        <span className="ipt-format-choice__frame" style={{ aspectRatio: item.aspect }} aria-hidden />
        <span>{t(LABELS[item.ratio])}</span>
      </button>
    })}
  </div>
}
