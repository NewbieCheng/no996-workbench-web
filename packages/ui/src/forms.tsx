import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from './utils';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from './combobox';

export function RadioGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div role="radiogroup" className={cn('grid gap-2', className)} {...props} />;
}

export function RadioItem({ label, ...props }: React.ComponentProps<'input'> & { label: React.ReactNode }) {
  const id = React.useId();
  return <label htmlFor={id} className="flex items-center gap-2 text-sm"><input id={id} type="radio" className="accent-primary" {...props} />{label}</label>;
}

export function Toggle({ pressed, onPressedChange, className, children, ...props }: Omit<React.ComponentProps<'button'>, 'onChange'> & { pressed: boolean; onPressedChange: (pressed: boolean) => void }) {
  return <button type="button" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)} className={cn('inline-flex h-8 items-center rounded-lg border px-3 text-sm transition-colors', pressed ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted', className)} {...props}>{children}</button>;
}

export function ToggleGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('inline-flex overflow-hidden rounded-lg border border-border [&>button]:rounded-none [&>button]:border-0 [&>button+button]:border-l', className)}>{children}</div>;
}

export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, className, ...props }: Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & { value: number; onValueChange: (value: number) => void }) {
  return <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onValueChange(Number(event.target.value))} className={cn('h-2 w-full cursor-pointer accent-primary', className)} {...props} />;
}

export function InputOTP({ length, value, onChange, className, ...props }: { length: number; value: string; onChange: (value: string) => void; className?: string } & Omit<React.ComponentProps<'div'>, 'onChange'>) {
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);
  const update = (index: number, next: string) => {
    const chars = value.padEnd(length, ' ').slice(0, length).split(' ');
    chars[index] = next.slice(-1);
    onChange(chars.join('').trimEnd());
    if (next && index < length - 1) inputs.current[index + 1]?.focus();
  };
  return <div role="group" className={cn('flex gap-2', className)} {...props}>{Array.from({ length }, (_, index) => <input key={index} ref={(node) => { inputs.current[index] = node; }} value={value[index] ?? ''} inputMode="numeric" maxLength={1} onChange={(event) => update(index, event.target.value)} onKeyDown={(event) => { if (event.key === 'Backspace' && !value[index] && index > 0) inputs.current[index - 1]?.focus(); }} aria-label={`验证码第 ${index + 1} 位`} className="size-10 rounded-lg border border-input bg-background text-center text-lg outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />)}</div>;
}

export function PasswordInput({ className, ...props }: React.ComponentProps<'input'>) {
  const [visible, setVisible] = React.useState(false);
  return <div className="relative"><input type={visible ? 'text' : 'password'} className={cn('flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50', className)} {...props} /><button type="button" className="absolute inset-y-0 right-0 px-3 text-muted-foreground" onClick={() => setVisible(!visible)} aria-label={visible ? '隐藏密码' : '显示密码'}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>;
}

export function NumberInput({ value, onValueChange, min, max, className, ...props }: Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & { value: number; onValueChange: (value: number) => void }) {
  const minimum = min === undefined ? Number.NEGATIVE_INFINITY : Number(min);
  const maximum = max === undefined ? Number.POSITIVE_INFINITY : Number(max);
  const clamp = (valueToClamp: number) => Math.min(maximum, Math.max(minimum, valueToClamp));
  return <input type="number" value={value} min={min} max={max} onChange={(event) => { const parsed = Number(event.target.value); if (Number.isFinite(parsed)) onValueChange(clamp(parsed)); }} className={cn('flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50', className)} {...props} />;
}

export function DatePicker(props: Omit<React.ComponentProps<'input'>, 'type'>) { return <input type="date" className="h-9 rounded-lg border border-input bg-background px-3 text-sm" {...props} />; }
export function TimePicker(props: Omit<React.ComponentProps<'input'>, 'type'>) { return <input type="time" className="h-9 rounded-lg border border-input bg-background px-3 text-sm" {...props} />; }
export function DateRangePicker({ startProps, endProps }: { startProps: Omit<React.ComponentProps<'input'>, 'type'>; endProps: Omit<React.ComponentProps<'input'>, 'type'> }) { return <div className="flex items-center gap-2"><DatePicker {...startProps} /><span className="text-muted-foreground">至</span><DatePicker {...endProps} /></div>; }

/** 可搜索下拉选项：label 为展示名，hint 为次行小字（默认搜 label、value、hint）。 */
export interface SearchableOption {
  value: string;
  label: string;
  hint?: string;
}

/** 下拉内搜索匹配（纯函数）：空查询全过，大小写不敏感。 */
export function matchSearchableOptions(options: readonly SearchableOption[], query: string): SearchableOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter((option) =>
    option.label.toLowerCase().includes(q) ||
    option.value.toLowerCase().includes(q) ||
    (option.hint ?? '').toLowerCase().includes(q),
  );
}

/** 带搜索的单选下拉框：触发器本身就是搜索输入，打字过滤、回车选高亮项；
 *  清除后受控值回 null，输入同步清空（此前 Select 传 undefined 会残留选中态）。
 *  ponytail: 产品三位数内全量过滤；上千时再把 filteredItems 换虚拟化列表。 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText = '无匹配项',
  className,
}: {
  options: readonly SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(next) => onChange(next?.value ?? '')}
      filter={(item: SearchableOption, query: string) => matchSearchableOptions([item], query).length > 0}
    >
      <ComboboxInput
        key={selected?.value ?? 'none'}
        placeholder={selected ? selected.label : (searchPlaceholder ?? placeholder)}
        className={cn('flex-1', className)}
      />
      <ComboboxContent>
        <ComboboxList>
          {(item: SearchableOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
              {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
