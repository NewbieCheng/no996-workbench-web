import { Search, Trash2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import type { ProductListItem } from '../../../services/product-position/types'
import { productSubtitle } from '../../../services/product-position'

const STATUS_TEXT: Record<ProductListItem['status'], string> = {
  empty: '待分析',
  running: '分析中',
  ready: '已生成',
  failed: '上次失败',
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minute = 60_000
  if (diff < minute) return '刚刚'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} 小时前`
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    ...(sameYear ? {} : { year: '2-digit' }),
  })
}

export function ProductRail({
  items,
  selectedId,
  query,
  loading,
  onQueryChange,
  onSelect,
  onDelete,
}: {
  items: ProductListItem[]
  selectedId?: string
  query: string
  loading: boolean
  onQueryChange: (value: string) => void
  onSelect: (productId: string) => void
  onDelete: (productId: string) => void
}) {
  const keyword = query.trim().toLowerCase()
  const filtered = keyword
    ? items.filter(
        (item) =>
          item.product.name.toLowerCase().includes(keyword) ||
          item.product.type.toLowerCase().includes(keyword),
      )
    : items

  return (
    <aside className="pp-rail" aria-label="产品记录">
      <div className="pp-rail__search">
        <Search aria-hidden="true" />
        <input
          className="pp-rail__search-input"
          value={query}
          placeholder="搜索产品"
          aria-label="搜索产品"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="pp-rail__list" role="list">
        {loading ? <p className="pp-rail__empty">正在读取本机记录…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="pp-rail__empty">{keyword ? '没有匹配的产品' : '还没有产品，先新建一个'}</p>
        ) : null}
        {filtered.map((item) => (
          <div
            key={item.product.id}
            role="listitem"
            className={`pp-rail__row${item.product.id === selectedId ? ' is-active' : ''}`}
          >
            <button type="button" className="pp-rail__main" onClick={() => onSelect(item.product.id)}>
              <span className="pp-rail__name">{item.product.name.trim() || '未命名产品'}</span>
              <span className="pp-rail__sub">
                {productSubtitle(item.product) || '未填写类型'}
                <span aria-hidden="true"> · </span>
                {formatWhen(item.updatedAt)}
              </span>
            </button>
            <span className={`pp-status pp-status--${item.status}`}>{STATUS_TEXT[item.status]}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="pp-rail__delete"
              aria-label={`删除 ${item.product.name || '未命名产品'}`}
              onClick={() => onDelete(item.product.id)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <p className="pp-rail__foot">{items.length} 个产品 · 仅本机</p>
    </aside>
  )
}
