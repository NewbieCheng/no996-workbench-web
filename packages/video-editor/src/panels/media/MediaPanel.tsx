/**
 * 素材资源管理面板 (MediaPanel)
 * 管理音视频与图片资产，支持一键添加到时间轴与紧凑双列排版
 */

import React, { useMemo, useState, useEffect, type ReactElement } from 'react'
import { Film, Image, LayoutGrid, Music, Trash2, Upload, type LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@no996/ui/tooltip'
import type { EditorInstance } from '../../core/instance.ts'
import type { ProjectAsset } from '../../core/project.ts'
import { InsertElementCommand } from '../../core/commands/timeline-commands.ts'
import { formatTimeCode } from '../../core/time.ts'
import { LibraryAddButton } from '../shared/LibraryAddButton.tsx'
import { dedupeLibraryAssets } from '../shared/dedupe-library-assets.ts'
import { mediaAssetTargetTrackType, resolveInsertTrack } from './resolve-insert-track.ts'

export type MediaAddToTimelineResult = {
  asset: ProjectAsset
  trackName: string
  createdTrack: boolean
}

export type MediaPanelProps = {
  editor: EditorInstance
  onUploadAsset?: (file: File) => Promise<ProjectAsset>
  onAddToTimeline?: (result: MediaAddToTimelineResult) => void
  onTimelineNotice?: (message: string, kind?: 'success' | 'error') => void
  /** 按 blobId 取本地二进制，用于缩略图 */
  resolveAssetBlob?: (blobId: string) => Promise<Blob | null>
  onDeleteAsset?: (asset: ProjectAsset) => void | Promise<void>
  query?: string
  style?: React.CSSProperties
  className?: string
}

function MediaAssetPoster({
  asset,
  resolveAssetBlob,
}: {
  asset: ProjectAsset
  resolveAssetBlob?: (blobId: string) => Promise<Blob | null>
}) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!resolveAssetBlob || !asset.blobId) {
      setPosterUrl(null)
      return
    }
    const isVisual =
      asset.mimeType.startsWith('image/') || asset.mimeType.startsWith('video/')
    if (!isVisual) {
      setPosterUrl(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    void (async () => {
      const blob = await resolveAssetBlob(asset.blobId!)
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setPosterUrl(objectUrl)
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setPosterUrl(null)
    }
  }, [asset.blobId, asset.mimeType, resolveAssetBlob])

  if (!posterUrl) return null
  return (
    <img
      src={posterUrl}
      alt=""
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  )
}

const FILTER_ITEMS: {
  key: 'all' | 'video' | 'audio' | 'image'
  label: string
  Icon: LucideIcon
}[] = [
  { key: 'all', label: '全部素材', Icon: LayoutGrid },
  { key: 'video', label: '视频', Icon: Film },
  { key: 'audio', label: '音频', Icon: Music },
  { key: 'image', label: '图片', Icon: Image },
]

function LibFilterTip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom" sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  )
}

