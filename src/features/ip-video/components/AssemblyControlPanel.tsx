/**
 * IP 口播视频 · 预制组件与动效镜头
 *
 * 这里原本只是两个 `<select>`（视觉风格 / 主排版布局）。
 * 现在除了保留那两个**确实生效**的排版预设，还把视频工厂的 151 个动效镜头
 * 作为真实镜头库直接嵌进来 —— 用户在这里就能挑镜头铺到口播画面的背景上。
 *
 * 分工：
 *   本面板  → 选风格 / 选排版 / **从镜头库挑镜头**（决定「有哪些镜头」）
 *   下一个面板 ShotBackdropPanel → 调每个镜头的起止/变速/透明度（决定「怎么放」）
 */

import type { ShotDefinition } from '@no996/video-editor'
import { ShotLibraryPanel } from '@no996/video-editor'
import { Button } from '@no996/ui/button'
import {
  ASSEMBLY_STYLES,
  ASSEMBLY_LAYOUTS,
  type AssemblyStyleId,
  type AssemblyLayoutId,
} from '@no996/video-editor/core'

export interface AssemblyControlPanelProps {
  currentStyleId: AssemblyStyleId
  currentLayoutId: AssemblyLayoutId
  onStyleChange: (styleId: AssemblyStyleId) => void
  onLayoutChange: (layoutId: AssemblyLayoutId) => void
  onApplyAssembly: () => void
  /** 从镜头库挑中一个镜头时回调 */
  onPickShot?: (shot: ShotDefinition) => void
  /** 已挂载的镜头数量，用于提示 */
  shotCount?: number
  isAssembling?: boolean
  disabled?: boolean
}

export function AssemblyControlPanel({
  currentStyleId,
  currentLayoutId,
  onStyleChange,
  onLayoutChange,
  onApplyAssembly,
  onPickShot,
  shotCount = 0,
  isAssembling = false,
  disabled = false,
}: AssemblyControlPanelProps) {
  const selectClass =
    'w-full px-2 py-1.5 rounded bg-muted/40 border border-input text-xs'

  return (
    <div className="ipv-editor-section">
      <div className="flex items-center justify-between pb-2">
        <h3 className="font-semibold text-xs">
          预制组件与动效镜头
          {shotCount > 0 && (
            <span className="ml-1 font-normal text-muted-foreground">已挂 {shotCount} 个</span>
          )}
        </h3>
        <Button
          size="sm"
          variant="toolbar"
          onClick={onApplyAssembly}
          disabled={disabled || isAssembling}
        >
          {isAssembling ? '正在应用...' : '应用预设组合'}
        </Button>
      </div>

      <div className="ipv-editor-section-body">
        {/* 排版预设：这两个下拉是真的改标题/字幕的颜色与位置 */}
        <div className="ipv-editor-grid">
          <div>
            <label className="block mb-1 text-xs text-muted-foreground" htmlFor="ipv-style">
              视觉风格
            </label>
            <select
              id="ipv-style"
              className={selectClass}
              value={currentStyleId}
              disabled={disabled}
              onChange={(e) => onStyleChange(e.target.value as AssemblyStyleId)}
            >
              {Object.values(ASSEMBLY_STYLES).map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 text-xs text-muted-foreground" htmlFor="ipv-layout">
              主排版布局
            </label>
            <select
              id="ipv-layout"
              className={selectClass}
              value={currentLayoutId}
              disabled={disabled}
              onChange={(e) => onLayoutChange(e.target.value as AssemblyLayoutId)}
            >
              {Object.values(ASSEMBLY_LAYOUTS).map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 真实镜头库：与视频工厂用的是同一个 SHOT_CATALOG（151 个镜头） */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">动效镜头库</span>
            <span className="text-[10px] text-muted-foreground">点一下即加入背景</span>
          </div>
          <div
            className="rounded border border-input overflow-hidden"
            style={{ height: 320 }}
            aria-label="动效镜头库"
          >
            {disabled ? (
              <p className="m-0 p-3 text-[11px] text-muted-foreground">当前状态下不可编辑</p>
            ) : (
              <ShotLibraryPanel onPick={onPickShot} />
            )}
          </div>
          {shotCount > 0 && (
            <p className="mt-1 mb-0 text-[10px] text-muted-foreground leading-relaxed">
              已挂 {shotCount} 个镜头。下方「动效背景」里可以调每个镜头的起止时间、变速与透明度。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
