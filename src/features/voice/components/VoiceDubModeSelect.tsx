import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'

const MODE_ITEMS = [
  { value: 'direct', label: '初级配音' },
  { value: 'advanced', label: '高阶拆段' },
] as const

type DubMode = (typeof MODE_ITEMS)[number]['value']

type Props = {
  value: DubMode
  onChange: (mode: DubMode) => void
  disabled?: boolean
}

/** 页头唯一入口：切换直配 / 高阶，避免与右侧坞重复。 */
export function VoiceDubModeSelect({ value, onChange, disabled }: Props) {
  return (
    <Select
      items={[...MODE_ITEMS]}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === 'direct' || next === 'advanced') onChange(next)
      }}
    >
      <SelectTrigger size="sm" className="voice-mode-select" aria-label="配音方式">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MODE_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
