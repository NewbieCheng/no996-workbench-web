import { useTranslation } from 'react-i18next'
import { Input } from '@no996/ui/input'

type RangeSliderProps = {
  min: number
  max: number
  step: number
  value: number
  labelKey: string
  onValueChange: (value: number) => void
}

export function RangeSlider({ min, max, step, value, labelKey, onValueChange }: RangeSliderProps) {
  const { t } = useTranslation('ipVideo')
  const progress = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0
  return <Input
    className="ipt-range-slider"
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    aria-label={t(`talkEditor.ranges.${labelKey}`)}
    style={{ '--ipt-range-progress': `${progress}%` } as CSSProperties}
    onChange={event => onValueChange(Number(event.target.value))}
  />
}
