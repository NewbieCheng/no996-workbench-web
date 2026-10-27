import { buttonVariants } from '@no996/ui/button'
import { Label } from '@no996/ui/label'
import { Switch } from '@no996/ui/switch'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@no996/ui/utils'
import { motion } from 'framer-motion'
import { Check, Star } from 'lucide-react'
import { useState, useRef } from 'react'
import confetti from 'canvas-confetti'
import NumberFlow from '@number-flow/react'

export interface PricingPlan {
  name: string
  price: string
  yearlyPrice: string
  period: string
  features: string[]
  description: string
  buttonText: string
  href: string
  isPopular: boolean
}

export interface PricingLabels {
  annualBilling: string
  savePercent: string
  billedMonthly: string
  billedAnnually: string
  popular: string
  free: string
}

const PREVIEW_MASK = '？？？？'

interface PricingProps {
  plans: PricingPlan[]
  title?: string
  description?: string
  labels: PricingLabels
  onPlanClick?: (plan: PricingPlan) => void
  /** 占位预览：不展示真实价格、权益与计费切换 */
  preview?: boolean
}

export function Pricing({
  plans,
  title = 'Simple, Transparent Pricing',
  description = 'Choose the plan that works for you\nAll plans include access to our platform, lead generation tools, and dedicated support.',
  labels,
  onPlanClick,
  preview = false,
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const switchRef = useRef<HTMLDivElement>(null)

  const handleToggle = (checked: boolean) => {
    setIsMonthly(!checked)
    if (checked && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2

      confetti({
        particleCount: 50,
        spread: 60,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
        colors: ['#ff6400', '#ff8533', '#051d43', '#8b909a'],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ['circle'],
      })
    }
  }

  return (
    <div className="container py-4">
      <div className="mb-12 space-y-4 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{title}</h2>
        <p className="text-lg whitespace-pre-line text-muted-foreground">{description}</p>
      </div>

      {!preview ? (
        <div className="mb-10 flex justify-center items-center gap-2">
          <div ref={switchRef}>
            <Switch
              id="membership-billing-cycle"
              checked={!isMonthly}
              onCheckedChange={handleToggle}
              aria-label={labels.annualBilling}
              className="relative"
            />
          </div>
          <Label htmlFor="membership-billing-cycle" className="font-semibold text-foreground">
            {labels.annualBilling} <span className="text-primary">{labels.savePercent}</span>
          </Label>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 [perspective:1200px] md:grid-cols-3">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ y: 50, opacity: 1 }}
            whileInView={
              isDesktop
                ? {
                    y: plan.isPopular ? -20 : 0,
                    opacity: 1,
                    x: index === 2 ? -30 : index === 0 ? 30 : 0,
                    scale: index === 0 || index === 2 ? 0.94 : 1.0,
                  }
                : {}
            }
            viewport={{ once: true }}
            transition={{
              duration: 1.6,
              type: 'spring',
              stiffness: 100,
              damping: 30,
              delay: 0.4,
              opacity: { duration: 0.5 },
            }}
            className={cn(
              'relative flex flex-col rounded-2xl border-[1px] bg-background p-6 text-center text-foreground lg:flex lg:flex-col lg:justify-center',
              plan.isPopular ? 'border-2 border-primary' : 'border-border',
              !plan.isPopular && 'mt-5',
              index === 0 || index === 2
                ? 'z-0 translate-x-0 translate-y-0 -translate-z-[50px] rotate-y-[10deg] transform'
                : 'z-10',
              index === 0 && 'origin-right',
              index === 2 && 'origin-left',
            )}
          >
            {plan.isPopular && (
              <div className="absolute top-0 right-0 flex items-center rounded-tr-xl rounded-bl-xl bg-primary px-2 py-0.5">
                <Star className="h-4 w-4 fill-current text-primary-foreground" />
                <span className="ml-1 font-sans font-semibold text-primary-foreground">{labels.popular}</span>
              </div>
            )}
            <div className="flex flex-1 flex-col">
              <p className="text-base font-semibold text-muted-foreground">{plan.name}</p>
              <div className="mt-6 flex items-center justify-center gap-x-2">
                <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
                  {preview ? PREVIEW_MASK : null}
                  {!preview && Number(isMonthly ? plan.price : plan.yearlyPrice) === 0 ? (
                    labels.free
                  ) : null}
                  {!preview && Number(isMonthly ? plan.price : plan.yearlyPrice) !== 0 ? (
                    <NumberFlow
                      value={isMonthly ? Number(plan.price) : Number(plan.yearlyPrice)}
                      format={{
                        style: 'currency',
                        currency: 'CNY',
                        currencyDisplay: 'narrowSymbol',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }}
                      transformTiming={{
                        duration: 500,
                        easing: 'ease-out',
                      }}
                      willChange
                      className="tabular-nums"
                    />
                  ) : null}
                </span>
                {!preview && plan.period ? (
                  <span className="text-sm leading-6 font-semibold tracking-wide text-muted-foreground">
                    / {plan.period}
                  </span>
                ) : null}
              </div>

              {!preview ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {isMonthly ? labels.billedMonthly : labels.billedAnnually}
                </p>
              ) : null}

              <ul className="mt-5 flex flex-col gap-2">
                {plan.features.map((feature, featureIndex) => (
                  <li key={`${plan.name}-${featureIndex}`} className="flex items-start gap-2">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-left text-foreground">
                      {preview ? PREVIEW_MASK : feature}
                    </span>
                  </li>
                ))}
              </ul>

              <hr className="my-4 w-full border-border" />

              <button
                type="button"
                disabled={preview}
                onClick={() => {
                  if (preview) return
                  onPlanClick?.(plan)
                  if (!onPlanClick && plan.href && plan.href !== '#') {
                    window.location.assign(plan.href)
                  }
                }}
                className={cn(
                  buttonVariants({
                    variant: 'outline',
                  }),
                  'group relative w-full gap-2 overflow-hidden text-lg font-semibold tracking-tighter',
                  'transform-gpu ring-offset-current transition-all duration-300 ease-out hover:bg-primary hover:text-primary-foreground hover:ring-2 hover:ring-primary hover:ring-offset-1',
                  plan.isPopular
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground',
                )}
              >
                {preview ? PREVIEW_MASK : plan.buttonText}
              </button>
              <p className="mt-6 text-xs leading-5 text-muted-foreground">
                {preview ? PREVIEW_MASK : plan.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
