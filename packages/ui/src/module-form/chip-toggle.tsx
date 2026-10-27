import * as React from 'react';
import { CheckIcon } from 'lucide-react';
import { FormField } from './field';

export interface ChipToggleOption {
  value: string;
  label: React.ReactNode;
}

export function ChipToggleGroup({
  mode,
  value,
  onChange,
  options,
  label,
  required,
  hint,
  error,
  minSelected = 0,
  className,
}: {
  mode: 'single' | 'multiple';
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: readonly ChipToggleOption[];
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  minSelected?: number;
  className?: string;
}) {
  const selectedSet = new Set(Array.isArray(value) ? value : value ? [value] : []);

  const handleSelect = (optionValue: string) => {
    if (mode === 'single') {
      onChange(optionValue);
      return;
    }
    const next = new Set(selectedSet);
    if (next.has(optionValue)) {
      if (next.size <= minSelected) return;
      next.delete(optionValue);
    } else {
      next.add(optionValue);
    }
    onChange(Array.from(next));
  };

  return (
    <FormField label={label} required={required} hint={hint} error={error} className={className}>
      <div className="mf-chip-group" role={mode === 'single' ? 'radiogroup' : 'group'}>
        {options.map((option) => {
          const isSelected = selectedSet.has(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role={mode === 'single' ? 'radio' : undefined}
              aria-checked={mode === 'single' ? isSelected : undefined}
              aria-pressed={mode === 'multiple' ? isSelected : undefined}
              data-selected={isSelected ? 'true' : 'false'}
              data-mode={mode}
              className="mf-chip"
              onClick={() => handleSelect(option.value)}
            >
              {mode === 'multiple' && isSelected ? <CheckIcon className="size-3.5" aria-hidden /> : null}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </FormField>
  );
}
