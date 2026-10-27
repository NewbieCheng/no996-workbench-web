import * as React from 'react';
import { ArrowLeft, Check, CheckCircle2, CircleAlert, Copy, Loader2 } from 'lucide-react';
import { cn } from './utils';
import './wizard-steps.css';

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return <div className={cn('space-y-1', className)}><div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue} aria-label={label}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${safeValue}%` }} /></div>{label && <p className="text-xs text-muted-foreground">{label} {safeValue}%</p>}</div>;
}

export function CopyButton({ value, label = '复制' }: { value: string; label?: string }) {
  const [message, setMessage] = React.useState(label);
  return <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={async () => { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(value); setMessage('已复制'); } catch { setMessage('复制失败，请手动复制'); } }}><Copy className="size-3" />{message}</button>;
}

export function ResultState({ status, title, description, actionLabel, onAction }: { status: 'success' | 'error' | 'empty' | 'loading'; title: string; description?: string; actionLabel?: string; onAction?: () => void }) {
  const icon = status === 'success' ? <CheckCircle2 className="size-6 text-emerald-500" /> : status === 'error' ? <CircleAlert className="size-6 text-destructive" /> : status === 'loading' ? <Loader2 className="size-6 animate-spin text-primary" /> : null;
  return <section className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">{icon}<h3 className="font-medium">{title}</h3>{description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}{actionLabel && onAction && <button type="button" className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={onAction}>{actionLabel}</button>}</section>;
}

export function ActivityTimeline({ items }: { items: Array<{ id: string; title: string; description?: string; time?: string; tone?: 'default' | 'success' | 'error' }> }) {
  return <ol className="space-y-4 border-l border-border pl-4">{items.map((item) => <li key={item.id} className="relative"><span className={cn('absolute -left-[21px] top-1 size-2.5 rounded-full bg-muted-foreground', item.tone === 'success' && 'bg-emerald-500', item.tone === 'error' && 'bg-destructive')} /><div className="flex justify-between gap-3"><p className="text-sm font-medium">{item.title}</p>{item.time && <time className="text-xs text-muted-foreground">{item.time}</time>}</div>{item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}</li>)}</ol>;
}

export function Stepper({ steps, activeIndex }: { steps: string[]; activeIndex: number }) { return <ol className="flex gap-2">{steps.map((step, index) => <li key={step} className={cn('flex items-center gap-2 text-xs', index <= activeIndex ? 'text-primary' : 'text-muted-foreground')}><span className={cn('grid size-5 place-items-center rounded-full border', index <= activeIndex ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{index + 1}</span>{step}</li>)}</ol>; }

export type WizardStepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';
export type WizardStepsVariant = 'dot' | 'number' | 'line' | 'vertical';

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
  status?: WizardStepStatus;
}

function resolveWizardStepStatus(
  step: WizardStep,
  index: number,
  activeIndex: number,
): WizardStepStatus {
  return step.status ?? (index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending');
}

function wizardStepStateClass(status: WizardStepStatus): string | undefined {
  if (status === 'active') return 'is-active';
  if (status === 'done') return 'is-done';
  if (status === 'error') return 'is-error';
  if (status === 'skipped') return 'is-skipped';
  return undefined;
}

/** Unified wizard step bar: click-to-navigate when `onStepClick` + `reachable` allow.
 *  Consolidates PromoStepBar / EcomStepBar / avatar-video-steps private CSS. */
export function WizardSteps({
  steps,
  activeIndex,
  variant = 'number',
  onStepClick,
  onBack,
  backLabel = '返回',
  ariaLabel = '制作步骤',
  className,
}: {
  steps: Array<WizardStep & { reachable?: boolean }>;
  activeIndex: number;
  variant?: WizardStepsVariant;
  onStepClick?: (index: number) => void;
  onBack?: () => void;
  backLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const showMark = variant !== 'dot' && variant !== 'line';

  return (
    <div className={cn('wizard-steps-shell', className)} role="navigation" aria-label={ariaLabel}>
      {onBack ? (
        <>
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="wizard-steps-back"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <span className="wizard-steps-back-divider" aria-hidden />
        </>
      ) : null}
      <div className="wizard-steps" data-variant={variant} role="list">
        {steps.map((step, index) => {
          const status = resolveWizardStepStatus(step, index, activeIndex);
          const clickable = Boolean(onStepClick) && (step.reachable ?? true) && index !== activeIndex;
          const stateClass = wizardStepStateClass(status);
          const markContent =
            showMark && status === 'done'
              ? <Check aria-hidden />
              : showMark
                ? String(index + 1)
                : null;

          return (
            <React.Fragment key={step.id}>
              <div role="listitem">
                <button
                  type="button"
                  disabled={!clickable}
                  aria-current={index === activeIndex ? 'step' : undefined}
                  onClick={() => onStepClick?.(index)}
                  className={cn(
                    'wizard-steps-item',
                    stateClass,
                    clickable && 'wizard-steps-item--clickable',
                  )}
                >
                  {(variant === 'dot' || showMark) ? (
                    <span className="wizard-steps-mark" aria-hidden>{markContent}</span>
                  ) : null}
                  <span className="wizard-steps-text">
                    <span className="wizard-steps-title">{step.label}</span>
                    {step.description ? (
                      <span className="wizard-steps-desc">{step.description}</span>
                    ) : null}
                  </span>
                </button>
              </div>
              {index < steps.length - 1 ? (
                <span
                  className={cn('wizard-steps-line', index < activeIndex && 'is-fill')}
                  aria-hidden
                >
                  <i />
                </span>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
