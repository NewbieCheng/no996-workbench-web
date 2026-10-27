import type { ReactNode } from 'react';
import type { DataColumn } from './data-table';
import type { TableColumn } from './virtual-table/types';

type RowKey<T> = string | ((record: T) => string);

export function resolveDataTableRowKey<T extends object>(
  rowKey: RowKey<T>,
  record: T,
  index: number,
): string {
  if (typeof rowKey === 'function') return rowKey(record);
  const val = (record as Record<string, unknown>)[rowKey];
  return val != null ? String(val) : String(index);
}

export function mapDataColumnsToVirtual<T extends object>(
  columns: DataColumn<T>[],
  dataSource: T[],
  _rowKey: RowKey<T>,
): TableColumn<T>[] {
  return columns.map((col, colIndex) => {
    const key = col.key ?? col.dataIndex ?? `col-${colIndex}`;
    const width =
      col.width != null
        ? typeof col.width === 'number'
          ? `${col.width}px`
          : String(col.width)
        : undefined;
    return {
      key,
      header: col.title ?? '',
      width,
      sortable: col.sortable,
      align: col.align,
      cell: (row: T) => {
        const index = dataSource.indexOf(row);
        const val =
          col.dataIndex != null
            ? (row as Record<string, unknown>)[col.dataIndex]
            : undefined;
        const content = col.render ? col.render(val, row, index) : (val as ReactNode);
        return col.ellipsis ? (
          <span className="block min-w-0 truncate">{content}</span>
        ) : (
          content
        );
      },
    };
  });
}

export function resolveVirtualTableHeight(
  rowHeight: number,
  rowCount: number,
  tableHeight?: number,
): number {
  if (tableHeight != null) return tableHeight;
  const header = rowHeight;
  const body = rowCount * rowHeight;
  const max = 480;
  const min = rowHeight * 4;
  if (rowCount === 0) return min + header;
  return Math.min(max, Math.max(min, body + header));
}
