import { useEffect, useState } from 'react'
import { useEditorDocument, useEditorInstance } from '@no996/video-editor'
import { AttachmentUploader, type AttachmentUploaderItem } from '@no996/ui/attachment-uploader'
import type { IndexedDBAssetRepository } from '@no996/video-editor/core/repository/indexeddb'
import { editTalk, retimePhotos } from './talk-model'

export type TalkAssetStripProps = {
  assets: IndexedDBAssetRepository
  scope: string
  onAddFiles?: (files: File[]) => void
}

/** Real local attachments rendered via unified composer uploader. */
export function TalkAssetStrip({ assets, scope, onAddFiles }: TalkAssetStripProps) {
  const doc = useEditorDocument()
  const editor = useEditorInstance()
  const activeIds = [...new Set(doc.tracks.flatMap(track => track.elements.flatMap(element => 'assetId' in element ? [element.assetId] : [])))]
  const signature = JSON.stringify(activeIds.map(id => [id, doc.assets[id]?.blobId]))
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    const owned: string[] = []
    setUrls({})
    void Promise.all(activeIds.slice(0, 12).map(async id => {
      const asset = doc.assets[id]
      if (!asset?.blobId || asset.kind === 'audio') return [id, ''] as const
      const blob = await assets.getAssetBlob(asset.blobId, scope)
      if (!blob || !active) return [id, ''] as const
      const url = URL.createObjectURL(blob)
      owned.push(url)
      return [id, url] as const
    })).then(entries => { if (active) setUrls(Object.fromEntries(entries)) }).catch(() => { /* The stage owns actionable missing-media errors. */ })
    return () => { active = false; owned.forEach(url => URL.revokeObjectURL(url)) }
  }, [assets, scope, signature])

  if (!activeIds.length) return null

  const handleRemove = (assetId: string) => {
    editTalk(editor, 'remove-asset', current => {
      const nextTracks = current.tracks.map(t => ({
        ...t,
        elements: t.elements.filter(e => !('assetId' in e && e.assetId === assetId))
      }))
      const nextAssets = { ...current.assets }
      delete nextAssets[assetId]
      return retimePhotos({ ...current, tracks: nextTracks, assets: nextAssets })
    })
  }

  const items: AttachmentUploaderItem[] = activeIds.slice(0, 12).map<AttachmentUploaderItem | null>(id => {
    const asset = doc.assets[id]
    if (!asset) return null
    const kind = asset.kind === 'image' ? 'image' : asset.kind === 'video' ? 'video' : asset.kind === 'audio' ? 'audio' : 'doc'
    return {
      id,
      name: asset.name,
      size: asset.sizeBytes ?? 0,
      mimeType: asset.mimeType,
      kind,
      previewUrl: urls[id] || undefined,
      status: 'ready' as const,
    }
  }).filter((item): item is AttachmentUploaderItem => item !== null)

  return (
    <div className="ipt-composer-attachments">
      <AttachmentUploader
        layout="composer"
        items={items}
        onAdd={onAddFiles ?? (() => {})}
        onRemove={handleRemove}
        removable={true}
        showAddTile={false}
      />
    </div>
  )
}
