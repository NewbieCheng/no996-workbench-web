import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@no996/ui/dialog'
import { cn } from '@no996/ui/utils'

export function ActionDialogFooter({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      data-slot="action-dialog-footer"
      className={cn(
        'flex shrink-0 flex-col-reverse gap-1.5 border-t border-border/60 bg-muted/35 px-4 py-2.5 sm:flex-row sm:justify-end sm:gap-2',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  widthClass = 'sm:max-w-lg',
  contentClassName,
  bodyClassName,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  widthClass?: string
  contentClassName?: string
  bodyClassName?: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex max-h-[min(85dvh,720px)] flex-col gap-0 overflow-hidden p-0',
          widthClass,
          contentClassName,
        )}
      >
        <DialogHeader className="shrink-0 px-4 pt-3 pb-0.5">
          <DialogTitle>{title}</DialogTitle>
          {description != null && description !== '' ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children != null && children !== false ? (
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3',
              bodyClassName,
            )}
          >
            {children}
          </div>
        ) : null}
        {footer}
      </DialogContent>
    </Dialog>
  )
}
