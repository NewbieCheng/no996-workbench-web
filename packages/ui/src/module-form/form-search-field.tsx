import * as React from 'react';
import { Button } from '../button';
import { SearchableSelect, type SearchableOption } from '../forms';
import { FormField } from './field';

export function FormSearchField({
  label,
  required,
  hint,
  error,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  onClear,
  clearLabel = '清除',
  className,
}: {
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  options: readonly SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onClear?: () => void;
  clearLabel?: string;
  className?: string;
}) {
  return (
    <FormField label={label} required={required} hint={hint} error={error} className={className}>
      <div className="mf-search-row">
        <SearchableSelect
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          className="h-10 w-full"
        />
        {value && onClear ? (
          <Button type="button" variant="ghost" onClick={onClear}>
            {clearLabel}
          </Button>
        ) : null}
      </div>
    </FormField>
  );
}
