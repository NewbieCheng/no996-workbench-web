/**
 * 完整导出面板组件 (ExportPanel)
 * 具备不可变快照预检；默认提交后台任务，inline 模式供示例编辑器使用
 */

import React, { useState, useEffect } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import { runExportPreflight, type PreflightReport } from '../../core/export/preflight.ts'
import { ExportController, resolveExportDimensions, type ExportAssetResolver } from '../../core/export/controller.ts'
import { MediabunnyMediaAdapter } from '../../media/mediabunny-adapter.ts'
import { formatTimeCode } from '../../core/time.ts'
import { evaluateProjectWorkload } from '../../core/quota/shot-workload.ts'

export type ExportResolutionPreset = '1080p' | '720p'

export type ExportTaskSnapshot = {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  progress?: number
  stage?: string
  downloadUrl?: string
  fileName?: string
  errorMessage?: string
  onCancel?: () => void
  onRetry?: () => void
}

export type ExportPanelProps = {
  editor: EditorInstance
  assetResolver?: ExportAssetResolver
  assetChecker?: (assetId: string) => Promise<boolean>
  /** 存在可听音轨或视频原声时必需；缺省仅允许静音工程。 */
  audioBlobResolver?: (assetId: string) => Promise<Blob | null>
  /** task：提交后台任务（默认）；inline：面板内直接合成（示例编辑器） */
  exportMode?: 'inline' | 'task'
  /** task 模式：提交导出任务，返回 taskId */
  onEnqueue?: (preset: ExportResolutionPreset, options?: { composition?: 'preview' | 'offline' }) => Promise<string | void>
  /** task 模式：父组件订阅的任务进度 */
  trackedTask?: ExportTaskSnapshot | null
  style?: React.CSSProperties
  className?: string
}

