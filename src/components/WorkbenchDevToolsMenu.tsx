import React from 'react'
import { Wrench } from 'lucide-react'
import { Button } from '@no996/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'

export type WorkbenchDevToolsMenuItem = {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  separatorBefore?: boolean
}

type Props = {
  items: WorkbenchDevToolsMenuItem[]
  /** 无障碍标签，默认「调试」 */
  ariaLabel?: string
}

/**
 * 本地开发专用：页头一颗设置图标，点开再选「填入示例 / 模拟产出」等，不占主栏宽度。
 * 生产构建不挂载（调用方用 import.meta.env.DEV 包裹）。
 */
export function WorkbenchDevToolsMenu({ items, ariaLabel = '调试' }: Props) {
  if (!items.length) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={ariaLabel}
            title={ariaLabel}
          >
            <Wrench className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        {items.map((item) => (
          <React.Fragment key={item.id}>
            {item.separatorBefore ? (
              <div className="my-1 h-px bg-border" role="separator" aria-hidden="true" />
            ) : null}
            <DropdownMenuItem disabled={item.disabled} onClick={() => item.onSelect()}>
              {item.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
