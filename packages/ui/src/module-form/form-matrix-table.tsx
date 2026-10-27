import * as React from 'react';
import { Button } from '../button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../table';
import { Input } from '../input';
import { cn } from '../utils';

export type FormMatrixRow = Record<string, unknown> & { id?: string };

export type FormMatrixColumn<T extends FormMatrixRow> =
  | {
      key: string;
      header: React.ReactNode;
      width?: string;
      render: (row: T, rowIndex: number) => React.ReactNode;
    }
  | {
      key: string;
      header: React.ReactNode;
      width?: string;
      type: 'text' | 'number';
      placeholder?: string;
    };

export function FormMatrixTable<T extends FormMatrixRow>({
  columns,
  rows,
  onChange,
  bulkActions,
  bulkApplyLabel = '应用到全部',
  rowCountLabel,
  className,
  getRowId = (row, index) => row.id ?? String(index),
}: {
  columns: readonly FormMatrixColumn<T>[];
  rows: readonly T[];
  onChange: (next: T[]) => void;
  bulkActions?: Partial<Record<string, boolean>>;
  bulkApplyLabel?: string;
  rowCountLabel?: React.ReactNode;
  className?: string;
  getRowId?: (row: T, index: number) => string;
}) {
  const editableKeys = columns
    .filter((column): column is Extract<FormMatrixColumn<T>, { type: string }> => 'type' in column)
    .map((column) => column.key)
    .filter((key) => bulkActions?.[key]);

  const [bulkValues, setBulkValues] = React.useState<Record<string, string>>({});

  const updateCell = (rowIndex: number, key: string, value: string) => {
    const next = rows.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row));
    onChange(next as T[]);
  };

  const applyBulk = () => {
    if (editableKeys.length === 0) return;
    const hasValue = editableKeys.some((key) => bulkValues[key]?.trim());
    if (!hasValue) return;
    const next = rows.map((row) => {
      const patch: Record<string, string> = {};
      for (const key of editableKeys) {
        const bulk = bulkValues[key];
        if (bulk?.trim()) patch[key] = bulk;
      }
      return Object.keys(patch).length > 0 ? { ...row, ...patch } : row;
    });
    onChange(next as T[]);
  };

  return (
    <div className={cn('mf-matrix', className)}>
      <div className="mf-matrix-bulk">
        <div className="mf-matrix-bulk-label">
          {rowCountLabel ?? 'SKU 列表'}
          <span className="mf-matrix-bulk-count">{rows.length}</span>
        </div>
        {editableKeys.length > 0 ? (
          <div className="mf-matrix-bulk-bar">
            {editableKeys.map((key, index) => {
              const column = columns.find((col) => col.key === key);
              const placeholder =
                column && 'placeholder' in column ? column.placeholder : key;
              return (
                <React.Fragment key={key}>
                  {index > 0 ? <div className="mf-matrix-bulk-sep" aria-hidden /> : null}
                  <input
                    type={column && 'type' in column && column.type === 'number' ? 'number' : 'text'}
                    value={bulkValues[key] ?? ''}
                    placeholder={placeholder}
                    onChange={(event) =>
                      setBulkValues((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                  />
                </React.Fragment>
              );
            })}
            <div className="mf-matrix-bulk-sep" aria-hidden />
            <Button type="button" size="sm" onClick={applyBulk}>
              {bulkApplyLabel}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mf-matrix-wrap">
        <div className="mf-matrix-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} style={column.width ? { width: column.width } : undefined}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={getRowId(row, rowIndex)}>
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {'render' in column ? (
                        column.render(row, rowIndex)
                      ) : (
                        <Input
                          type={column.type === 'number' ? 'number' : 'text'}
                          placeholder={column.placeholder}
                          value={String(row[column.key] ?? '')}
                          onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                          className="mf-floating__control mf-floating__control--inline h-auto"
                          aria-label={typeof column.header === 'string' ? column.header : column.key}
                        />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export function MatrixComboChips({ values }: { values: readonly string[] }) {
  return (
    <div className="mf-matrix-combo">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}