export function ExportPanel({
  editor,
  assetResolver,
  assetChecker,
  audioBlobResolver,
  exportMode = 'task',
  onEnqueue,
  trackedTask,
  style,
  className,
}: ExportPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [resolutionPreset, setResolutionPreset] = useState<ExportResolutionPreset>('720p')
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState('')
  const [artifactUrl, setArtifactUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [preflight, setPreflight] = useState<PreflightReport | null>(null)
  const [exportController, setExportController] = useState<ExportController | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
    })
  }, [editor])

  useEffect(() => {
    let cancelled = false
    const checker = assetChecker ?? (async () => true)
    const dimensions = resolveExportDimensions(doc, resolutionPreset)
    runExportPreflight(doc, checker, dimensions).then((report) => {
      if (!cancelled) setPreflight(report)
    })
    return () => {
      cancelled = true
    }
  }, [doc, assetChecker, resolutionPreset])

  const handleCancelExport = () => {
    if (exportMode === 'task' && trackedTask?.onCancel) {
      trackedTask.onCancel()
      return
    }
    if (exportController) {
      exportController.cancel()
    }
  }

  const handleStartInlineExport = async () => {
    setIsExporting(true)
    setProgress(0)
    setProgressStage('准备导出...')
    setErrorMsg(null)
    setArtifactUrl(null)

    const adapter = new MediabunnyMediaAdapter()
    const controller = new ExportController()
    setExportController(controller)

    try {
      const { artifact } = await controller.exportDocument(
        doc,
        adapter,
        assetResolver ?? (async () => null),
        assetChecker ?? (async () => true),
        {
          format: 'mp4',
          resolutionPreset,
          audioBlobResolver,
          onProgress: (p, stage) => {
            setProgress(Math.round(p * 100))
            if (stage) setProgressStage(stage)
          },
        }
      )
      const url = URL.createObjectURL(artifact.blob)
      setArtifactUrl(url)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || '导出过程中发生异常')
      }
    } finally {
      setIsExporting(false)
      setExportController(null)
      adapter.dispose()
    }
  }

  const handleSubmit = async (composition: 'preview' | 'offline' = 'preview') => {
    if (exportMode === 'inline') {
      await handleStartInlineExport()
      return
    }
    if (!onEnqueue) {
      setErrorMsg('未配置导出任务提交入口')
      return
    }
    setSubmitting(true)
    setErrorMsg(null)
    try {
      await onEnqueue(resolutionPreset, { composition })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '提交导出任务失败'
      setErrorMsg(message)
    } finally {
      setSubmitting(false)
    }
  }

  /** 面板通用卡片：中性底 + 细边框，红绿只留给状态本身 */
  const cardStyle: React.CSSProperties = {
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }

  /** 分辨率分段选择器：淡主色描边 + 淡主色底，不再整块实心填充 */
  const segBtnStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '7px 0',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    borderRadius: 7,
    border: `1px solid ${active ? 'color-mix(in srgb, var(--primary) 45%, var(--border))' : 'var(--border)'}`,
    background: active ? 'color-mix(in srgb, var(--primary) 10%, var(--card))' : 'var(--card)',
    color: active ? 'var(--primary)' : 'var(--muted-foreground)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
  })

  const canExport = preflight ? preflight.valid : false

  const taskActive =
    exportMode === 'task' &&
    trackedTask &&
    (trackedTask.status === 'queued' || trackedTask.status === 'running')

  const taskProgress =
    exportMode === 'task' && trackedTask
      ? trackedTask.progress ?? (trackedTask.status === 'queued' ? 0 : undefined)
      : undefined

  const taskStage =
    exportMode === 'task' && trackedTask
      ? (() => {
          const stage = trackedTask.stage?.trim()
          // 入队 meta 默认写「排队中」；任务已 running 时若尚未刷到新 stage，勿继续显示排队。
          if (trackedTask.status === 'running' && (!stage || stage === '排队中' || stage === '排队中…')) {
            return '合成中…'
          }
          return stage || (trackedTask.status === 'queued' ? '排队中…' : '合成中…')
        })()
      : progressStage

  const showProgress = exportMode === 'inline' ? isExporting : taskActive

  const taskDownloadUrl =
    exportMode === 'task' && trackedTask?.status === 'succeeded' ? trackedTask.downloadUrl : null

  const taskFailed =
    exportMode === 'task' && trackedTask?.status === 'failed' ? trackedTask.errorMessage : null

  return (
    <div
      className={className}
      data-testid="export-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card)',
        color: 'var(--foreground)',
        fontSize: 12,
        padding: '16px 14px',
        gap: 12,
        overflowY: 'auto',
        ...style,
      }}
    >
      <div style={{ ...cardStyle, gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>就绪检查</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              color: canExport ? '#3fb950' : '#f85149',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'currentColor',
                boxShadow: canExport ? '0 0 4px #3fb950aa' : '0 0 4px #f85149aa',
              }}
            />
            {canExport ? '通过' : '未就绪'}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
          时长 {formatTimeCode(doc.durationUs)} · 轨道 {doc.tracks.length} · 字幕 {doc.captions.length}
        </span>
        {preflight && preflight.issues.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {preflight.issues.map((iss, i) => (
              <span key={i} style={{ fontSize: 11, color: '#f85149' }}>• {iss.message}</span>
            ))}
          </div>
        )}
      </div>

      {(() => {
        const workload = evaluateProjectWorkload(doc)
        return (
          <div style={{ ...cardStyle, gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>浏览器合成</span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              默认快速导出：按预览层直录，耗时大约等于片长，可能掉帧。刷新或关闭本页会中断，不会在云端继续。
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5, opacity: 0.85 }}>
              {workload.shotCount} 个镜头 · 请保持标签页在前台
              {exportMode === 'task' ? '；可关弹窗，勿刷新、勿关标签页' : ''}
            </span>
            {workload.audioDurationUs > 60_000_000 && (
              <span style={{ color: '#0ea5e9', fontSize: 11 }}>
                已含背景音，将混音输出
              </span>
            )}
          </div>
        )
      })()}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)' }}>分辨率</span>
        <div style={{ display: 'flex', gap: 6, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
          <button
            type="button"
            disabled={showProgress || submitting}
            onClick={() => setResolutionPreset('720p')}
            style={segBtnStyle(resolutionPreset === '720p', showProgress || submitting)}
          >
            720P 默认
          </button>
          <button
            type="button"
            disabled={showProgress || submitting}
            onClick={() => setResolutionPreset('1080p')}
            style={segBtnStyle(resolutionPreset === '1080p', showProgress || submitting)}
          >
            1080P
          </button>
        </div>
      </div>

      {showProgress ? (
        <div style={{ ...cardStyle, gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span>{taskStage || '合成中…'}</span>
            <span style={{ fontWeight: 600, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
              {exportMode === 'inline' ? progress : taskProgress ?? 0}%
            </span>
          </div>
          <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--primary)',
                transformOrigin: 'left center',
                transform: `scaleX(${(exportMode === 'inline' ? progress : taskProgress ?? 0) / 100})`,
                transition: 'transform 0.2s ease',
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleCancelExport}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              color: '#f85149',
              background: 'transparent',
              border: '1px solid color-mix(in srgb, #da3633 45%, var(--border))',
              borderRadius: 6,
              cursor: 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            取消导出
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={() => void handleSubmit(exportMode === 'inline' ? 'offline' : 'preview')}
            disabled={!canExport || submitting}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: canExport && !submitting ? 'var(--primary)' : 'var(--muted)',
              color: canExport && !submitting ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              cursor: canExport && !submitting ? 'pointer' : 'not-allowed',
              opacity: canExport && !submitting ? 1 : 0.7,
              transition: 'filter 120ms ease, opacity 120ms ease',
            }}
            onMouseEnter={(e) => {
              if (canExport && !submitting) e.currentTarget.style.filter = 'brightness(1.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'none'
            }}
          >
            {exportMode === 'inline'
              ? '开始导出'
              : submitting
                ? '提交中…'
                : '快速导出'}
          </button>
          {exportMode === 'task' ? (
            <button
              type="button"
              onClick={() => void handleSubmit('offline')}
              disabled={!canExport || submitting}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--muted-foreground)',
                cursor: canExport && !submitting ? 'pointer' : 'not-allowed',
                opacity: canExport && !submitting ? 1 : 0.55,
              }}
            >
              精确导出（逐帧，更慢）
            </button>
          ) : null}
        </div>
      )}

      {(artifactUrl || taskDownloadUrl) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: 8,
            background: 'color-mix(in srgb, #238636 8%, var(--card))',
            border: '1px solid color-mix(in srgb, #238636 35%, var(--border))',
          }}
        >
          <span style={{ fontSize: 11, color: '#3fb950', fontWeight: 600 }}>成片就绪</span>
          <a
            href={artifactUrl ?? taskDownloadUrl ?? '#'}
            download={trackedTask?.fileName ?? `${doc.name || 'video'}.mp4`}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 7,
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              textDecoration: 'none',
            }}
          >
            立即下载 MP4
          </a>
        </div>
      )}

      {(errorMsg || taskFailed) && (
        <div
          style={{
            color: '#f85149',
            fontSize: 11,
            lineHeight: 1.5,
            padding: '8px 12px',
            background: 'color-mix(in srgb, #da3633 8%, var(--card))',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, #da3633 40%, var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span>{errorMsg || taskFailed}</span>
          {trackedTask?.onRetry ? (
            <button
              type="button"
              onClick={() => trackedTask.onRetry?.()}
              style={{
                alignSelf: 'flex-start',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 7,
                border: '1px solid color-mix(in srgb, #da3633 40%, var(--border))',
                background: 'transparent',
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              重新导出
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
