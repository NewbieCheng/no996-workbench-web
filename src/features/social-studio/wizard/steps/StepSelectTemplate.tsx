import { useState } from 'react'
import { CheckIcon, ArrowRightIcon, ArrowLeftIcon, BanIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import type { StudioCoverTemplate, TemplateCategory } from '../types'
import {
  STUDIO_COVER_TEMPLATES,
  WECHAT_COVER_TEMPLATES,
  TEMPLATE_CATEGORY_TABS,
} from '../cover-templates'
import type { WorkbenchBridgeCollectedItem } from '../../../../services/extension/workbench-bridge-contract'

type StepSelectTemplateProps = {
  platform: 'xhs' | 'wechat'
  selectedBenchmark: WorkbenchBridgeCollectedItem | null
  selectedTemplate: StudioCoverTemplate
  onSelect: (tpl: StudioCoverTemplate) => void
  onNext: () => void
  onBack: () => void
}

export function StepSelectTemplate({
  platform,
  selectedBenchmark,
  selectedTemplate,
  onSelect,
  onNext,
  onBack,
}: StepSelectTemplateProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all')

  const baseTemplates = platform === 'xhs' ? STUDIO_COVER_TEMPLATES : WECHAT_COVER_TEMPLATES
  const filteredTemplates = activeCategory === 'all'
    ? baseTemplates
    : baseTemplates.filter((t) => t.category === activeCategory || t.id === 'no_cover')

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* 头部导航与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">步骤 3/6</span>
            <span>选择封面模板和内页风格</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            挑一套你喜欢的版式
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI 将根据所选视觉风格，重新构图并生成属于您个人 IP 风格的全新排版配图
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl">
            <ArrowLeftIcon className="size-3.5 mr-1" />
            <span>上一步</span>
          </Button>
          <Button size="sm" onClick={onNext} className="rounded-xl gap-1.5 font-medium">
            <span>下一步：补充调整</span>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 分类标签 Tabs */}
      {platform === 'xhs' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {TEMPLATE_CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeCategory === tab.id
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 模板网格卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredTemplates.map((tpl) => {
          const isSelected = selectedTemplate.id === tpl.id
          const isNoCover = tpl.id === 'no_cover'
          const isOriginalMirror = tpl.id === 'original_mirror'

          return (
            <div
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className={`group relative flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer bg-card hover:shadow-md ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/30 shadow-md scale-[1.01]'
                  : 'border-border/70 hover:border-primary/50'
              }`}
            >
              {/* 卡片预览区 */}
              <div
                className={`relative aspect-[3/4] w-full flex flex-col items-center justify-center p-3 bg-gradient-to-br ${tpl.previewColor} overflow-hidden`}
              >
                {/* 选中勾选指示 */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 z-10 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md animate-in zoom-in-75">
                    <CheckIcon className="size-3.5 stroke-[3]" />
                  </div>
                )}

                {/* 徽章 */}
                {tpl.previewBadge && (
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground shadow-sm">
                    {tpl.previewBadge}
                  </span>
                )}

                {/* 模板内容视觉插图 / 构图展示 */}
                {isNoCover ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-2 text-muted-foreground">
                    <div className="size-10 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                      <BanIcon className="size-5" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">不生成封面</span>
                    <span className="text-[10px] text-muted-foreground">仅生成内页内容</span>
                  </div>
                ) : isOriginalMirror && selectedBenchmark?.coverUrl ? (
                  <div className="relative w-full h-full rounded-lg overflow-hidden border border-white/20">
                    <img
                      src={selectedBenchmark.coverUrl}
                      alt="原帖质感参考"
                      className="w-full h-full object-cover filter brightness-95"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-center p-2">
                      <span className="text-xs font-bold text-white drop-shadow">
                        1:1 原帖同款质感
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col justify-between p-2 rounded-xl bg-background/40 backdrop-blur-sm border border-white/20 dark:border-white/10">
                    <div className="space-y-1">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-bold">
                        {tpl.tagLabel}
                      </span>
                      <h4 className="text-xs font-bold text-foreground line-clamp-2">
                        {tpl.name}
                      </h4>
                    </div>
                    <div className="h-16 w-full rounded-lg bg-foreground/5 flex items-center justify-center text-[10px] text-muted-foreground text-center p-1">
                      <SparklesIcon className="size-3.5 text-primary mr-1 shrink-0" />
                      <span>{tpl.aspectRatio} 黄金构图</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 标题与描述 */}
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground truncate">{tpl.name}</h3>
                  <span className="text-[10px] text-muted-foreground">{tpl.aspectRatio}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{tpl.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* 底部按钮栏 */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <span className="text-xs text-muted-foreground">
          已选模板：<strong className="text-foreground">{selectedTemplate.name}</strong>
        </span>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="rounded-xl">
            上一步
          </Button>
          <Button onClick={onNext} className="rounded-xl gap-1">
            <span>下一步：补充调整</span>
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
