import * as React from 'react';
import { cn } from '../utils';

export function FormField({
  label,
  labelMode = 'stacked',
  required,
  hint,
  error,
  htmlFor,
  labelAction,
  className,
  children,
}: {
  label?: React.ReactNode;
  labelMode?: 'stacked' | 'floating';
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  labelAction?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  if (labelMode === 'floating') {
    return (
      <div data-slot="form-field" className={cn('mf-field', className)}>
        {children}
        {hint && !error ? <p className="mf-field-hint">{hint}</p> : null}
        {error ? <p className="mf-field-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <div data-slot="form-field" className={cn('mf-field', className)}>
      {label || labelAction ? (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          {label ? (
            <label className="mf-field-label-stacked" htmlFor={htmlFor}>
              {label}
              {required ? <span className="mf-field-required" aria-hidden="true"> *</span> : null}
            </label>
          ) : <span />}
          {labelAction ? <div className="text-xs">{labelAction}</div> : null}
        </div>
      ) : null}
      {children}
      {hint && !error ? <p className="mf-field-hint">{hint}</p> : null}
      {error ? <p className="mf-field-error" role="alert">{error}</p> : null}
    </div>
  );
}
