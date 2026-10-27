import { useState } from 'react'
import { CheckIcon, HeartIcon, BookmarkIcon, ExternalLinkIcon, StarIcon, ArrowRightIcon, ArrowLeftIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import type { WorkbenchBridgeCollectedItem } from '../../../../services/extension/workbench-bridge-contract'

type StepSelectBenchmarkProps = {
  items: WorkbenchBridgeCollectedItem[]
  selectedItem: WorkbenchBridgeCollectedItem | null
  onSelect: (item: WorkbenchBridgeCollectedItem) => void
  onNext: () => void
  onBack: () => void
  queryText?: string
}

function formatCount(num?: number): string {
  if (!num) return '0'
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return String(num)
}

export function StepSelectBenchmark({
  items,
  selectedItem,
  onSelect,
  onNext,
  onBack,
  queryText = 'AI',
}: StepSelectBenchmarkProps) {
  const [starredUrls, setStarredUrls] = useState<Set<string>>(new Set())

  function toggleStar(e: React.MouseEvent, url: string) {
    e.stopPropagation()
    setStarredUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* 头部状态与指示 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">步骤 2/6</span>
            <span>选择想二次创作的爆款笔记</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            「{queryText}」· 抓到 {items.length} 篇潜力爆款
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            点击卡片选定对标笔记，AI 将以此为基准进行观点拆解与重新绘图
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1 rounded-xl">
            <ArrowLeftIcon className="size-3.5" />
            <span>重新搜索</span>
          </Button>
          <Button
            size="sm"
            onClick={onNext}
            disabled={!selectedItem}
            className="gap-1.5 rounded-xl font-medium"
          >
            <span>下一步：选择版式模板</span>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 爆款卡片网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item) => {
          const isSelected = selectedItem?.url === item.url
          const isStarred = starredUrls.has(item.url)
          const cover = item.coverUrl || item.imageUrls?.[0]

          return (
            <div
              key={item.url}
              onClick={() => onSelect(item)}
              className={`group relative flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer bg-card hover:shadow-lg ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/30 shadow-md scale-[1.01]'
                  : 'border-border/70 hover:border-primary/50'
              }`}
            >
              {/* 封面区 */}
              <div className="relative aspect-[3/4] w-full bg-muted/40 overflow-hidden">
                {cover ? (
                  <img
                    src={cover}
                    alt={item.title || '封面'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-3 text-center">
                    暂无封面
                  </div>
                )}

                {/* 选中的勾选角标 */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 z-10 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-in zoom-in-75">
                    <CheckIcon className="size-3.5 stroke-[3]" />
                  </div>
                )}

                {/* 加星收藏按钮 */}
                <button
                  type="button"
                  onClick={(e) => toggleStar(e, item.url)}
                  className={`absolute top-2.5 left-2.5 z-10 size-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all ${
                    isStarred
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-black/40 text-white/80 hover:bg-black/60 hover:text-white'
                  }`}
                  aria-label="收藏素材"
                >
                  <StarIcon className={`size-3.5 ${isStarred ? 'fill-current' : ''}`} />
                </button>

                {/* 底部渐变蒙层，衬托点赞数 */}
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />
                <div className="absolute bottom-2 inset-x-2.5 flex items-center justify-between text-[11px] text-white/90">
                  <span className="flex items-center gap-1 font-medium">
                    <HeartIcon className="size-3 fill-rose-500 text-rose-500" />
                    {formatCount(item.likes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookmarkIcon className="size-3 text-amber-300" />
                    {formatCount(item.collects)}
                  </span>
                </div>
              </div>

              {/* 信息区 */}
              <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-relaxed">
                  {item.title || '无标题爆款笔记'}
                </h3>

                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[90px]">{item.author || '爆款博主'}</span>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 text-primary hover:underline hover:text-primary/80"
                    >
                      <span>看原文</span>
                      <ExternalLinkIcon className="size-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 底部悬浮/操作区 */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <span className="text-xs text-muted-foreground">
          {selectedItem ? (
            <>
              已选中：<strong className="text-foreground">{selectedItem.title || '该篇笔记'}</strong>
            </>
          ) : (
            '请点击上方卡片选择一篇笔记'
          )}
        </span>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="rounded-xl">
            上一步
          </Button>
          <Button onClick={onNext} disabled={!selectedItem} className="rounded-xl gap-1">
            <span>下一步：挑一套版式</span>
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
