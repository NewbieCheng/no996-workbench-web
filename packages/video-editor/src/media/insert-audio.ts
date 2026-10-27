/**
 * 音频素材插入
 *
 * 把音效 / BGM 文件载入为一个 `ProjectAsset` + `AudioClipElement`。
 * 两类用途：
 *  - 视频工厂：从音效库拖入；
 *  - 一键出片：把 TTS 配音 Blob 落到配音轨。
 */

import type { EditorInstance } from '../core/instance.ts'
import type { AudioClipElement, EditorDocument, ProjectAsset } from '../core/project.ts'
import { InsertElementCommand } from '../core/commands/timeline-commands.ts'
import { AddTrackCommand } from '../core/commands/track-commands.ts'
import { probeAudioDuration } from './probe-audio.ts'
import { findReusableAudioAsset } from '../panels/shared/dedupe-library-assets.ts'

export type InsertAudioInput = {
  /** 目标轨道；缺省时自动找/建音频轨 */
  trackId?: string
  blob: Blob
  name: string
  startUs: number
  volume?: number
  rate?: number
  trackName?: string
}

/**
 * 插入音频片段。返回新元素 id 与所用轨道 id。
 * 会自动注册 assets 条目（含 blobId 由调用方先存进仓储）。
 */
export async function insertAudioElement(
  editor: EditorInstance,
  input: InsertAudioInput,
  saveBlob: (blobId: string, blob: Blob) => Promise<void>,
): Promise<{ elementId: string; trackId: string; assetId: string }> {
  const durationUs = await probeAudioDuration(input.blob)

  const docBefore = editor.getDocument()
  const reusable = findReusableAudioAsset(docBefore.assets, input.name, input.blob.size)

  let assetId: string
  if (reusable) {
    assetId = reusable.id
    if (!reusable.durationUs && durationUs) {
      editor.updateDocument((prev: EditorDocument) => ({
        ...prev,
        assets: {
          ...prev.assets,
          [assetId]: { ...prev.assets[assetId], durationUs },
        },
      }))
    }
  } else {
    assetId = `asset-${crypto.randomUUID()}`
    const blobId = `blob-${crypto.randomUUID()}`
    await saveBlob(blobId, input.blob)

    editor.updateDocument((prev: EditorDocument) => {
      const asset: ProjectAsset = {
        id: assetId,
        kind: 'audio',
        name: input.name,
        mimeType: input.blob.type || 'audio/mpeg',
        sizeBytes: input.blob.size,
        durationUs,
        blobId,
        createdAt: Date.now(),
      }
      return { ...prev, assets: { ...prev.assets, [assetId]: asset } }
    })
  }

  // 目标轨道：优先按 id，其次按 trackName 找音频轨，都没有就新建
  let trackId = input.trackId
  if (!trackId) {
    const existing = editor
      .getDocument()
      .tracks.find((track) => track.type === 'audio' && (!input.trackName || track.name === input.trackName))
    if (existing) {
      trackId = existing.id
    } else {
      trackId = `track-audio-${crypto.randomUUID()}`
      editor.executeCommand(
        new AddTrackCommand({
          id: trackId,
          type: 'audio',
          name: input.trackName ?? input.name,
          muted: false,
          hidden: false,
          locked: false,
          elements: [],
        }),
      )
    }
  }

  const elementId = `audio-${crypto.randomUUID()}`
  const element: AudioClipElement = {
    id: elementId,
    trackId,
    type: 'audio',
    assetId,
    startUs: Math.max(0, Math.round(input.startUs)),
    durationUs,
    sourceInUs: 0,
    sourceOutUs: durationUs,
    rate: input.rate ?? 1,
    volume: input.volume ?? 1,
  }

  editor.executeCommand(new InsertElementCommand(trackId, element))
  return { elementId, trackId, assetId }
}
