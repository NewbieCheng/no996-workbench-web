import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@no996/ui/utils"
import { Button } from "@no996/ui/button"
import { XIcon } from "lucide-react"
import { getWorkbenchPortalContainer } from "./portal-host"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ container, ...props }: DialogPrimitive.Portal.Props) {
  return (
    <DialogPrimitive.Portal
      data-slot="dialog-portal"
      {...props}
      container={container ?? getWorkbenchPortalContainer()}
    />
  )
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = false,
  showOverlay = true,
  overlayClassName,
  positionerClassName,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** false 时不渲染半透明遮罩（浮层式提词卡等场景）。 */
  showOverlay?: boolean
  overlayClassName?: string
  /** 覆盖默认居中浮层定位（如左侧全高抽屉）。 */
  positionerClassName?: string
}) {
  return (
    <DialogPortal>
      {showOverlay ? <DialogOverlay className={overlayClassName} /> : null}
      <div
        data-slot="dialog-positioner"
        className={cn(
          "pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4",
          positionerClassName,
        )}
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "pointer-events-auto relative grid w-full max-w-[calc(100%-2rem)] gap-3 rounded-xl bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none supports-backdrop-filter:backdrop-blur-xl sm:max-w-sm",
            showCloseButton && "[&_[data-slot=dialog-header]]:pr-7",
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            /**
             * 定位必须放在这层普通 div 上，**不能**交给 `render` 里的 Button：
             * Base UI 的 `render` 会接管内层元素的 className，写在那里会被丢掉，
             * 关闭按钮就退化成 grid 的最后一行、掉到弹框左下角（用户报的「底部删除符号」）。
             */
            <div className="absolute top-1.5 right-1.5 z-10">
              <DialogPrimitive.Close
                data-slot="dialog-close"
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <XIcon />
                <span className="sr-only">关闭</span>
              </DialogPrimitive.Close>
            </div>
          )}
        </DialogPrimitive.Popup>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-3 flex flex-col-reverse gap-1.5 rounded-b-xl border-t border-border/60 bg-muted/35 px-4 py-2.5 sm:flex-row sm:justify-end sm:gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-[0.9375rem] leading-snug font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-xs leading-relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
