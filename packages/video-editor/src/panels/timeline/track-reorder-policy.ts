import type { TimelineTrack, TrackType } from '../../core/project.ts'

const VISUAL_TRACK_TYPES: ReadonlySet<TrackType> = new Set(['shot', 'video', 'overlay'])

/** 轨头拖拽排序：镜头轨可与视频/贴图轨在视效组内互换叠层顺序 */
export function canReorderTrackPair(from: TimelineTrack, to: TimelineTrack): boolean {
  if (from.locked || to.locked) return false
  if (from.type === 'shot' || to.type === 'shot') {
    return VISUAL_TRACK_TYPES.has(from.type) && VISUAL_TRACK_TYPES.has(to.type)
  }
  return true
}
