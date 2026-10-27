/**
 * 从配音库（历史 TTS / IP 配音任务）导入：音频上配音轨，可选按文稿估时切字幕。
 * 估时用真实音频时长 + 字重（syncCaptionsToVoiceScript），非固定每句秒数。
 */

import { insertAudioElement, type EditorInstance } from '@no996/video-editor'
import { syncCaptionsToVoiceScript } from './sync-captions.ts'

export type ImportVoiceBundleInput = {
  blob: Blob
  text: string
  voiceLabel: string
  /** true：有文稿则双写字幕轨 + CaptionCue；false：仅插入音频 */
  withCaptions: boolean
  saveBlob: (blobId: string, blob: Blob) => Promise<void>
  startUs?: number
}

export type ImportVoiceBundleResult = {
  elementId: string
  trackId: string
  durationUs: number
  captionCount: number
}

export async function importVoiceBundleToEditor(
  editor: EditorInstance,
  input: ImportVoiceBundleInput,
): Promise<ImportVoiceBundleResult> {
  const result = await insertAudioElement(
    editor,
    {
      blob: input.blob,
      name: `配音 · ${input.voiceLabel}`,
      startUs: input.startUs ?? 0,
      trackName: '配音轨',
    },
    input.saveBlob,
  )

  const doc = editor.getDocument()
  let durationUs = 0
  for (const track of doc.tracks) {
    const el = track.elements.find((item) => item.id === result.elementId)
    if (el) {
      durationUs = el.durationUs
      break
    }
  }

  let captionCount = 0
  const script = input.text.trim()
  if (input.withCaptions && script && durationUs > 0) {
    captionCount = syncCaptionsToVoiceScript(editor, script, durationUs, result.elementId)
  }

  return {
    elementId: result.elementId,
    trackId: result.trackId,
    durationUs,
    captionCount,
  }
}
