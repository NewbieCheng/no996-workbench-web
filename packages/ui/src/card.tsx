import * as React from "react"

import { GlassPanel } from "./GlassPanel"
import { cn } from "@no996/ui/utils"

function Card({
  className,
  size = "default",
  glow = false,
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm"; glow?: boolean }) {
  return (
    <GlassPanel
      glow={glow}
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden text-sm text-card-foreground transition-all has-[>img:first-child]:pt-0 *:[img:first-child]:rounded-t-[length:var(--glass-panel-radius,16px)] *:[img:last-child]:rounded-b-[length:var(--glass-panel-radius,16px)]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-[length:var(--glass-panel-radius,16px)] px-6 pt-6 pb-4 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pt-4 group-data-[size=sm]/card:pb-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6 group-data-[size=sm]/card:px-4", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-[length:var(--glass-panel-radius,16px)] border-t border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-transparent px-6 py-4 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:py-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
