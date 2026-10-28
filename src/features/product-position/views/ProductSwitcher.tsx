import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'
import type { ProductListItem } from '../../../services/product-position/types'

const STATUS_TEXT: Record<ProductListItem['status'], string> = {
  empty: '待分析',
  running: '分析中',
  ready: '已生成',
  failed: '上次失败',
}

const SEARCH_THRESHOLD = 8

export function ProductSwitcher({
  items,
  selectedId,
  loading,
  currentName,
  onSelect,
  onCreate,
  onDelete,
}: {
  items: ProductListItem[]
  selectedId?: string
  loading: boolean
  currentName: string
  onSelect: (productId: string) => void
  onCreate: () => void
  onDelete: (productId: string) => void
}) {
  const [query, setQuery] = useState('')
  const showSearch = items.length >= SEARCH_THRESHOLD
  const keyword = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!keyword) return items
    return items.filter(
      (item) =>
        item.product.name.toLowerCase().includes(keyword) ||
        item.product.type.toLowerCase().includes(keyword),
    )
  }, [items, keyword])

  return (
    <div className="pp-switcher">
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) setQuery('')
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="toolbar"
              size="sm"
              className="pp-switcher-trigger"
              aria-label="切换产品"
              disabled={loading && items.length === 0}
            />
          }
        >
          <span className="pp-switcher-trigger__label">{currentName.trim() || '未命名产品'}</span>
          <ChevronDown size={14} aria-hidden="true" className="opacity-60 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="pp-switcher-menu" scrollable>
          {showSearch ? (
            <div className="pp-switcher-search" onKeyDown={(event) => event.stopPropagation()}>
              <Search size={14} aria-hidden="true" />
              <input
                className="pp-switcher-search__input"
                value={query}
                placeholder="搜索产品"
                aria-label="搜索产品"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          ) : null}

          {loading && items.length === 0 ? (
            <p className="pp-switcher-empty">正在读取本机记录…</p>
          ) : null}
          {!loading && filtered.length === 0 ? (
            <p className="pp-switcher-empty">{keyword ? '没有匹配的产品' : '还没有产品'}</p>
          ) : null}

          {filtered.map((item) => {
            const name = item.product.name.trim() || '未命名产品'
            const active = item.product.id === selectedId
            return (
              <div
                key={item.product.id}
                className={`pp-switcher-row${active ? ' is-active' : ''}`}
              >
                <DropdownMenuItem
                  className="pp-switcher-row__item"
                  onClick={() => onSelect(item.product.id)}
                >
                  <span className="pp-switcher-row__name">{name}</span>
                  <span className={`pp-status pp-status--${item.status}`}>{STATUS_TEXT[item.status]}</span>
                </DropdownMenuItem>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="pp-switcher-row__delete"
                  aria-label={`删除 ${name}`}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onDelete(item.product.id)
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </div>
            )
          })}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onCreate()}>
            <Plus size={14} aria-hidden="true" />
            新建产品
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
