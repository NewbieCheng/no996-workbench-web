import React, { useLayoutEffect, useRef, useState } from 'react'
import {
  CheckIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  Minimize2Icon,
  Maximize2Icon,
} from 'lucide-react'
import { cn } from './utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import type { WizardStep } from './feedback'

export type FloatingWizardDockStep = WizardStep & {
  reachable?: boolean
}

export type FloatingWizardDockLabels = {
  collapsedAriaLabel: string
  expand: string
  collapse: string
  previous: string
  next: string
  navigation: string
  current: (index: number, total: number) => string
  compact: (index: number, total: number, label: string) => string
}

export type FloatingWizardDockProps = {
  steps: FloatingWizardDockStep[]
  activeIndex: number
  onStepClick?: (index: number) => void
  onPrev?: () => void
  onNext?: () => void
  canNavigateTo?: (index: number) => boolean
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  ariaLabel?: string
  className?: string
  actions?: React.ReactNode
  /** Existing callers remain viewport-positioned; inline leaves placement to the parent. */
  layout?: 'viewport' | 'inline'
  /** Disable all authored motion, including the persistent indicators. */
  motion?: boolean
  /** Navigation-only guides must not infer completion from the active index. */
  inferCompleted?: boolean
  showStepLabels?: boolean
  reselectActive?: boolean
  labels?: Partial<FloatingWizardDockLabels>
}

const defaultLabels: FloatingWizardDockLabels = {
  collapsedAriaLabel: '创作向导进度提醒',
  expand: '展开流程导航',
  collapse: '收起为悬浮球',
  previous: '返回上一步',
  next: '进入下一步',
  navigation: '向导节点',
  current: index => `第 ${index + 1} 步`,
  compact: (index, total, label) => `步骤 ${index + 1}/${total} · ${label}`,
}

const focusClasses = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
const reducedMotionClasses = 'motion-reduce:animate-none motion-reduce:transition-none motion-reduce:transform-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100'

function DockTip({ label, motion, children }: { label: string; motion: boolean; children: React.ReactElement }) {
  const trigger = React.isValidElement(children)
    ? children
    : (React.Children.toArray(children).find(React.isValidElement) as React.ReactElement | undefined)
  if (!trigger) return children
  return <Tooltip>
    <TooltipTrigger render={trigger} />
    <TooltipContent className={cn('motion-reduce:animate-none! motion-reduce:transition-none!', !motion && 'animate-none! transition-none!')}>
      {label}
    </TooltipContent>
  </Tooltip>
}

