/**
 * 时间轴轨道分组与阶梯式高度规范
 *
 * 核心目标：
 * 1. 将散落平铺的轨道归类至「视效画面 / 图文包装 / 音频声轨」3 大主逻辑分组
 * 2. 差异化阶梯行高（文字轨 28px 极紧凑、音频轨 34px、镜头/主视频轨 44px）
 * 3. 严格保证左右两侧（TrackHeader 与 TrackView）像素级高度同步
 */

import type { TimelineTrack, TrackType } from '../../core/project.ts'

export type TrackGroupId = 'visuals' | 'graphics' | 'audio'

export type TimelineDensity = 'standard' | 'compact'

export type TrackGroupDef = {
  id: TrackGroupId
  title: string
  icon: 'visuals' | 'graphics' | 'audio'
  description: string
  trackTypes: readonly TrackType[]
}

export const TRACK_GROUPS: readonly TrackGroupDef[] = [
  {
    id: 'visuals',
    title: '视效画面',
    icon: 'visuals',
    description: '主视频剪辑、分镜镜头与画中画覆叠',
    trackTypes: ['shot', 'video', 'overlay'],
  },
  {
    id: 'graphics',
    title: '图文包装',
    icon: 'graphics',
    description: '标题、花字、角标与动态字幕',
    trackTypes: ['text'],
  },
  {
    id: 'audio',
    title: '音频声轨',
    icon: 'audio',
    description: '文稿配音、背景音乐 (BGM)、环境音效 (SFX)',
    trackTypes: ['audio'],
  },
] as const

/** 阶梯式高度对照表（像素） */
const TRACK_HEIGHT_SPEC: Record<TimelineDensity, Record<TrackType, number>> = {
  standard: {
    shot: 44,
    video: 44,
    overlay: 36,
    audio: 34,
    text: 28,
  },
  compact: {
    shot: 36,
    video: 36,
    overlay: 30,
    audio: 28,
    text: 24,
  },
}

const GROUP_HEADER_HEIGHT: Record<TimelineDensity, number> = {
  standard: 24,
  compact: 20,
}

/** 标尺与左侧「轨道」枢纽栏共用高度（须与 TimelineRuler 像素对齐） */
export const TIMELINE_RULER_HEIGHT = 24

/** 获取单条轨道的行高 */
export function getTrackHeight(type: TrackType, density: TimelineDensity = 'standard'): number {
  return TRACK_HEIGHT_SPEC[density][type] ?? (density === 'compact' ? 30 : 36)
}

/** 获取分组标题分隔条的行高 */
export function getGroupHeaderHeight(density: TimelineDensity = 'standard'): number {
  return GROUP_HEADER_HEIGHT[density] ?? 24
}

export type GroupedTracks = {
  group: TrackGroupDef
  tracks: TimelineTrack[]
  isCollapsed: boolean
}

/**
 * 将平铺的轨道列表按三大逻辑分类进行组织。
 * 如果某轨道类型未匹配进预设组，会回退到其最接近的组或首组，确保不丢失任何轨道。
 */
export function groupTimelineTracks(
  tracks: readonly TimelineTrack[],
  collapsedGroupIds: ReadonlySet<string>,
): GroupedTracks[] {
  const result: GroupedTracks[] = TRACK_GROUPS.map((group) => ({
    group,
    tracks: [],
    isCollapsed: collapsedGroupIds.has(group.id),
  }))

  const groupMap = new Map<TrackGroupId, GroupedTracks>()
  for (const item of result) {
    groupMap.set(item.group.id, item)
  }

  for (const track of tracks) {
    const matched = TRACK_GROUPS.find((g) => g.trackTypes.includes(track.type))
    const targetGroup = matched ? groupMap.get(matched.id) : result[0]
    if (targetGroup) {
      targetGroup.tracks.push(track)
    }
  }

  // 过滤掉没有任何轨道的空组，但如果全部为空，至少保留第一个
  const nonEmpty = result.filter((item) => item.tracks.length > 0)
  return nonEmpty.length > 0 ? nonEmpty : [result[0]]
}
