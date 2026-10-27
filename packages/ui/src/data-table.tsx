import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import { Card, CardContent } from '@no996/ui/card';
import { Checkbox } from '@no996/ui/checkbox';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@no996/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@no996/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@no996/ui/select';
import { Spinner } from '@no996/ui/spinner';
import { mapDataColumnsToVirtual, resolveVirtualTableHeight } from './data-table-virtual';
import { Table as VirtualizedTable } from './virtual-table';
import type { SortState } from './virtual-table/types';
import { useIsMobile } from './use-media-query';
import { cn } from '@no996/ui/utils';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
/** Hide the whole pagination bar until total reaches this (min page-size option). */
const PAGINATION_BAR_MIN_TOTAL = 10;

export interface DataColumn<T extends object> {
  title?: ReactNode;
  dataIndex?: string;
  key?: string;
  width?: number | string;
  ellipsis?: boolean;
  /** Client-side sort in the virtualized desktop table */
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Marks the actions column for mobile card layout */
  isActions?: boolean;
  render?: (value: any, record: T, index: number) => ReactNode;
}

export interface TablePaginationConfig {
  current?: number;
  pageSize?: number;
  total?: number;
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  onChange?: (page: number, pageSize?: number) => void;
}

type RowKey<T> = string | ((record: T) => string);

export interface RowSelection<T extends object> {
  selectedRowKeys: string[];
  onChange: (keys: string[], rows: T[]) => void;
  getCheckboxProps?: (record: T) => { disabled?: boolean };
}

export interface DataTableProps<T extends object> {
  rowKey: RowKey<T>;
  columns: DataColumn<T>[];
  dataSource: T[];
  loading?: boolean;
  pagination?: TablePaginationConfig | false;
  mobileTitleKey?: string;
  mobileSubtitleKey?: string;
  emptyText?: string;
  rowSelection?: RowSelection<T>;
  toolbar?: ReactNode;
  /** Fixed viewport height (px) for the virtualized desktop body; auto-sized when omitted. */
  tableHeight?: number;
  /** Row height (px) for virtualization; default 48. */
  rowHeight?: number;
  /** Allow column resize handles on desktop (default true). */
  resizable?: boolean;
  /** Allow column reorder on desktop (default false). */
  reorderable?: boolean;
  /** Initial client-side sort for the virtualized desktop table. */
  defaultSort?: SortState | null;
}

export type { SortState } from './virtual-table/types';

function resolveRowKey<T extends object>(rowKey: RowKey<T>, record: T, index: number): string {
  if (typeof rowKey === 'function') return rowKey(record);
  const val = (record as Record<string, unknown>)[rowKey];
  return val != null ? String(val) : String(index);
}

function isActionsColumn<T extends object>(col: DataColumn<T>): boolean {
  return col.isActions === true || col.dataIndex === 'actions' || col.key === 'actions';
}