export function MediaPanel({
  editor,
  onUploadAsset,
  onAddToTimeline,
  onTimelineNotice,
  resolveAssetBlob,
  onDeleteAsset,
  query = '',
  style,
  className,
}: MediaPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [filter, setFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all')

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
    })
  }, [editor])

  const filteredAssets = useMemo(() => {
    const deduped = dedupeLibraryAssets(Object.values(doc.assets || {}))
    const keyword = query.trim().toLowerCase()
    return deduped.filter((a) => {
      if (filter !== 'all' && !a.mimeType.startsWith(filter)) return false
      if (keyword && !a.name.toLowerCase().includes(keyword)) return false
      return true
    })
  }, [doc.assets, filter, query])

  const handleAddToTimeline = (asset: ProjectAsset) => {
    const isVideo = asset.mimeType.startsWith('video')
    const isAudio = asset.mimeType.startsWith('audio')
    const targetTrackType = mediaAssetTargetTrackType(asset)

    const resolved = resolveInsertTrack(editor, targetTrackType)
    if (!resolved.ok) {
      const lockedType = 'trackType' in resolved ? resolved.trackType : targetTrackType
      const label =
        lockedType === 'audio'
          ? '音频'
          : lockedType === 'video'
            ? '视频'
            : '贴图'
      onTimelineNotice?.(`所有${label}轨道均已锁定，无法添加素材`, 'error')
      return
    }

    const track = resolved.track
    const liveDoc = editor.getDocument()

    let startUs = 0
    if (track.elements.length > 0) {
      const lastElem = track.elements[track.elements.length - 1]
      startUs = lastElem.startUs + lastElem.durationUs
    }

    const durationUs = asset.durationUs || 5_000_000

    let element
    if (isVideo) {
      element = {
        id: `elem-v-${crypto.randomUUID()}`,
        trackId: track.id,
        type: 'video' as const,
        assetId: asset.id,
        startUs,
        durationUs,
        sourceInUs: 0,
        sourceOutUs: durationUs,
        rate: 1,
        volume: 1,
        transform: {
          x: 0,
          y: 0,
          width: liveDoc.canvas.width,
          height: liveDoc.canvas.height,
          rotationDeg: 0,
          opacity: 1,
          cropMode: 'cover' as const,
          round: 0,
        },
      }
    } else if (isAudio) {
      element = {
        id: `elem-a-${crypto.randomUUID()}`,
        trackId: track.id,
        type: 'audio' as const,
        assetId: asset.id,
        startUs,
        durationUs,
        sourceInUs: 0,
        sourceOutUs: durationUs,
        rate: 1,
        volume: 1,
      }
    } else {
      element = {
        id: `elem-img-${crypto.randomUUID()}`,
        trackId: track.id,
        type: 'image' as const,
        assetId: asset.id,
        startUs,
        durationUs,
        transform: {
          x: 0,
          y: 0,
          width: Math.round(liveDoc.canvas.width * 0.8),
          height: Math.round(liveDoc.canvas.height * 0.8),
          rotationDeg: 0,
          opacity: 1,
          cropMode: 'contain' as const,
          round: 0,
        },
      }
    }

    editor.executeCommand(new InsertElementCommand(track.id, element))
    onAddToTimeline?.({
      asset,
      trackName: track.name,
      createdTrack: resolved.createdTrack,
    })
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (onUploadAsset) {
      const newAsset = await onUploadAsset(file)
      editor.updateDocument((prev) => ({
        ...prev,
        assets: {
          ...prev.assets,
          [newAsset.id]: newAsset,
        },
      }))
      onTimelineNotice?.(`已导入素材：${newAsset.name}`, 'success')
    } else {
      const assetId = `asset-local-${crypto.randomUUID()}`
      const isAud = (file.type || '').startsWith('audio')
      const isImg = (file.type || '').startsWith('image')
      const kind: 'video' | 'audio' | 'image' = isAud ? 'audio' : isImg ? 'image' : 'video'

      const newAsset: ProjectAsset = {
        id: assetId,
        kind,
        name: file.name,
        mimeType: file.type || 'video/mp4',
        sizeBytes: file.size,
        durationUs: 5_000_000,
        createdAt: Date.now(),
      }
      editor.updateDocument((prev) => ({
        ...prev,
        assets: {
          ...prev.assets,
          [assetId]: newAsset,
        },
      }))
      onTimelineNotice?.(`已导入素材：${newAsset.name}`, 'success')
    }

    e.target.value = ''
  }

  const assetTypeMeta = (mime: string) => {
    if (mime.startsWith('video')) {
      return { color: '#2563eb', bg: '#2563eb18', Icon: Film, label: '视频' }
    }
    if (mime.startsWith('audio')) {
      return { color: '#059669', bg: '#05966918', Icon: Music, label: '音频' }
    }
    return { color: '#7c3aed', bg: '#7c3aed18', Icon: Image, label: '图片' }
  }

  return (
    <div
      className={`vf-lib-panel${className ? ` ${className}` : ''}`}
      data-testid="media-panel"
      style={style}
    >
      <div className="vf-lib-toolbar">
        <TooltipProvider delay={400}>
          <div className="vf-lib-filter-group" role="group" aria-label="素材类型筛选">
            {FILTER_ITEMS.map(({ key, label, Icon }) => (
              <LibFilterTip key={key} label={label}>
                <button
                  type="button"
                  className="vf-lib-filter-chip"
                  data-active={filter === key}
                  onClick={() => setFilter(key)}
                  aria-label={label}
                >
                  <Icon size={14} strokeWidth={2} aria-hidden />
                </button>
              </LibFilterTip>
            ))}
          </div>
        </TooltipProvider>

        <label className="vf-lib-import" title="导入本地音视频或图片素材" aria-label="导入素材">
          <Upload className="size-3.5" aria-hidden />
          <input type="file" onChange={handleFileImport} style={{ display: 'none' }} />
        </label>
      </div>

      <div className="vf-lib-scroll">
        <TooltipProvider delay={400}>
        {filteredAssets.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', marginTop: 32, fontSize: 11 }}>
            {query.trim() ? `没有匹配「${query.trim()}」的素材` : '暂无素材，点击右上角导入'}
          </div>
        ) : (
          <div className="vf-lib-media-grid">
            {filteredAssets.map((asset) => {
              const meta = assetTypeMeta(asset.mimeType)
              const timeLabel = asset.durationUs ? formatTimeCode(asset.durationUs) : ''
              return (
                <div key={asset.id} className="vf-lib-media-card" title={asset.name}>
                  <div className="vf-lib-media-card__poster" style={{ position: 'relative' }}>
                    <MediaAssetPoster asset={asset} resolveAssetBlob={resolveAssetBlob} />
                    <span
                      className="vf-lib-media-card__kind"
                      style={{ background: meta.bg, color: meta.color }}
                      title={meta.label}
                      aria-label={meta.label}
                    >
                      <meta.Icon className="vf-lib-media-card__kind-icon" aria-hidden />
                    </span>
                    {onDeleteAsset ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              className="vf-lib-media-card__delete"
                              aria-label={`删除素材 ${asset.name}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                void onDeleteAsset(asset)
                              }}
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 22,
                                height: 22,
                                borderRadius: 4,
                                border: 'none',
                                background: 'rgba(0,0,0,0.55)',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                              }}
                            >
                              <Trash2 size={12} aria-hidden />
                            </button>
                          }
                        />
                        <TooltipContent side="top">从素材库删除</TooltipContent>
                      </Tooltip>
                    ) : null}

                    {timeLabel ? (
                      <span
                        style={{
                          position: 'absolute',
                          right: 4,
                          bottom: 4,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: 'rgba(0, 0, 0, 0.65)',
                          backdropFilter: 'blur(4px)',
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 500,
                        }}
                      >
                        {timeLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className="vf-lib-shot-card__footer">
                    <span className="vf-lib-shot-card__title" title={asset.name}>
                      {asset.name}
                    </span>
                    <LibraryAddButton
                      label={`添加 ${asset.name} 至时间轴`}
                      onClick={() => handleAddToTimeline(asset)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </TooltipProvider>
      </div>
    </div>
  )
}
