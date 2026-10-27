import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@no996/ui/button';
import { ActionDialog, ActionDialogFooter } from '@no996/ui/action-dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@no996/ui/empty';
import { Input } from '@no996/ui/input';
import { cn } from '@no996/ui/utils';

export interface SearchPickerItem {
  id: string;
  title: string;
  subtitle?: string;
}

/** Unified searchable picker dialog: replaces moments/product-marketing private ProductPickerDialog. */
export function SearchPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  searchPlaceholder = '搜索名称或类型',
  emptyTitle = '没有可选条目',
  emptyDescription = '请先创建内容，再回到这里选择',
  items,
  selectedId,
  onSelect,
  renderExtra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  items: SearchPickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderExtra?: (item: SearchPickerItem) => ReactNode;
}) {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter(
      (row) =>
        row.title.toLowerCase().includes(keyword) ||
        (row.subtitle ?? '').toLowerCase().includes(keyword),
    );
  }, [items, query]);

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      widthClass="max-w-lg"
      bodyClassName="flex flex-col gap-3 py-0"
      footer={
        <ActionDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </ActionDialogFooter>
      }
    >
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          filtered.map((row) => {
            const selected = row.id === selectedId;
            return (
              <Button
                key={row.id}
                type="button"
                variant={selected ? 'secondary' : 'ghost'}
                className="h-auto w-full justify-between py-2 font-normal"
                onClick={() => {
                  onSelect(row.id);
                  onOpenChange(false);
                }}
              >
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm">{row.title}</span>
                  {row.subtitle && (
                    <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span>
                  )}
                </span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden /> : null}
                {renderExtra?.(row)}
              </Button>
            );
          })
        )}
      </div>
    </ActionDialog>
  );
}

export function cxPickerRow(selected: boolean): string {
  return cn(selected && 'ring-1 ring-primary/30');
}
