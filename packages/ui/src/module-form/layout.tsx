import * as React from 'react';
import { cn } from '../utils';
import './module-form.css';

export function FormSheet({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="form-sheet" className={cn('mf-root', className)} {...props} />;
}

export function FormSection({
  index,
  title,
  description,
  className,
  children,
  ...props
}: React.ComponentProps<'section'> & {
  index?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <section data-slot="form-section" className={cn('mf-section', className)} {...props}>
      {(index || title || description) && (
        <div className="mf-section-head">
          {index ? <span className="mf-section-index" aria-hidden="true">{index}</span> : null}
          {(title || description) && (
            <div className="mf-section-title-wrap">
              {title ? <h2 className="mf-section-title">{title}</h2> : null}
              {description ? <p className="mf-section-desc">{description}</p> : null}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function FormSectionBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="form-section-body" className={cn('mf-section-body', className)} {...props} />;
}

export function FormRow({
  columns = 1,
  className,
  ...props
}: React.ComponentProps<'div'> & { columns?: 1 | 2 | 3 }) {
  const colClass = columns === 3 ? 'mf-row--3' : columns === 2 ? 'mf-row--2' : '';
  return <div data-slot="form-row" className={cn('mf-row', colClass, className)} {...props} />;
}

export function FormActions({
  sticky = false,
  className,
  ...props
}: React.ComponentProps<'div'> & { sticky?: boolean }) {
  return (
    <div
      data-slot="form-actions"
      className={cn('mf-actions', sticky && 'mf-actions--sticky', className)}
      {...props}
    />
  );
}

export function FormActionsSpacer() {
  return <div className="mf-actions-spacer" aria-hidden="true" />;
}
