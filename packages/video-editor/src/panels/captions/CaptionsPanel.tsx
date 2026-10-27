/**
 * 字幕面板：导入 / 校时 / 句列表拆合。外观预设已迁至 Inspector「字幕外观」。
 */

import React, { useState, useEffect } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { CaptionCue, CaptionStyle } from '../../core/project.ts'
import { formatTimeCode } from '../../core/time.ts'
import { parseSrt, exportSrt } from './srt.ts'
import { shiftCaptions, splitCaptionAt, mergeCaptions } from './caption-ops.ts'
import {
  applyCaptionSegments,
  shiftCaptionSegmentsOnTrack,
  captionClipIdForCue,
} from './sync-text-track.ts'
import './captions-panel.css'

export type CaptionsPanelProps = {
  editor: EditorInstance
  playheadUs?: number
  onSeek?: (timeUs: number) => void
  style?: React.CSSProperties
  className?: string
  /** 宿主注入：如「配音库」导入（工厂侧复用历史 TTS） */
  headerExtra?: React.ReactNode
  /** 空态下方额外操作区 */
  emptyExtra?: React.ReactNode
}

export function CaptionsPanel({
  editor,
  playheadUs = 0,
  onSeek,
  style,
  className,
  headerExtra,
  emptyExtra,
}: CaptionsPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
    })
  }, [editor])

  const cues = doc.captions || []

  const commitCaptions = (newCues: CaptionCue[], newStyle?: Partial<CaptionStyle>) => {
    applyCaptionSegments(
      editor,
      newCues.map((cue) => ({
        text: cue.text,
        startUs: cue.startUs,
        durationUs: cue.durationUs,
        timingSource: cue.timingSource,
        boundClipId: cue.boundClipId,
        cueId: cue.id,
      })),
      { stylePatch: newStyle },
    )
  }

  const handleTextChange = (cueId: string, text: string) => {
    const updated = cues.map((c) => (c.id === cueId ? { ...c, text } : c))
    commitCaptions(updated)
  }

  const handleShift = (deltaUs: number) => {
    if (!shiftCaptionSegmentsOnTrack(editor, deltaUs)) {
      commitCaptions(shiftCaptions(cues, deltaUs))
    }
  }

  const handleSplitCue = (cueId: string) => {
    const cue = cues.find((c) => c.id === cueId)
    if (!cue) return
    const splitPoint =
      playheadUs > cue.startUs && playheadUs < cue.startUs + cue.durationUs
        ? playheadUs
        : cue.startUs + Math.round(cue.durationUs / 2)
    commitCaptions(splitCaptionAt(cues, cueId, splitPoint))
  }

  const handleMergeNext = (cueId: string) => {
    const idx = cues.findIndex((c) => c.id === cueId)
    if (idx !== -1 && idx < cues.length - 1) {
      commitCaptions(mergeCaptions(cues, cues[idx].id, cues[idx + 1].id))
    }
  }

  const handleSelectCue = (cueId: string) => {
    onSeek?.(cues.find((c) => c.id === cueId)?.startUs ?? 0)
    editor.setSelection([captionClipIdForCue(cueId)])
    window.dispatchEvent(new CustomEvent('video-factory:focus-inspector'))
  }

  const handleImportSrt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const parsed = parseSrt(text)
      if (parsed.length > 0) {
        applyCaptionSegments(
          editor,
          parsed.map((cue) => ({
            text: cue.text,
            startUs: cue.startUs,
            durationUs: cue.durationUs,
            timingSource: cue.timingSource,
            boundClipId: cue.boundClipId,
            cueId: cue.id,
          })),
        )
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExportSrt = () => {
    const srt = exportSrt(cues)
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.name || 'captions'}.srt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const panelClass = ['ve-captions-panel', className].filter(Boolean).join(' ')

  return (
    <div className={panelClass} data-testid="captions-panel" style={style}>
      <div className="ve-captions-panel__header">
        <span className="ve-captions-panel__title">字幕与校时 ({cues.length} 句)</span>
        <div className="ve-captions-panel__actions">
          {headerExtra}
          <label className="ve-captions-panel__pill">
            导入 SRT
            <input type="file" accept=".srt" onChange={handleImportSrt} style={{ display: 'none' }} />
          </label>
          <button type="button" onClick={handleExportSrt} className="ve-captions-panel__pill">
            导出 SRT
          </button>
        </div>
      </div>

      <div className="ve-captions-panel__tools">
        <div className="ve-captions-panel__field">
          <span className="ve-captions-panel__field-label">批量平移</span>
          <div className="ve-captions-panel__segment">
            <button type="button" onClick={() => handleShift(-500_000)} className="ve-captions-panel__segment-btn">
              −0.5s
            </button>
            <button type="button" onClick={() => handleShift(500_000)} className="ve-captions-panel__segment-btn">
              +0.5s
            </button>
          </div>
        </div>
      </div>

      <div className="ve-captions-panel__list">
        {cues.length === 0 ? (
          <div className="ve-captions-panel__empty">
            <p>
              暂无字幕。可从「配音库」导入历史配音与文稿（按真实时长估时切句到字幕轨），或「导入
              SRT」后校时。选中字幕轨片段后在「属性」改外观。
            </p>
            {emptyExtra ? <div className="ve-captions-panel__empty-extra">{emptyExtra}</div> : null}
          </div>
        ) : (
          cues.map((cue, idx) => {
            const isCurrent = playheadUs >= cue.startUs && playheadUs <= cue.startUs + cue.durationUs
            return (
              <div
                key={cue.id}
                className="ve-captions-panel__cue"
                data-current={isCurrent}
                onClick={() => handleSelectCue(cue.id)}
              >
                <div className="ve-captions-panel__cue-meta">
                  <span>
                    #{idx + 1} {formatTimeCode(cue.startUs)} ~{' '}
                    {formatTimeCode(cue.startUs + cue.durationUs)}
                    {cue.timingSource === 'estimated' && (
                      <span className="ve-captions-panel__estimated">[估算]</span>
                    )}
                  </span>
                  <div className="ve-captions-panel__cue-actions">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSplitCue(cue.id)
                      }}
                      className="ve-captions-panel__cue-btn"
                    >
                      拆分
                    </button>
                    {idx < cues.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMergeNext(cue.id)
                        }}
                        className="ve-captions-panel__cue-btn"
                      >
                        合下句
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  className="ve-captions-panel__cue-input"
                  value={cue.text}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleTextChange(cue.id, e.target.value)}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
