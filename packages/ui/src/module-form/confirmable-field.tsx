import { CheckIcon } from 'lucide-react';
import { Textarea } from '../textarea';
import { HoverTip } from '../tooltip';
import { cn } from '../utils';

export function ConfirmableFormField({
  label,
  placeholder,
  value,
  pending,
  pendingLabel,
  confirmedLabel,
  confirmActionLabel,
  markPendingLabel,
  onChange,
  onConfirm,
  onMarkPending,
  rows = 1,
  className,
}: {
  label: string;
  placeholder?: string;
  value: string;
  pending: boolean;
  pendingLabel: string;
  confirmedLabel: string;
  confirmActionLabel: string;
  markPendingLabel: string;
  onChange: (next: string) => void;
  onConfirm: () => void;
  onMarkPending: () => void;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('mf-confirmable', className)}>
      <div className="mf-confirmable-head">
        <span className="mf-confirmable-label">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {pending ? (
            <>
              <span className="mf-confirmable-status mf-confirmable-status--pending">{pendingLabel}</span>
              <button type="button" className="mf-confirmable-quick" onClick={onConfirm}>
                <CheckIcon className="size-3" aria-hidden />
                {confirmActionLabel}
              </button>
            </>
          ) : (
            <HoverTip label={markPendingLabel}>
              <button
                type="button"
                className="mf-confirmable-status mf-confirmable-status--done"
                onClick={onMarkPending}
              >
                <CheckIcon className="size-3" aria-hidden />
                {confirmedLabel}
              </button>
            </HoverTip>
          )}
        </div>
      </div>
      <div
        className={cn(
          'mf-confirmable-box',
          pending ? 'mf-confirmable-box--pending' : 'mf-confirmable-box--done',
        )}
      >
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
