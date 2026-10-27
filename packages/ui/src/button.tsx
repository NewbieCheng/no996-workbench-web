import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@no996/ui/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.98] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        toolbar: "ui-toolbar-button",
        generate: "ui-generate-button",
        default:
          "border-[color-mix(in_srgb,var(--primary)_28%,rgba(255,255,255,0.4))] bg-[color-mix(in_srgb,var(--primary)_12%,var(--glass-fill,rgba(255,255,255,0.72)))] dark:bg-[color-mix(in_srgb,var(--primary)_18%,rgba(25,25,30,0.72))] backdrop-blur-md text-[var(--primary)] font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_3px_12px_-3px_color-mix(in_srgb,var(--primary)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_20%,var(--glass-fill,rgba(255,255,255,0.85)))] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_5px_18px_-2px_color-mix(in_srgb,var(--primary)_28%,transparent)]",
        outline:
          "border-[var(--fg-12)] bg-[color-mix(in_oklab,var(--background)_25%,transparent)] backdrop-blur-md text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)] hover:border-[var(--fg-22)] hover:bg-[color-mix(in_oklab,var(--background)_55%,transparent)] hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/20 dark:hover:bg-input/40",
        secondary:
          "border-[var(--fg-10)] bg-[color-mix(in_oklab,var(--background)_45%,var(--glass-fill,rgba(255,255,255,0.65)))] backdrop-blur-md text-secondary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_2px_8px_-2px_var(--glass-shadow)] hover:border-[var(--fg-18)] hover:bg-[color-mix(in_oklab,var(--background)_70%,var(--glass-fill,rgba(255,255,255,0.8)))] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "border-transparent hover:bg-[var(--fg-8)] hover:text-foreground active:bg-[var(--fg-12)] aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-[var(--fg-8)]",
        destructive:
          "border-[color-mix(in_srgb,var(--destructive)_26%,rgba(255,255,255,0.35))] bg-[color-mix(in_srgb,var(--destructive)_12%,var(--glass-fill,rgba(255,255,255,0.72)))] dark:bg-[color-mix(in_srgb,var(--destructive)_18%,rgba(30,22,24,0.72))] backdrop-blur-md text-destructive font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_3px_12px_-3px_color-mix(in_srgb,var(--destructive)_20%,transparent)] hover:bg-[color-mix(in_srgb,var(--destructive)_20%,var(--glass-fill,rgba(255,255,255,0.85)))] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_5px_18px_-2px_color-mix(in_srgb,var(--destructive)_28%,transparent)]",
        glass:
          "border-[var(--panel-edge-top)] bg-[var(--glass-fill)] backdrop-blur-md text-foreground shadow-[inset_0_1px_0_0_var(--glass-inner-top),inset_0_-1px_0_0_var(--glass-inner-bot),0_4px_16px_-4px_var(--glass-shadow)] hover:bg-[color-mix(in_oklab,var(--glass-fill)_80%,white_20%)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_6px_20px_-4px_var(--glass-shadow)]",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-3 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-4.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        action: "h-11 gap-2 px-7",
        icon: "size-8",
        "icon-xs":
          "size-6 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    compoundVariants: [
      { variant: ["default", "outline", "secondary", "ghost", "destructive", "glass", "link"], class: "glass-btn" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(function Button({ className, variant = "default", size = "default", ...props }, ref) {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }), (variant === "toolbar" || variant === "generate") && "ui-flat-button")}
      {...props}
    />
  )
})

export { Button, buttonVariants }
