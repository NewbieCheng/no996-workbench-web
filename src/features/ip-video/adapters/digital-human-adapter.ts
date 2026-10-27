/**
 * 数字人成片导入与素材适配器
 */

import type { EditorDocument, VideoClipElement, ProjectAsset } from '../../../../packages/video-editor/src/core/project.ts'
import type { TimeUs } from '../../../../packages/video-editor/src/core/time.ts'

export type DigitalHumanOutput = {
  versionId: string
  name: string
  videoBlob: Blob
  blobId?: string
  durationUs: TimeUs
  width: number
  height: number
}

/**
 * 将数字人成品视频追加或注入到当前工程的主视频轨（支持顺序批量追加，不暴力覆盖已有片段）
 */
export function applyDigitalHumanToDocument(
  document: EditorDocument,
  output: DigitalHumanOutput
): EditorDocument {
  const doc = JSON.parse(JSON.stringify(document)) as EditorDocument

  const assetId = `asset-dh-${crypto.randomUUID()}`
  const asset: ProjectAsset = {
    id: assetId,
    kind: 'video',
    name: output.name || `数字人成片_${output.versionId}`,
    mimeType: output.videoBlob.type || 'video/mp4',
    sizeBytes: output.videoBlob.size,
    durationUs: output.durationUs,
    width: output.width,
    height: output.height,
    hasAudio: true,
    blobId: output.blobId,
    sourceVersionId: output.versionId,
    createdAt: Date.now(),
  }

  if (!doc.assets) doc.assets = {}
  doc.assets[assetId] = asset

  // 挂载至主视频轨
  let mainTrack = doc.tracks.find((t) => t.type === 'video')
  if (!mainTrack) {
    mainTrack = doc.tracks[0]
  }

  // 顺序追加到主轨末尾
  let startUs = 0
  if (mainTrack.elements.length > 0) {
    const lastElem = mainTrack.elements[mainTrack.elements.length - 1]
    startUs = lastElem.startUs + lastElem.durationUs
  }

  // 如果横屏视频引入到竖屏工程，默认使用 contain 保持完整画面不被过度裁切；同比例则默认 cover
  const isLandscapeInPortrait = output.width > output.height && doc.canvas.width < doc.canvas.height

  const clip: VideoClipElement = {
    id: `clip-dh-${crypto.randomUUID()}`,
    trackId: mainTrack.id,
    type: 'video',
    assetId,
    startUs,
    durationUs: output.durationUs,
    sourceInUs: 0,
    sourceOutUs: output.durationUs,
    rate: 1,
    volume: 1,
    transform: {
      x: 0,
      y: 0,
      width: doc.canvas.width,
      height: doc.canvas.height,
      rotationDeg: 0,
      opacity: 1,
      cropMode: isLandscapeInPortrait ? 'contain' : 'cover',
      round: 0,
    },
  }

  mainTrack.elements.push(clip)

  const totalTrackDuration = startUs + output.durationUs
  if (totalTrackDuration > doc.durationUs) {
    doc.durationUs = totalTrackDuration
  }

  return doc
}
