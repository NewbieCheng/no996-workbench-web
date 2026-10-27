import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@no996/ui/utils"
import { getWorkbenchPortalContainer } from "./portal-host"

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  TooltipPrimitive.Trigger.Props
>(function TooltipTrigger(props, ref) {
  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      data-slot="tooltip-trigger"
      {...props}
    />
  )
})

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal container={getWorkbenchPortalContainer()}>
      <TooltipPrimitive.Positioner
        positionMethod="absolute"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

/** 悬停提示包装：禁止用 HTML 原生 title=。菜单打开时传 open={false} 抑制叠层。
 *  内部始终受控 open，避免把 open={cond ? false : undefined} 直接喂给 Tooltip
 *  （会在受控/非受控之间切换并触发 React 警告）。 */
function HoverTip({
  label,
  side = "top",
  sideOffset = 4,
  enabled = true,
  open,
  children,
}: {
  label: string
  side?: TooltipPrimitive.Positioner.Props["side"]
  sideOffset?: number
  /** false 时直接渲染 children（标签已完整可见等）。 */
  enabled?: boolean
  /** 菜单打开时传 false，抑制与 Dropdown 叠层；勿把 undefined/boolean 直接传给底层 Tooltip。 */
  open?: boolean
  children: React.ReactElement
}) {
  // 始终受控：禁止 key remount / 卸掉 Tooltip 包裹层——否则包住的
  // DropdownMenuTrigger 会随菜单打开被销毁，Floating UI 锚点丢失落到左上角。
  const [hoverOpen, setHoverOpen] = React.useState(false)
  const suppressed = open === false

  React.useEffect(() => {
    if (suppressed) setHoverOpen(false)
  }, [suppressed])

  if (!enabled || !label) return children

  return (
    <Tooltip
      open={suppressed ? false : hoverOpen}
      onOpenChange={(next) => {
        if (!suppressed) setHoverOpen(next)
      }}
    >
      <TooltipTrigger render={children} />
      <TooltipContent side={side} sideOffset={sideOffset}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, HoverTip }
