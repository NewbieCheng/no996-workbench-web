import * as React from 'react';
import { Input } from '../input';
import { Textarea } from '../textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../select';
import { cn } from '../utils';

function useFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return !Number.isNaN(value);
  return true;
}

function FloatingShell({
  id,
  label,
  required,
  filled,
  counter,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  filled: boolean;
  counter?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mf-floating', className)} data-filled={filled ? 'true' : 'false'}>
      {children}
      <label className="mf-floating__label" htmlFor={id}>
        {label}
        {required ? <span className="mf-field-required" aria-hidden="true"> *</span> : null}
      </label>
      {counter}
    </div>
  );
}

export const FloatingInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'placeholder'> & {
    label: React.ReactNode;
    showCount?: boolean;
    variant?: 'default' | 'inline';
  }
>(function FloatingInput(
  { label, required, showCount, maxLength, value, defaultValue, variant = 'default', className, id: idProp, ...props },
  ref,
) {
  const autoId = React.useId();
  const id = idProp ?? autoId;
  const filled = useFilled(value ?? defaultValue);
  const length = typeof value === 'string' ? value.length : typeof defaultValue === 'string' ? defaultValue.length : 0;
  const warn = maxLength ? length >= maxLength * 0.9 : false;

  return (
    <FloatingShell
      id={id}
      label={label}
      required={required}
      filled={filled}
      counter={showCount && maxLength ? (
        <span className={cn('mf-floating__counter', warn && 'mf-floating__counter--warn')}>
          <b>{length}</b>/{maxLength}
        </span>
      ) : undefined}
    >
      <Input
        ref={ref}
        id={id}
        placeholder=" "
        required={required}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        className={cn(
          'mf-floating__control',
          variant === 'inline' && 'mf-floating__control--inline',
          className,
        )}
        {...props}
      />
    </FloatingShell>
  );
});

export const FloatingTextarea = React.forwardRef<
  HTMLTextAreaElement,
  Omit<React.ComponentProps<'textarea'>, 'placeholder'> & {
    label: React.ReactNode;
    showCount?: boolean;
    variant?: 'default' | 'inline';
  }
>(function FloatingTextarea(
  { label, required, showCount, maxLength, value, defaultValue, variant = 'default', className, id: idProp, rows = 3, ...props },
  ref,
) {
  const autoId = React.useId();
  const id = idProp ?? autoId;
  const filled = useFilled(value ?? defaultValue);
  const length = typeof value === 'string' ? value.length : typeof defaultValue === 'string' ? defaultValue.length : 0;
  const warn = maxLength ? length >= maxLength * 0.9 : false;

  return (
    <FloatingShell
      id={id}
      label={label}
      required={required}
      filled={filled}
      counter={showCount && maxLength ? (
        <span className={cn('mf-floating__counter', warn && 'mf-floating__counter--warn')}>
          <b>{length}</b>/{maxLength}
        </span>
      ) : undefined}
    >
      <Textarea
        ref={ref}
        id={id}
        rows={rows}
        placeholder=" "
        required={required}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        className={cn(
          'mf-floating__control mf-floating__control--textarea',
          variant === 'inline' && 'mf-floating__control--inline',
          className,
        )}
        {...props}
      />
    </FloatingShell>
  );
});

export interface FloatingSelectOption {
  value: string;
  label: React.ReactNode;
}

export function FloatingSelect({
  label,
  required,
  value,
  onValueChange,
  options,
  placeholder,
  className,
  id: idProp,
}: {
  label: React.ReactNode;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly FloatingSelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const autoId = React.useId();
  const id = idProp ?? autoId;
  const filled = useFilled(value);
  const items = options.map((option) => ({ value: option.value, label: option.label }));

  return (
    <div className={cn('mf-floating mf-floating-select', className)} data-filled={filled ? 'true' : 'false'}>
      <Select items={items} value={value || null} onValueChange={(next) => onValueChange(next ?? '')}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="mf-floating__label" htmlFor={id}>
        {label}
        {required ? <span className="mf-field-required" aria-hidden="true"> *</span> : null}
      </label>
    </div>
  );
}
