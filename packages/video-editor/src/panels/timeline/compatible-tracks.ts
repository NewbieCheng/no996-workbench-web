/**
 * 片段可切换的目标轨道列表（同属性 / layer 镜头兼容轨）。
 */

import type { EditorDocument, TimelineTrack, TrackElement } from '../../core/project.ts'
import { canMoveElementToTrack } from '../../core/commands/timeline-commands.ts'

export function listCompatibleTracks(
  doc: EditorDocument,
  element: TrackElement,
): TimelineTrack[] {
  const shotId = element.type === 'shot' ? element.shotId : undefined
  return doc.tracks.filter(
    (track) => !track.locked && canMoveElementToTrack(element.type, track.type, shotId),
  )
}

export function findElementTrack(doc: EditorDocument, elementId: string): TimelineTrack | undefined {
  return doc.tracks.find((track) => track.elements.some((element) => element.id === elementId))
}