function TablePaginationBar({
  pagination,
  className,
}: {
  pagination: TablePaginationConfig;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const current = pagination.current ?? 1;
  const pageSize = pagination.pageSize ?? 20;
  const total = pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  const showSizeChanger = pagination.showSizeChanger !== false;
  const pageSizeOptions = pagination.pageSizeOptions?.length
    ? pagination.pageSizeOptions
    : DEFAULT_PAGE_SIZE_OPTIONS;
  const sizeItems = pageSizeOptions.map((size) => ({
    value: String(size),
    label: t('pageSizeLabel', { size }),
  }));

  if (!pagination.onChange) return null;
  if (total < PAGINATION_BAR_MIN_TOTAL) return null;

  const showPager = total > pageSize;

  return (
    <div className={cn('mt-1 flex flex-nowrap items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">{t('totalItems', { total })}</p>
        {showSizeChanger && (
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              if (v == null) return;
              const next = Number(v);
              if (!Number.isFinite(next) || next === pageSize) return;
              pagination.onChange?.(1, next);
            }}
            items={sizeItems}
          >
            <SelectTrigger size="sm" aria-label={t('pageSizeAria')} className="min-w-[8.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {showPager && (
        <Pagination className="mx-0 w-auto shrink-0 justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text={t('prevPage')}
                onClick={(e) => {
                  e.preventDefault();
                  if (current > 1) pagination.onChange?.(current - 1, pageSize);
                }}
                className={current <= 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive href="#" onClick={(e) => e.preventDefault()}>
                {current} / {totalPages}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                text={t('nextPage')}
                onClick={(e) => {
                  e.preventDefault();
                  if (current < totalPages) pagination.onChange?.(current + 1, pageSize);
                }}
                className={current >= totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

/** Reusable server-pagination footer (same UX as DataTable). */
export { TablePaginationBar as DataTablePaginationBar };

export function DataTable<T extends object>({
  rowKey,
  columns,
  dataSource,
  loading,
  pagination,
  mobileTitleKey,
  mobileSubtitleKey,
  emptyText,
  rowSelection,
  toolbar,
  tableHeight,
  rowHeight = 48,
  resizable = true,
  reorderable = false,
  defaultSort = null,
}: DataTableProps<T>) {
  const { t } = useTranslation('common');
  const isMobile = useIsMobile();
  const resolvedEmpty = emptyText ?? t('empty');
  const selectionEnabled = rowSelection != null;

  const selectedSet = useMemo(
    () => new Set(rowSelection?.selectedRowKeys ?? []),
    [rowSelection?.selectedRowKeys],
  );

  const toggleRow = (key: string, record: T, checked: boolean) => {
    if (!rowSelection) return;
    if (rowSelection.getCheckboxProps?.(record)?.disabled) return;
    const next = new Set(rowSelection.selectedRowKeys);
    if (checked) next.add(key);
    else next.delete(key);
    const nextKeys = Array.from(next);
    const keySet = new Set(nextKeys);
    const rows = dataSource.filter((rec, index) =>
      keySet.has(resolveRowKey(rowKey, rec, index)),
    );
    rowSelection.onChange(nextKeys, rows);
  };

  const virtualColumns = useMemo(
    () => mapDataColumnsToVirtual(columns, dataSource, rowKey),
    [columns, dataSource, rowKey],
  );

  const height = resolveVirtualTableHeight(rowHeight, dataSource.length, tableHeight);

  const getRowId = useCallback(
    (record: T, index: number) => resolveRowKey(rowKey, record, index),
    [rowKey],
  );

  const selectableRowIds = rowSelection?.selectedRowKeys;

  const onVirtualSelectionChange = useCallback(
    (ids: string[]) => {
      if (!rowSelection) return;
      const keySet = new Set(ids);
      const rows = dataSource.filter((record, index) =>
        keySet.has(resolveRowKey(rowKey, record, index)),
      );
      rowSelection.onChange(ids, rows);
    },
    [rowSelection, dataSource, rowKey],
  );

  if (loading && dataSource.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  }

  const selectionToolbar =
    toolbar ??
    (selectionEnabled && (rowSelection?.selectedRowKeys.length ?? 0) > 0 ? (
      <p className="text-sm text-muted-foreground">
        {t('selectedCount', { count: rowSelection!.selectedRowKeys.length })}
      </p>
    ) : null);

  if (isMobile) {
    const titleCol = mobileTitleKey
      ? columns.find((c) => c.dataIndex === mobileTitleKey)
      : columns.find((c) => c.dataIndex);
    const subtitleCol = mobileSubtitleKey
      ? columns.find((c) => c.dataIndex === mobileSubtitleKey)
      : undefined;

    return (
      <div className="flex flex-col gap-3">
        {selectionToolbar}
        {dataSource.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>{resolvedEmpty}</EmptyTitle>
              <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          dataSource.map((record, index) => {
            const key = resolveRowKey(rowKey, record, index);
            const titleIdx = titleCol?.dataIndex;
            const subIdx = subtitleCol?.dataIndex;
            const titleVal =
              titleIdx != null
                ? String((record as Record<string, unknown>)[titleIdx] ?? '')
                : key;
            const subVal =
              subIdx != null ? String((record as Record<string, unknown>)[subIdx] ?? '') : '';
            const checkboxProps = rowSelection?.getCheckboxProps?.(record);
            const checked = selectedSet.has(key);

            const detailCols = columns.filter(
              (c) =>
                c.dataIndex !== titleIdx &&
                c.dataIndex !== subIdx &&
                !isActionsColumn(c),
            );

            return (
              <Card
                key={key}
                className={cn(
                  'border-border/80 bg-card/80',
                  checked && 'ring-1 ring-primary/40',
                )}
                data-state={checked ? 'selected' : undefined}
              >
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    {selectionEnabled && (
                      <Checkbox
                        checked={checked}
                        disabled={checkboxProps?.disabled}
                        onCheckedChange={(v) => toggleRow(key, record, v === true)}
                        aria-label={t('selectRow')}
                        className="mt-1"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium">{titleVal}</span>
                      {subVal && <span className="text-sm text-muted-foreground">{subVal}</span>}
                    </div>
                  </div>
                  <dl className="flex flex-col gap-2 text-sm">
                    {detailCols.map((col) => {
                      if (!col.dataIndex) return null;
                      const val = (record as Record<string, unknown>)[col.dataIndex];
                      const rendered =
                        col.render ? col.render(val, record, index) : (val as ReactNode);
                      return (
                        <div key={col.dataIndex} className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{col.title}</dt>
                          <dd className="text-right">{rendered}</dd>
                        </div>
                      );
                    })}
                  </dl>
                  {columns.some((c) => isActionsColumn(c)) && (
                    <div className="flex flex-wrap gap-1 border-t border-border pt-3">
                      {columns
                        .filter((c) => isActionsColumn(c))
                        .map((col) => col.render?.(undefined, record, index))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
        {pagination && <TablePaginationBar pagination={pagination} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {selectionToolbar}
      <VirtualizedTable
        data={dataSource}
        columns={virtualColumns}
        getRowId={getRowId}
        selectable={selectionEnabled}
        selectedRowIds={selectableRowIds}
        onSelectionChange={onVirtualSelectionChange}
        defaultSort={defaultSort}
        resizable={resizable}
        reorderable={reorderable}
        rowHeight={rowHeight}
        height={height}
        loading={loading}
        emptyState={resolvedEmpty}
        className="rounded-xl"
      />
      {pagination && <TablePaginationBar pagination={pagination} />}
    </div>
  );
}

/** @deprecated Use DataTable */
export const ResponsiveTable = DataTable;
export type ResponsiveTableProps<T extends object> = DataTableProps<T>;
