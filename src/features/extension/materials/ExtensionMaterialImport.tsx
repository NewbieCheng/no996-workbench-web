import { useEffect, useRef, useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { cn } from '@no996/ui/utils'
import { getWorkbenchPortalContainer } from '@no996/ui/portal-host'
import { extensionClient } from '../../../services/extension/extension-client'
import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import { materialIdForUser, materialRepository } from '../../../services/materials/material-repository'
import './extension-material-import.css'

type Entry = { id: string; item: WorkbenchBridgeCollectedItem }
const PAGE_SIZE = 20

export function ExtensionMaterialImport({
  userId,
  onRefresh,
}: {
  userId: number
  onRefresh: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Entry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'ok' | 'error' | ''>('')
  const active = useRef(true)

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  async function load(next: number) {
    setBusy(true)
    setMessage('')
    setMessageTone('')
    try {
      const result = await extensionClient.request('materials.list', { offset: next, limit: PAGE_SIZE })
      if (!result.ok) throw new Error(result.error || '读取插件素材失败')
      if (!Array.isArray(result.items) || typeof result.hasMore !== 'boolean') {
        throw new Error('插件返回的素材列表格式不正确')
      }
      setItems(result.items)
      setOffset(next)
      setHasMore(result.hasMore)
      setSelected(new Set())
    } catch (error) {
      const text = error instanceof Error ? error.message : '读取插件素材失败'
      setMessageTone('error')
      setMessage(
        /未知|unknown|unsupported|不支持/i.test(text)
          ? '当前插件版本不支持素材导入，请更新插件后重试。'
          : text,
      )
      setItems([])
      setHasMore(false)
    } finally {
      setBusy(false)
    }
  }

  async function importSelected() {
    setBusy(true)
    setMessage('')
    setMessageTone('')
    let saved = 0
    let skipped = 0
    let failed = 0
    try {
      const result = await extensionClient.request('materials.read', { ids: Array.from(selected) })
      if (!result.ok || !Array.isArray(result.items)) {
        throw new Error(result.error || '读取所选素材失败')
      }
      const selectedItems = result.items.filter((entry) => selected.has(entry.id))
      failed += selected.size - selectedItems.length
      const existing = new Set((await materialRepository.listMaterials(userId)).map((m) => m.id))
      for (const entry of selectedItems) {
        if (!active.current) return
        try {
          if (
            !entry.item ||
            typeof entry.item.url !== 'string' ||
            !entry.item.url ||
            !['douyin', 'xiaohongshu', 'bilibili', 'weixin'].includes(entry.item.platformId)
          ) {
            throw new Error('无效素材')
          }
          const id = materialIdForUser(userId, entry.item)
          if (existing.has(id)) {
            skipped++
            continue
          }
          await materialRepository.saveCollectedItem(userId, entry.item)
          existing.add(id)
          saved++
        } catch {
          failed++
        }
      }
      await onRefresh()
      setSelected(new Set())
      setMessageTone('ok')
      setMessage(
        `导入完成：成功 ${saved} 条，已存在跳过 ${skipped} 条，失败 ${failed} 条。仅保存在当前账号本机浏览器。`,
      )
    } catch (error) {
      setMessageTone('error')
      setMessage(`导入失败：${error instanceof Error ? error.message : '无法读取本机素材库'}`)
    } finally {
      setBusy(false)
    }
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((old) => {
      const next = new Set(old)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <div className="ext-material-import">
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) void load(0)
        }}
        modal={false}
      >
        <PopoverPrimitive.Trigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn('ext-material-import__trigger', open && 'is-open')}
              disabled={busy && !open}
              aria-label="从插件导入素材"
            />
          }
        >
          {busy && open ? (
            <Loader2 className="ext-material-import__trigger-icon animate-spin" aria-hidden />
          ) : (
            <Download className="ext-material-import__trigger-icon" aria-hidden />
          )}
          从插件导入
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal container={getWorkbenchPortalContainer()}>
          <PopoverPrimitive.Positioner
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="ext-material-import__positioner"
          >
            <PopoverPrimitive.Popup
              className="ext-material-import__panel"
              role="dialog"
              aria-label="从插件导入素材"
            >
              <header className="ext-material-import__head">
                <h3 className="ext-material-import__title">从插件导入素材</h3>
                <p className="ext-material-import__hint">
                  预览并勾选后导入，仅保存到当前账号的本机浏览器。
                </p>
              </header>

              <div className="ext-material-import__list">
                {items.map((entry) => {
                  const checked = selected.has(entry.id)
                  return (
                    <label
                      key={entry.id}
                      className={cn('ext-material-import__row', checked && 'is-selected')}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={(event) => toggleRow(entry.id, event.target.checked)}
                      />
                      <span className="ext-material-import__row-body">
                        <span className="ext-material-import__row-title">
                          {entry.item?.title || '无标题'}
                        </span>
                        <span className="ext-material-import__row-meta">
                          {entry.item?.platformId} · {entry.item?.author || '未知作者'}
                        </span>
                      </span>
                    </label>
                  )
                })}
                {!busy && !items.length && !message && (
                  <p className="ext-material-import__empty">插件中暂无素材。</p>
                )}
                {busy && !items.length && (
                  <p className="ext-material-import__empty" role="status">
                    正在读取插件素材…
                  </p>
                )}
                {message && !items.length && (
                  <p
                    className="ext-material-import__status"
                    data-tone={messageTone || undefined}
                    role="status"
                  >
                    {message}
                  </p>
                )}
              </div>

              <footer className="ext-material-import__foot">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={busy || offset === 0}
                  onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
                >
                  上一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={busy || !hasMore}
                  onClick={() => void load(offset + PAGE_SIZE)}
                >
                  下一页
                </Button>
                <span className="ext-material-import__foot-spacer" />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={busy || !selected.size}
                  onClick={() => void importSelected()}
                >
                  确认导入（{selected.size}）
                </Button>
                {message && items.length > 0 && (
                  <p className="ext-material-import__message" role="status">
                    {message}
                  </p>
                )}
              </footer>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  )
}
