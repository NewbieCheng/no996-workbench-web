import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Layers,
  Calendar,
  Grid,
  ChevronDown,
  ChevronRight,
  FolderArchive,
} from 'lucide-react'
import { Input } from '@no996/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@no996/ui/select'
import {
  groupMaterialsByDate,
  groupMaterialsByTask,
  type SavedMaterial,
} from '../../../services/materials/material-repository'
import { ExtensionMaterialCardGrid } from './ExtensionMaterialCardGrid'
import { ExtensionMaterialDetailStage } from './ExtensionMaterialDetailStage'

export type GroupViewMode = 'task' | 'date' | 'flat'

type Props = {
  materials: SavedMaterial[]
  userId: number | null
  focusedBatchId?: string
  viewMode: GroupViewMode
  onViewModeChange: (mode: GroupViewMode) => void
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
  onRefresh: () => Promise<void>
  onDeleteIds: (ids: string[]) => Promise<void>
  platformLabel: (platformId: SavedMaterial['platformId']) => string
}

export function ExtensionMaterialLibraryPanel({
  materials,
  userId: _userId,
  focusedBatchId,
  viewMode,
  onViewModeChange,
  selectedIds,
  onSelectedIdsChange,
  onRefresh,
  onDeleteIds,
  platformLabel,
}: Props) {
  const { t } = useTranslation('extension')
  const [detailId, setDetailId] = useState<string | null>(null)

  // 筛选状态
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // 折叠控制
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // 勾选操作
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedIdsChange(next)
  }

  const selectGroupItems = (groupItemIds: string[]) => {
    const next = new Set(selectedIds)
    const allSelected = groupItemIds.every((id) => next.has(id))
    if (allSelected) {
      groupItemIds.forEach((id) => next.delete(id))
    } else {
      groupItemIds.forEach((id) => next.add(id))
    }
    onSelectedIdsChange(next)
  }

  const handleDeleteOne = async (id: string) => {
    if (!window.confirm(t('materialDeleteOneConfirm'))) return
    await onDeleteIds([id])
    if (detailId === id) setDetailId(null)
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
      onSelectedIdsChange(next)
    }
  }

  // 过滤后的素材列表
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (selectedPlatform !== 'all' && m.platformId !== selectedPlatform) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const titleMatch = (m.title || '').toLowerCase().includes(q)
        const contentMatch = (m.content || '').toLowerCase().includes(q)
        const authorMatch = (m.author || '').toLowerCase().includes(q)
        return titleMatch || contentMatch || authorMatch
      }
      return true
    })
  }, [materials, selectedPlatform, searchQuery])

  // 多维分组派生
  const taskGroups = useMemo(() => {
    return groupMaterialsByTask(filteredMaterials)
  }, [filteredMaterials])

  const dateGroups = useMemo(() => {
    return groupMaterialsByDate(filteredMaterials)
  }, [filteredMaterials])

  if (detailId && materials.some((m) => m.id === detailId)) {
    return (
      <ExtensionMaterialDetailStage
        materials={materials}
        activeId={detailId}
        onBack={() => setDetailId(null)}
        onSelect={setDetailId}
        onDelete={(id) => void handleDeleteOne(id)}
        onAfterHydrate={() => void onRefresh()}
        platformLabel={platformLabel}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 极简单行工具栏：左侧平台胶囊 + 视图切换，右侧搜索框 */}
      <div className="rounded-xl border border-border/80 bg-card px-4 py-2.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* 左侧：平台筛选下拉框 + 分组视图切换 */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            items={[
              { value: 'all', label: t('platformAll', { defaultValue: '全部平台' }) },
              { value: 'douyin', label: t('platformDouyin', { defaultValue: '抖音' }) },
              { value: 'xiaohongshu', label: t('platformXiaohongshu', { defaultValue: '小红书' }) },
              { value: 'bilibili', label: t('platformBilibili', { defaultValue: 'B站' }) },
            ]}
            value={selectedPlatform}
            onValueChange={(val) => {
              if (val) setSelectedPlatform(val)
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-background/80 w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: 'all', label: t('platformAll', { defaultValue: '全部平台' }) },
                { value: 'douyin', label: t('platformDouyin', { defaultValue: '抖音' }) },
                { value: 'xiaohongshu', label: t('platformXiaohongshu', { defaultValue: '小红书' }) },
                { value: 'bilibili', label: t('platformBilibili', { defaultValue: 'B站' }) },
              ].map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-4 w-[1px] bg-border/60 hidden sm:block" />

          {/* 分组维度模式 */}
          <div className="inline-flex rounded-lg bg-muted/50 p-0.5 border border-border/40 h-8 items-center text-xs">
            <button
              type="button"
              onClick={() => onViewModeChange('task')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'task'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers size={12} /> {t('viewModeTask', { defaultValue: '按任务' })}
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('date')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'date'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar size={12} /> {t('viewModeDate', { defaultValue: '按日期' })}
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('flat')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'flat'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid size={12} /> {t('viewModeFlat', { defaultValue: '平铺' })}
            </button>
          </div>
        </div>

        {/* 右侧：搜索框 */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchMaterialsPlaceholder', { defaultValue: '搜索标题、正文、作者...' })}
            className="h-8 pl-8 text-xs bg-background/80"
          />
        </div>
      </div>

      {/* 素材主体区域 */}
      {filteredMaterials.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-card p-12 text-center text-muted-foreground text-xs space-y-2">
          <FolderArchive size={36} className="mx-auto opacity-30 mb-2" />
          <p className="font-medium text-foreground text-sm">
            {t('materialEmptyMatchTitle', { defaultValue: '暂无匹配的本机素材' })}
          </p>
          <p>
            {materials.length === 0
              ? t('materialEmptyDescNew', { defaultValue: '请在“爆款采集”页输入链接或通过关键词抓取，采集结果将保存在此处。' })
              : t('materialEmptyDescFiltered', { defaultValue: '没有找到符合当前筛选条件的素材，请尝试清空筛选或关键词。' })}
          </p>
        </div>
      ) : viewMode === 'task' ? (
        /* 维度 1：按采集任务/时间段分组展示 */
        <div className="space-y-4">
          {taskGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.batchId)
            const groupIds = group.items.map((i) => i.id)
            const allSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id))
            const isFocused = focusedBatchId && group.batchId === focusedBatchId

            return (
              <div
                key={group.batchId}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isFocused
                    ? 'border-primary ring-2 ring-primary/20 bg-card'
                    : 'border-border/80 bg-card/60'
                }`}
              >
                {/* 任务批次头部 Bar */}
                <div
                  className="flex items-center justify-between p-3.5 bg-muted/30 border-b border-border/50 cursor-pointer select-none"
                  onClick={() => toggleGroupCollapse(group.batchId)}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    >
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                    </button>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                          <Layers size={14} className="text-primary" />
                          {group.batchTitle}
                        </span>
                        <span className="text-[10.5px] px-2 py-0.2 rounded-full bg-primary/10 text-primary font-medium">
                          {t('materialCountBadge', { count: group.items.length, defaultValue: `${group.items.length} 篇` })}
                        </span>
                        {group.captureKeyword && (
                          <span className="text-[10.5px] px-2 py-0.2 rounded-full bg-muted text-muted-foreground hidden sm:inline-block">
                            {t('materialKeywordTag', { keyword: group.captureKeyword, defaultValue: `关键词: ${group.captureKeyword}` })}
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {t('materialCaptureTime', { time: new Date(group.createdAt).toLocaleString(), defaultValue: `采集时间：${new Date(group.createdAt).toLocaleString()}` })}
                      </div>
                    </div>
                  </div>

                  {/* 组内全选与批量操作 */}
                  <div
                    className="flex items-center gap-3 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => selectGroupItems(groupIds)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium"
                    >
                      {allSelected
                        ? t('materialDeselectGroupAll', { defaultValue: '取消全选本组' })
                        : t('materialSelectGroupAll', { defaultValue: '全选本组' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteIds(groupIds)}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t('materialDeleteGroupTask', { defaultValue: '删除该任务' })}
                    </button>
                  </div>
                </div>

                {/* 任务批次内容卡片网格 */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5">
                    <ExtensionMaterialCardGrid
                      materials={group.items}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onOpen={(m) => setDetailId(m.id)}
                      platformLabel={platformLabel}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : viewMode === 'date' ? (
        /* 维度 2：按日期分组归档 */
        <div className="space-y-4">
          {dateGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.dateKey)
            const groupIds = group.items.map((i) => i.id)
            const allSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id))

            return (
              <div
                key={group.dateKey}
                className="rounded-2xl border border-border/80 bg-card/60 overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-3.5 bg-muted/30 border-b border-border/50 cursor-pointer select-none"
                  onClick={() => toggleGroupCollapse(group.dateKey)}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    >
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                        <Calendar size={14} className="text-primary" />
                        {group.dateLabel}
                      </span>
                      <span className="text-[10.5px] px-2 py-0.2 rounded-full bg-muted text-muted-foreground font-medium">
                        {t('materialTotalCountBadge', { count: group.items.length, defaultValue: `共 ${group.items.length} 篇` })}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-3 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => selectGroupItems(groupIds)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium"
                    >
                      {allSelected
                        ? t('materialDeselectGroupAll', { defaultValue: '取消全选本组' })
                        : t('materialSelectGroupAll', { defaultValue: '全选本组' })}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-4 sm:p-5">
                    <ExtensionMaterialCardGrid
                      materials={group.items}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onOpen={(m) => setDetailId(m.id)}
                      platformLabel={platformLabel}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* 维度 3：全部平铺网格 */
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
          <ExtensionMaterialCardGrid
            materials={filteredMaterials}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onOpen={(m) => setDetailId(m.id)}
            platformLabel={platformLabel}
          />
        </div>
      )}
    </div>
  )
}
