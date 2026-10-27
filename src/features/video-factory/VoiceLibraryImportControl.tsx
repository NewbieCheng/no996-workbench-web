/**
 * 字幕 / 音频面板共用的「配音库」入口：复用 WizardLibraryDropdown + importVoiceBundleToEditor。
 */

import { useState } from 'react'
import type { EditorInstance } from '@no996/video-editor'
import { WizardLibraryDropdown } from './WizardLibraryDropdown'
import { importVoiceBundleToEditor } from './lib/import-voice-bundle'
import { notifyOperationError, toastSuccess } from '../../lib/toast'
import { apiErrorMessage } from '../../api/client'

export type VoiceLibraryImportControlProps = {
  editor: EditorInstance
  saveBlob: (blobId: string, blob: Blob) => Promise<void>
  /**
   * captions：默认导入「音频+文稿」并估时切字幕；仍可选仅音频
   * audio：同样提供两项，空态引导用
   */
  intent?: 'captions' | 'audio'
  disabled?: boolean
  className?: string
}

export function VoiceLibraryImportControl({
  editor,
  saveBlob,
  intent = 'captions',
  disabled,
  className,
}: VoiceLibraryImportControlProps) {
  const [busy, setBusy] = useState(false)

  return (
    <span className={className} data-voice-import-intent={intent}>
      <WizardLibraryDropdown
        mode="voice"
        disabled={disabled || busy}
        onPickScript={() => {}}
        onPickVoice={({ blob, text, voiceLabel }) => {
          setBusy(true)
          void (async () => {
            try {
              const withCaptions = Boolean(text.trim())
              const result = await importVoiceBundleToEditor(editor, {
                blob,
                text,
                voiceLabel,
                withCaptions,
                saveBlob,
              })
              editor.setSelection([result.elementId])
              if (result.captionCount > 0) {
                toastSuccess(
                  `已导入配音，并按 ${ (result.durationUs / 1_000_000).toFixed(1) }s 估时切出 ${result.captionCount} 句字幕`,
                )
              } else if (withCaptions) {
                toastSuccess('已导入配音（文稿为空，未生成字幕）')
              } else {
                toastSuccess('已导入配音到音频轨')
              }
            } catch (error) {
              notifyOperationError(apiErrorMessage(error), { id: 'voice-library-import', raw: true })
            } finally {
              setBusy(false)
            }
          })()
        }}
      />
    </span>
  )
}
