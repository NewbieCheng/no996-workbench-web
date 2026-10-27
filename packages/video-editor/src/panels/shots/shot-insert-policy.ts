/**
 * 镜头库上轴策略：分镜镜头走镜头轨；部分全屏特效走视频/贴图轨。
 */

import type { TrackType } from '../../core/project.ts'

export type ShotInsertTrackType = 'shot' | 'video' | 'overlay'
export type ShotInsertPlacement = 'track_end' | 'playhead'

export type ShotInsertPolicy = {
  trackType: ShotInsertTrackType
  placement: ShotInsertPlacement
  /** 图层镜头可拖到镜头轨末尾，纳入故事线播放 */
  allowStorylineMove?: boolean
}

const LAYER_SHOT_POLICIES: Record<string, ShotInsertPolicy> = {
  'opening/text-as-mask': { trackType: 'video', placement: 'track_end', allowStorylineMove: true },
}

export function getShotInsertPolicy(shotId: string): ShotInsertPolicy {
  return LAYER_SHOT_POLICIES[shotId] ?? { trackType: 'shot', placement: 'track_end' }
}

export function shotPolicyTrackType(shotId: string): TrackType {
  return getShotInsertPolicy(shotId).trackType
}

/** 镜头可落在画面类轨道：故事线默认轨、主视频、贴图 */
export function canLandShotOnTrack(_shotId: string, trackType: TrackType): boolean {
  return trackType === 'shot' || trackType === 'video' || trackType === 'overlay'
}

/** 镜头均可竖向跨轨（画面类轨道之间） */
export function shotElementAllowsCrossTrack(_shotId: string): boolean {
  return true
}
