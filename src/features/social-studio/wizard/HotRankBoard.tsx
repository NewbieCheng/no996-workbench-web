import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FlameIcon,
  RefreshCwIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCwIcon,
} from 'lucide-react'
import {
  fetchRealHotRank,
  type HotRankPlatform,
  type RealHotItem,
} from './hot-rank-service'

type HotRankBoardProps = {
  onSelectKeyword: (keyword: string) => void
  disabled?: boolean
}

const PLATFORM_TABS: { id: HotRankPlatform; label: string }[] = [
  { id: 'xiaohongshu', label: '小红书热搜' },
  { id: 'douyin', label: '抖音热榜' },
  { id: 'toutiao', label: '头条热点' },
  { id: 'bilibili', label: 'B站热门' },
]

const PAGE_SIZE = 8

export function HotRankBoard({ onSelectKeyword, disabled }: HotRankBoardProps) {
  const [platform, setPlatform] = useState<HotRankPlatform>('xiaohongshu')
  const [items, setItems] = useState<RealHotItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const loadData = useCallback(async (plat: HotRankPlatform, force = false) => {
    setLoading(true)
    try {
      const res = await fetchRealHotRank(plat, force)
      setItems(res.items)
      setCurrentPage(1)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(platform)
  }, [platform, loadData])

  function handleTabChange(nextPlat: HotRankPlatform) {
    if (nextPlat === platform || loading) return
    setPlatform(nextPlat)
  }

  function handleRefresh() {
    if (loading) return
    loadData(platform, true)
  }

  // 分页计算
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / PAGE_SIZE)),
    [items.length]
  )

  const displayedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }, [items, currentPage])

  function handlePrevPage() {
    setCurrentPage((p) => Math.max(1, p - 1))
  }

  function handleNextPage() {
    setCurrentPage((p) => (p >= totalPages ? 1 : p + 1))
  }

  return (
    <div className="w-full mt-4 p-4 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-sm space-y-3 animate-in fade-in duration-300">
      {/* 头部：标题、平台切换、刷新 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <FlameIcon className="size-3.5 fill-current" />
          </div>
          <span className="text-xs font-bold text-foreground tracking-tight">
            全网实时热搜风向标
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            （点话题填入关键词，再点「开始探测」）
          </span>
        </div>

        {/* 平台选择 Pills 与刷新 */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/50 text-[11px]">
            {PLATFORM_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  platform === tab.id
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="刷新热搜榜单"
            aria-label="刷新热搜榜单"
          >
            <RefreshCwIcon className={`size-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* 热搜网格列表 */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div key={currentPage} className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
          {displayedItems.map((item, idx) => {
            const rank = (currentPage - 1) * PAGE_SIZE + idx + 1
            const isTop3 = rank <= 3

            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectKeyword(item.title)}
                className="group flex items-center justify-between p-2 sm:px-3 sm:py-2 rounded-xl text-left border border-border/40 hover:border-primary/40 bg-background/50 hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span
                    className={`size-5 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                      isTop3
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {rank < 10 ? `0${rank}` : rank}
                  </span>
                  <span className="text-xs text-foreground group-hover:text-primary font-medium truncate transition-colors">
                    {item.title}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.tag && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        item.tag === '爆'
                          ? 'bg-rose-500 text-white'
                          : item.tag === '热'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                      }`}
                    >
                      {item.tag}
                    </span>
                  )}
                  {item.heat && (
                    <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
                      {item.heat}
                    </span>
                  )}
                  <ArrowUpRightIcon className="size-3 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* 底部翻页控制器 */}
      {items.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>
              显示 {(currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, items.length)} / 共 {items.length} 条热搜
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNextPage}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <RotateCwIcon className="size-3" />
              <span>换一批</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-1 rounded-md border border-border/60 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="上一页"
                aria-label="上一页"
              >
                <ChevronLeftIcon className="size-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md border border-border/60 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="下一页"
                aria-label="下一页"
              >
                <ChevronRightIcon className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