/** Bottom wizard navigation. Optional inline placement also supports non-progress setting guides. */
export function FloatingWizardDock({
  steps,
  activeIndex,
  onStepClick,
  onPrev,
  onNext,
  canNavigateTo,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  ariaLabel = '创作向导流程导航',
  className,
  actions,
  layout = 'viewport',
  motion = true,
  inferCompleted = true,
  showStepLabels = false,
  reselectActive = false,
  labels,
}: FloatingWizardDockProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const dockRef = useRef<HTMLElement>(null)
  const restoreToggleFocus = useRef(false)
  const restoreNavigationFocus = useRef(false)
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed
  useLayoutEffect(() => {
    if (!restoreToggleFocus.current) return
    dockRef.current?.querySelector<HTMLButtonElement>(isCollapsed ? '[data-slot="wizard-expand"]' : '[data-slot="wizard-collapse"]')?.focus()
    restoreToggleFocus.current = false
  }, [isCollapsed])
  useLayoutEffect(() => {
    if (!restoreNavigationFocus.current) return
    // Boundary arrows disappear. Preserve focus without overriding a parent's panel focus.
    if (document.activeElement === document.body) {
      dockRef.current?.querySelector<HTMLButtonElement>('[aria-current="step"]')?.focus()
    }
    restoreNavigationFocus.current = false
  }, [activeIndex])
  const copy = { ...defaultLabels, ...labels }
  const inline = layout === 'inline'
  const motionClasses = motion ? 'transition-all' : 'transition-none'
  const setCollapsed = (next: boolean) => {
    restoreToggleFocus.current = Boolean(dockRef.current?.contains(document.activeElement))
    if (onCollapsedChange) onCollapsedChange(next)
    else setInternalCollapsed(next)
  }
  const currentStep = steps[activeIndex] || steps[0]
  const total = steps.length
  const isReachable = (index: number) => canNavigateTo ? canNavigateTo(index) : steps[index]?.reachable ?? true
  const handleStepSelect = (index: number) => {
    if (index === activeIndex && !reselectActive) return
    if (isReachable(index)) onStepClick?.(index)
  }

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <aside
          ref={dockRef}
          aria-label={copy.collapsedAriaLabel}
          data-slot="floating-wizard-dock"
          data-layout={layout}
          data-collapsed="true"
          data-motion={motion}
          className={cn(
            inline ? 'relative w-fit max-w-full' : 'fixed bottom-6 right-6 z-50',
            motion && 'animate-in fade-in zoom-in-90 duration-200',
            reducedMotionClasses,
            className
          )}
        >
          <DockTip motion={motion} label={copy.expand}>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className={cn(
                'group relative flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-background/90 hover:bg-background text-foreground border border-border/80 shadow-[0_10px_25px_rgba(0,0,0,0.08)] ring-1 ring-border/50 dark:bg-zinc-900/90 dark:hover:bg-zinc-800/90 dark:text-zinc-100 dark:border-white/10 dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl cursor-pointer',
                motion && 'hover:scale-105 active:scale-95',
                motionClasses, reducedMotionClasses, focusClasses
              )}
              aria-label={copy.expand}
              aria-expanded={false}
              data-slot="wizard-expand"
            >
              <span className="relative flex size-2" aria-hidden="true">
                {motion && <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-reduce:hidden" />}
                <span className="relative inline-flex rounded-full size-2 bg-primary" />
              </span>
              <span className="text-xs font-semibold tracking-wide">
                {copy.compact(activeIndex, total, currentStep?.label || '')}
              </span>
              <span className="size-5 rounded-full bg-muted/80 dark:bg-white/10 flex items-center justify-center text-muted-foreground dark:text-zinc-300 group-hover:text-foreground dark:group-hover:text-white">
                <Maximize2Icon className="size-3" aria-hidden="true" />
              </span>
            </button>
          </DockTip>
        </aside>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <aside
        ref={dockRef}
        aria-label={ariaLabel}
        data-slot="floating-wizard-dock"
        data-layout={layout}
        data-collapsed="false"
        data-motion={motion}
        className={cn(
          inline ? 'relative w-full min-w-0' : 'fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[94vw] z-40 pointer-events-auto',
          motion && 'animate-in fade-in slide-in-from-bottom-3 duration-200',
          reducedMotionClasses,
          className
        )}
      >
        <div data-slot="wizard-surface" className="flex items-center gap-2 sm:gap-3 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-background/90 text-foreground border border-border/80 shadow-[0_12px_32px_rgba(0,0,0,0.08)] ring-1 ring-border/50 dark:bg-zinc-900/90 dark:text-zinc-100 dark:border-white/10 dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div data-slot="wizard-current" className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 border-r border-border/80 dark:border-white/10 text-xs">
            <span aria-hidden="true" className={cn('size-2 rounded-full bg-primary', motion && 'animate-pulse motion-reduce:animate-none')} />
            <span className="font-semibold whitespace-nowrap text-foreground dark:text-zinc-100">{copy.current(activeIndex, total)}</span>
            <span className="hidden sm:inline text-muted-foreground dark:text-zinc-400 text-[11px] whitespace-nowrap">{currentStep?.label || ''}</span>
          </div>
          <nav aria-label={copy.navigation} className="flex items-center gap-1 sm:gap-1.5">
            {steps.map((step, idx) => {
              const isPassed = (inferCompleted && idx < activeIndex) || step.status === 'done'
              const isCurrent = idx === activeIndex
              const isClickable = Boolean(onStepClick && isReachable(idx))
              return (
                <div key={step.id || idx} className="flex items-center">
                  <button
                    type="button"
                    disabled={!isClickable && !isCurrent}
                    onClick={() => isClickable && handleStepSelect(idx)}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`${idx + 1}. ${step.label}`}
                    data-slot="wizard-step"
                    className={cn(
                      'group relative flex items-center justify-center', motionClasses, reducedMotionClasses, focusClasses,
                      isCurrent
                        ? 'px-3 py-1 rounded-full bg-primary text-primary-foreground shadow-xs font-semibold text-xs ring-2 ring-primary/20'
                        : isPassed
                          ? 'size-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 cursor-pointer text-[11px] font-medium'
                          : 'size-6 rounded-full bg-muted/60 text-muted-foreground/60 dark:bg-white/5 dark:text-white/30 cursor-not-allowed text-[11px]',
                      showStepLabels && (isClickable ? 'cursor-pointer' : !isCurrent && 'cursor-not-allowed'),
                      showStepLabels && 'h-auto w-auto px-3 py-1.5'
                    )}
                  >
                    {isPassed && !isCurrent ? <><CheckIcon className="size-3.5 stroke-[2.5]" aria-hidden="true" />{showStepLabels && <span className="ml-1.5">{step.label}</span>}</>
                      : isCurrent || showStepLabels ? <span className="flex items-center gap-1.5 whitespace-nowrap"><span>{idx + 1}</span><span className={showStepLabels ? undefined : 'hidden md:inline'}>{step.label}</span></span>
                        : <span>{idx + 1}</span>}
                  </button>
                  {idx < total - 1 && <div aria-hidden="true" className={cn('w-1.5 sm:w-2.5 h-[1.5px] mx-0.5 rounded-full', motionClasses, reducedMotionClasses, inferCompleted && idx < activeIndex ? 'bg-primary' : 'bg-border/80 dark:bg-white/10')} />}
                </div>
              )
            })}
          </nav>
          {actions && <div data-slot="wizard-actions" className="flex items-center pl-1 sm:pl-2 border-l border-border/80 dark:border-white/10">{actions}</div>}
          <div data-slot="wizard-controls" className="flex items-center gap-1 pl-1.5 sm:pl-2 border-l border-border/80 dark:border-white/10">
            {activeIndex > 0 && <DockTip motion={motion} label={copy.previous}><button
              type="button"
              onClick={() => {
                restoreNavigationFocus.current = true
                if (onPrev) onPrev()
                else if (onStepClick) handleStepSelect(activeIndex - 1)
              }}
              className={cn('p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 cursor-pointer', motionClasses, reducedMotionClasses, focusClasses)}
              aria-label={copy.previous}
            ><ChevronLeftIcon className="size-4" aria-hidden="true" /></button></DockTip>}
            {activeIndex < total - 1 && <DockTip motion={motion} label={copy.next}><button
              type="button"
              disabled={Boolean(canNavigateTo && !canNavigateTo(activeIndex + 1))}
              onClick={() => {
                restoreNavigationFocus.current = true
                if (onNext) onNext()
                else if (onStepClick) handleStepSelect(activeIndex + 1)
              }}
              className={cn('p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed', motionClasses, reducedMotionClasses, focusClasses)}
              aria-label={copy.next}
            ><ChevronRightIcon className="size-4" aria-hidden="true" /></button></DockTip>}
            <DockTip motion={motion} label={copy.collapse}><button
              type="button"
              onClick={() => setCollapsed(true)}
              className={cn('p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 ml-0.5 cursor-pointer', motionClasses, reducedMotionClasses, focusClasses)}
              aria-label={copy.collapse}
              data-slot="wizard-collapse"
              aria-expanded={true}
            ><Minimize2Icon className="size-3.5" aria-hidden="true" /></button></DockTip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
