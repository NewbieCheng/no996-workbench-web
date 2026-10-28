import { useEffect, useRef, useState } from 'react'
import { Button } from '@no996/ui/button'
import { extensionClient } from '../../../services/extension/extension-client'
import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import { materialIdForUser, materialRepository } from '../../../services/materials/material-repository'

type Entry = { id: string; item: WorkbenchBridgeCollectedItem }
const PAGE_SIZE = 20

export function ExtensionMaterialImport({ userId, onRefresh }: { userId: number; onRefresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Entry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  async function load(next: number) {
    setBusy(true); setMessage('')
    try {
      const result = await extensionClient.request('materials.list', { offset: next, limit: PAGE_SIZE })
      if (!result.ok) throw new Error(result.error || '读取插件素材失败')
      if (!Array.isArray(result.items) || typeof result.hasMore !== 'boolean') throw new Error('插件返回的素材列表格式不正确')
      setItems(result.items); setOffset(next); setHasMore(result.hasMore); setSelected(new Set())
    } catch (error) {
      const text = error instanceof Error ? error.message : '读取插件素材失败'
      setMessage(/未知|unknown|unsupported|不支持/i.test(text) ? '当前插件版本不支持素材导入，请更新插件后重试。' : text)
    } finally { setBusy(false) }
  }

  async function importSelected() {
    setBusy(true); setMessage('')
    let saved = 0, skipped = 0, failed = 0
    try {
      const result = await extensionClient.request('materials.read', { ids: Array.from(selected) })
      if (!result.ok || !Array.isArray(result.items)) throw new Error(result.error || '读取所选素材失败')
      const selectedItems = result.items.filter((entry) => selected.has(entry.id))
      failed += selected.size - selectedItems.length
      const existing = new Set((await materialRepository.listMaterials(userId)).map((m) => m.id))
      for (const entry of selectedItems) {
        if (!active.current) return
        try {
          if (!entry.item || typeof entry.item.url !== 'string' || !entry.item.url || !['douyin', 'xiaohongshu', 'bilibili', 'weixin'].includes(entry.item.platformId)) throw new Error('无效素材')
          const id = materialIdForUser(userId, entry.item)
          if (existing.has(id)) { skipped++; continue }
          await materialRepository.saveCollectedItem(userId, entry.item)
          existing.add(id); saved++
        } catch { failed++ }
      }
      await onRefresh()
      setSelected(new Set())
      setMessage(`导入完成：成功 ${saved} 条，已存在跳过 ${skipped} 条，失败 ${failed} 条。素材仅保存在当前账号的本机浏览器。`)
    } catch (error) { setMessage(`导入失败：${error instanceof Error ? error.message : '无法读取本机素材库'}`) }
    finally { setBusy(false) }
  }

  return <section className="space-y-3 rounded-xl border border-border p-4">
    <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">从插件导入素材</h3><p className="text-xs text-muted-foreground">预览并选择后导入，仅保存到当前账号的本机浏览器。</p></div><Button variant="outline" disabled={busy} onClick={() => { setOpen(!open); if (!open) void load(0) }}>{open ? '收起' : '查看插件素材'}</Button></div>
    {open && <div className="space-y-3">
      {items.map((entry) => <label key={entry.id} className="flex gap-3 border-b border-border py-2"><input type="checkbox" checked={selected.has(entry.id)} disabled={busy} onChange={(event) => setSelected((old) => { const next = new Set(old); if (event.target.checked) next.add(entry.id); else next.delete(entry.id); return next })} /><span className="min-w-0"><strong>{entry.item?.title || '无标题'}</strong><span className="block text-xs text-muted-foreground">{entry.item?.platformId} · {entry.item?.author || '未知作者'}</span><span className="block text-sm line-clamp-3">选择后导入正文</span></span></label>)}
      {!busy && !items.length && !message && <p>插件中暂无素材。</p>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>上一页</Button><Button variant="outline" disabled={busy || !hasMore} onClick={() => void load(offset + PAGE_SIZE)}>下一页</Button><Button disabled={busy || !selected.size} onClick={() => void importSelected()}>确认导入所选（{selected.size}）</Button></div>
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>
}
