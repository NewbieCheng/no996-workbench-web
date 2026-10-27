import * as React from 'react'
import { HoverTip } from './tooltip'

type TipSide = 'top' | 'right' | 'bottom' | 'left' | 'inline-start' | 'inline-end'

/** 文本截断行：悬停显示完整文案，禁止 HTML title=。 */
export function TipText({
  label,
  enabled = true,
  side = 'top',
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & {
  label?: string
  enabled?: boolean
  side?: TipSide
}) {
  const tip = label ?? (typeof children === 'string' ? children : '')
  const child = (
    <span className={className} {...props}>
      {children}
    </span>
  )
  return (
    <HoverTip label={tip} enabled={enabled && Boolean(tip)} side={side}>
      {child}
    </HoverTip>
  )
}

type TipButtonProps = React.ComponentProps<'button'> & {
  label: string
  tipOpen?: boolean
  side?: TipSide
}

/** 图标/紧凑按钮：HoverTip + aria-label，禁止 HTML title=。
 *  forwardRef：可作 DropdownMenuTrigger 的 render 子节点（MenuTrigger 需要锚点 ref）。 */
export const TipButton = React.forwardRef<HTMLButtonElement, TipButtonProps>(
  function TipButton(
    { label, tipOpen, side = 'top', type = 'button', children, ...props },
    ref,
  ) {
    const child = (
      <button ref={ref} type={type} aria-label={props['aria-label'] ?? label} {...props}>
        {children}
      </button>
    )
    return (
      <HoverTip label={label} side={side} open={tipOpen === false ? false : undefined}>
        {child}
      </HoverTip>
    )
  },
)
