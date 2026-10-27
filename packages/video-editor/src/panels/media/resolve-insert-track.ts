/**
 * 素材库上轴：按素材类型解析目标轨道，缺轨则新建（避免落到 tracks[0] 镜头轨）。
 */

import type { EditorInstance } from '../../core/instance.ts'
import type { EditorDocument, ProjectAsset, TimelineTrack } from '../../core/project.ts'
import { AddTrackCommand } from '../../core/commands/track-commands.ts'
import { resolveDefaultInsertTrack } from '../../core/commands/insert-track-defaults.ts'

export type MediaInsertTrackType = 'audio' | 'video' | 'overlay'

const DEFAULT_TRACK_NAMES: Record<MediaInsertTrackType, string> = {
  audio: '配音轨',
  video: '主视频轨',
  overlay: '贴图画中画',
}

export function mediaAssetTargetTrackType(asset: Pick<ProjectAsset, 'mimeType'>): MediaInsertTrackType {
  if (asset.mimeType.startsWith('audio')) return 'audio'
  if (asset.mimeType.startsWith('video')) return 'video'
  return 'overlay'
}

/** 在文档中找默认或第一条匹配类型且未锁定的轨道 */
export function findUnlockedTrackByType(
  doc: EditorDocument,
  trackType: MediaInsertTrackType,
): TimelineTrack | undefined {
  return resolveDefaultInsertTrack(doc, trackType)
}

export type ResolveInsertTrackResult =
  | { ok: true; track: TimelineTrack; createdTrack: boolean }
  | { ok: false; reason: 'all_locked'; trackType: MediaInsertTrackType }

/**
 * 解析或创建上轴目标轨道。会执行 AddTrackCommand（可撤销）。
 */
export function resolveInsertTrack(
  editor: EditorInstance,
  trackType: MediaInsertTrackType,
): ResolveInsertTrackResult {
  const doc = editor.getDocument()
  const existing = findUnlockedTrackByType(doc, trackType)
  if (existing) {
    return { ok: true, track: existing, createdTrack: false }
  }

  const hasLockedOfType = doc.tracks.some((track) => track.type === trackType && track.locked)
  if (hasLockedOfType) {
    return { ok: false, reason: 'all_locked', trackType }
  }

  const trackId = `track-${trackType}-${crypto.randomUUID()}`
  const newTrack: TimelineTrack = {
    id: trackId,
    type: trackType,
    name: DEFAULT_TRACK_NAMES[trackType],
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  }
  editor.executeCommand(new AddTrackCommand(newTrack))

  const track = editor.getDocument().tracks.find((item) => item.id === trackId)
  if (!track) {
    throw new Error(`新建轨道失败: ${trackId}`)
  }
  return { ok: true, track, createdTrack: true }
}
