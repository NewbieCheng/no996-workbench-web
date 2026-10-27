import { Check, History } from 'lucide-react'
import {
  GlassMenuDropdown,
  GlassMenuDropdownContent,
  GlassMenuDropdownItem,
  GlassMenuDropdownTrigger,
} from '@no996/ui/glass-menu-dropdown'
import type { DigitalHumanSegment } from './lib/project-store'
import { activeDigitalHumanVersion } from './lib/project-store'

type SegmentTakeSelectProps = {
  segment: DigitalHumanSegment
  statusLabel: (value?: string) => string
  disabled?: boolean
  onSelectTake: (takeId: string) => void
}

const MAX_VISIBLE_TAKES = 5

function takeNumber(versions: DigitalHumanSegment['versions'], takeId: string): number {
  const index = versions.findIndex(v => v.id === takeId)
  return index >= 0 ? index + 1 : versions.length
}

/** 最近 N 个版本；若当前选中不在列表内，替换最旧一项以保证可选 */
function visibleTakes(segment: DigitalHumanSegment, activeId: string) {
  const { versions } = segment
  const newestFirst = [...versions].reverse()
  let list = newestFirst.slice(0, MAX_VISIBLE_TAKES)
  if (!list.some(t => t.id === activeId)) {
    const active = versions.find(v => v.id === activeId)
    if (active) {
      list = [active, ...newestFirst.filter(t => t.id !== activeId)].slice(0, MAX_VISIBLE_TAKES)
      list.sort((a, b) => versions.indexOf(a) - versions.indexOf(b)).reverse()
    }
  }
  return list
}

export function SegmentTakeSelect({ segment, statusLabel, disabled, onSelectTake }: SegmentTakeSelectProps) {
  if (segment.versions.length === 0) return null

  const activeTake = activeDigitalHumanVersion(segment)
  const activeId = activeTake?.id ?? segment.versions[segment.versions.length - 1]?.id
  const takeNum = takeNumber(segment.versions, activeId)
  const menuTakes = visibleTakes(segment, activeId)
  const truncated = segment.versions.length > MAX_VISIBLE_TAKES

  return (
    <div className="dh-segment-take-select" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <GlassMenuDropdown>
        <GlassMenuDropdownTrigger
          disabled={disabled}
          render={
            <button
              type="button"
              className="dh-segment-take-select__btn"
              disabled={disabled}
              aria-label={`镜头版本 Take ${takeNum}（${statusLabel(activeTake?.status)}）`}
              title={`Take ${takeNum}（${statusLabel(activeTake?.status)}）`}
            >
              <History size={14} aria-hidden />
            </button>
          }
        />
          <GlassMenuDropdownContent align="end" className="w-56">
            <p className="persona-injection__menu-label persona-binding__menu-label">
              镜头版本{truncated ? `（最近 ${MAX_VISIBLE_TAKES} 个）` : ''}
            </p>
            {menuTakes.map(take => {
              const num = takeNumber(segment.versions, take.id)
              const selected = take.id === activeId
              return (
                <GlassMenuDropdownItem
                  key={take.id}
                  className="persona-injection__item dh-dub-settings__menu-item"
                  data-current={selected ? 'true' : undefined}
                  onClick={() => onSelectTake(take.id)}
                >
                  <span className="persona-injection__item-name flex-1 min-w-0">
                    Take {num} ({statusLabel(take.status)})
                  </span>
                  {selected ? <Check size={14} className="shrink-0 opacity-70" aria-hidden /> : null}
                </GlassMenuDropdownItem>
              )
            })}
          </GlassMenuDropdownContent>
      </GlassMenuDropdown>
    </div>
  )
}
