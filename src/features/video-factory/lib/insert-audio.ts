/**
 * 音频插入（宿主侧薄封装）
 *
 * 真正的插入逻辑在 `@no996/video-editor` 的 media/insert-audio，
 * 这里只把它与工程状态里的 blob 仓储接起来。
 */

import type { EditorInstance } from '@no996/video-editor'
import { insertAudioElement } from '@no996/video-editor'

export type InsertAudioOptions = {
  blob: Blob
  name: string
  startUs: number
  trackName?: string
  volume?: number
  saveBlob: (blobId: string, blob: Blob) => Promise<void>
}

export async function insertAudioIntoEditor(
  editor: EditorInstance,
  options: InsertAudioOptions,
): Promise<{ elementId: string; trackId: string }> {
  const result = await insertAudioElement(
    editor,
    {
      blob: options.blob,
      name: options.name,
      startUs: options.startUs,
      trackName: options.trackName,
      volume: options.volume,
    },
    options.saveBlob,
  )
  return { elementId: result.elementId, trackId: result.trackId }
}
