/**
 * 时间轴顶栏图标：统一走 lucide-react（与 workbench 其它页面一致），不维护自绘 SVG。
 */

import type { LucideIcon } from 'lucide-react'
import {
  AudioWaveform,
  ChevronDown,
  ChevronUp,
  CloudCheck,
  CloudOff,
  FlipHorizontal2,
  FoldHorizontal,
  Pause,
  Play,
  Redo2,
  Repeat,
  Scissors,
  SkipBack,
  SkipForward,
  Trash2,
  Undo2,
  UnfoldHorizontal,
  ZoomIn,
} from 'lucide-react'

export type TimelineToolbarIconProps = {
  size?: number
  className?: string
}

const STROKE = 2

function LucideGlyph({
  icon: Icon,
  size = 13,
  className,
}: TimelineToolbarIconProps & { icon: LucideIcon }) {
  return <Icon size={size} strokeWidth={STROKE} className={className} aria-hidden />
}

export function IconTimelineSnap(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={UnfoldHorizontal} {...props} />
}

export function IconTimelineBeatDetect(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={AudioWaveform} {...props} />
}

export function IconTimelineSeekBack(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={SkipBack} {...props} />
}

export function IconTimelineSeekForward(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={SkipForward} {...props} />
}

export function IconTimelineLoop(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={Repeat} {...props} />
}

export function IconTimelineZoom(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={ZoomIn} {...props} />
}

export function IconTimelinePanelToggle({
  size,
  className,
  expanded = true,
}: TimelineToolbarIconProps & { expanded?: boolean }) {
  const Icon = expanded ? ChevronDown : ChevronUp
  return <LucideGlyph icon={Icon} size={size} className={className} />
}

export function IconTimelinePlay(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={Play} {...props} />
}

export function IconTimelinePause(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={Pause} {...props} />
}

export function IconTimelineSplit(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={Scissors} {...props} />
}

export function IconTimelineDelete(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={Trash2} {...props} />
}

export function IconTimelineFlip(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={FlipHorizontal2} {...props} />
}

export function IconTimelineUndo(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={Undo2} {...props} />
}

export function IconTimelineRedo(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={Redo2} {...props} />
}

export function IconTimelineRipple(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={FoldHorizontal} {...props} />
}

export function IconTimelineSaveOk(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={CloudCheck} {...props} />
}

export function IconTimelineSaveDirty(props: TimelineToolbarIconProps = {}) {
  return <LucideGlyph icon={CloudOff} {...props} />
}
