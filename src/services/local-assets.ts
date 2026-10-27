import { useEffect, useRef, useState } from 'react'
import { notifyOperationWarning } from '../lib/toast'
export type LocalAsset = { name: string; size: number; url: string; type: string }
export function useLocalAssets(kind: 'image' | 'audio' | 'video', maxCount = 1, maxMB = 20) {
  const [assets, setAssets] = useState<LocalAsset[]>([])
  const current = useRef<LocalAsset[]>([])
  function clear() { for (const asset of current.current) URL.revokeObjectURL(asset.url); current.current = []; setAssets([]) }
  useEffect(() => () => { for (const asset of current.current) URL.revokeObjectURL(asset.url); current.current = [] }, [])
  function select(files: FileList | null, authorized: boolean) {
    if (!files?.length) return
    if (!authorized) {
      notifyOperationWarning('请先确认你有权使用这些素材。', { id: 'local-asset-select', raw: true })
      return
    }
    const picked = Array.from(files)
    const allowed = kind === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : kind === 'audio' ? ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg', 'audio/webm'] : ['video/mp4', 'video/webm', 'video/quicktime']
    if (picked.some(file => !allowed.includes(file.type) || file.size > maxMB * 1024 * 1024 || file.size === 0)) {
      notifyOperationWarning(
        `请使用支持的${kind === 'image' ? 'JPG / PNG / WebP 图片' : kind === 'audio' ? 'MP3 / WAV / M4A / OGG 音频' : 'MP4 / WebM / MOV 视频'}；每个文件非空且不超过 ${maxMB}MB。`,
        { id: 'local-asset-select', raw: true },
      )
      return
    }
    const append = maxCount > 1
    const room = append ? maxCount - current.current.length : maxCount
    if (room <= 0) {
      notifyOperationWarning(`最多选择 ${maxCount} 个文件。`, { id: 'local-asset-select', raw: true })
      return
    }
    const batch = picked.slice(0, room)
    if (!append && picked.length > maxCount) {
      notifyOperationWarning(`最多选择 ${maxCount} 个文件。`, { id: 'local-asset-select', raw: true })
      return
    }
    if (!append) clear()
    const added = batch.map(file => ({ name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) }))
    const next = append ? [...current.current, ...added] : added
    current.current = next
    setAssets(next)
  }
  function removeAt(index: number) {
    const asset = current.current[index]
    if (!asset) return
    URL.revokeObjectURL(asset.url)
    current.current = current.current.filter((_, i) => i !== index)
    setAssets([...current.current])
  }
  function reorder(from: number, to: number) {
    const list = [...current.current]
    if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return
    const [item] = list.splice(from, 1)
    list.splice(to, 0, item)
    current.current = list
    setAssets(list)
  }
  return { assets, select, clear, removeAt, reorder }
}
