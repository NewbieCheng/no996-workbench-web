import type { ReactNode } from 'react'
import { cn } from '@no996/ui/utils'

/**
 * 内容创作页顶栏左侧工具组：了解生产流程 + 创作/历史 Tab。
 * 功能名（与侧栏 nav 一致）由 `Page` 的 `chrome="workbench-tool"` + `title` 自动展示。
 * 样式见 `workbench-page-chrome.css`；标题定位清晰，视图与说明工具保持次级层级。
 */
export function WorkbenchToolPageHeaderTools({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('page-title-extra wb-tool-chrome-header-tools', className)}>{children}</div>
}

/** @alias WorkbenchToolPageHeaderTools */
export const WorkbenchPageChromeLeading = WorkbenchToolPageHeaderTools

/** 创作页顶栏右侧：人设、重置、开发菜单等 */
export function WorkbenchPageChromeActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('page-head-actions', className)}>{children}</div>
}

export const WB_MODULE_PAGE_LAYOUT_CLASS = 'wb-module-page-layout'
