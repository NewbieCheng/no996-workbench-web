/**
 * 镜头库上轴：按策略 + 默认星标轨解析目标轨道与起点。
 */

import type { EditorInstance } from '../../core/instance.ts'
import type { TimelineTrack, TrackType } from '../../core/project.ts'
import {
  computeTrackEndStartUs,
  resolveDefaultInsertTrack,
} from '../../core/commands/insert-track-defaults.ts'
import {
  type MediaInsertTrackType,
  resolveInsertTrack,
} from '../media/resolve-insert-track.ts'
import { canLandShotOnTrack, getShotInsertPolicy, shotPolicyTrackType } from './shot-insert-policy.ts'

export type ResolveShotInsertTrackInput = {
  explicitTrackId?: string
  dropTimeUs?: number
}

export type ResolveShotInsertTrackResult = {
  track: TimelineTrack
  startUs: number
  createdTrack: boolean
}

function resolveShotTargetTrack(
  editor: EditorInstance,
  trackType: TrackType,
): { track: TimelineTrack; createdTrack: boolean } {
  const doc = editor.getDocument()
  const existing = resolveDefaultInsertTrack(doc, trackType)
  if (existing) {
    return { track: existing, createdTrack: false }
  }

  if (trackType === 'shot') {
    const shotTrack = doc.tracks.find((t) => t.type === 'shot' && !t.locked)
    if (!shotTrack) {
      throw new Error('没有可用的镜头轨')
    }
    return { track: shotTrack, createdTrack: false }
  }

  const mediaType = trackType as MediaInsertTrackType
  const resolved = resolveInsertTrack(editor, mediaType)
  if (!resolved.ok) {
    throw new Error(`所有${mediaType}轨道均已锁定，无法添加镜头`)
  }
  return { track: resolved.track, createdTrack: resolved.createdTrack }
}

export function resolveShotInsertTrack(
  editor: EditorInstance,
  shotId: string,
  input: ResolveShotInsertTrackInput = {},
): ResolveShotInsertTrackResult {
  const policy = getShotInsertPolicy(shotId)
  const targetType = shotPolicyTrackType(shotId)
  const doc = editor.getDocument()

  let track: TimelineTrack
  let createdTrack = false

  if (input.explicitTrackId) {
    const explicit = doc.tracks.find((t) => t.id === input.explicitTrackId)
    if (explicit && !explicit.locked && canLandShotOnTrack(shotId, explicit.type)) {
      track = explicit
    } else {
      const resolved = resolveShotTargetTrack(editor, targetType)
      track = resolved.track
      createdTrack = resolved.createdTrack
    }
  } else {
    const resolved = resolveShotTargetTrack(editor, targetType)
    track = resolved.track
    createdTrack = resolved.createdTrack
  }

  let startUs: number
  if (typeof input.dropTimeUs === 'number' && input.explicitTrackId === track.id) {
    startUs = Math.max(0, Math.round(input.dropTimeUs))
  } else if (policy.placement === 'playhead') {
    startUs = Math.max(0, Math.round(editor.getPlayheadUs()))
  } else {
    startUs = computeTrackEndStartUs(track)
  }

  return { track, startUs, createdTrack }
}
