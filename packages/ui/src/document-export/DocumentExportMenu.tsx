import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from '@no996/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu';
import { createDocumentExportHandlers } from './create-handlers';
import type { DocumentExportFormat, DocumentExportOptions } from './types';

const FORMAT_LABELS: Record<DocumentExportFormat, { key: string; fallback: string }> = {
  markdown: { key: 'documentExportMarkdown', fallback: 'Markdown (.md)' },
  html: { key: 'documentExportHtml', fallback: 'HTML 网页' },
  png: { key: 'documentExportPng', fallback: 'PNG 长图' },
  pdf: { key: 'documentExportPdf', fallback: 'PDF 文档' },
};

interface DocumentExportMenuProps extends DocumentExportOptions {
  disabled?: boolean;
  className?: string;
}

export function DocumentExportMenu({
  disabled = false,
  className,
  desktopBinaryExport = true,
  ...options
}: DocumentExportMenuProps) {
  const { t } = useTranslation('workbench');
  const [busy, setBusy] = useState<DocumentExportFormat | null>(null);
  const handlers = createDocumentExportHandlers({ ...options, desktopBinaryExport });

  const run = async (format: DocumentExportFormat, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(format);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const binaryDisabled = !desktopBinaryExport;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || Boolean(busy)}
            className={className ?? 'h-9 gap-2 text-sm'}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            {busy ? t('documentExporting', '导出中…') : t('documentExport', '导出')}
            <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {(Object.keys(FORMAT_LABELS) as DocumentExportFormat[]).map((format) => {
          const label = FORMAT_LABELS[format];
          const isBinary = format === 'png' || format === 'pdf';
          const itemDisabled = Boolean(busy) || (isBinary && binaryDisabled);
          const binaryHint =
            isBinary && binaryDisabled ? ` (${t('documentExportDesktopOnly', '仅桌面端')})` : '';
          return (
            <DropdownMenuItem
              key={format}
              disabled={itemDisabled}
              onClick={() => {
                void run(format, async () => {
                  if (format === 'markdown') await handlers.exportMarkdown();
                  else if (format === 'html') await handlers.exportHtml();
                  else if (format === 'png') await handlers.exportPng();
                  else await handlers.exportPdf();
                });
              }}
            >
              {t(label.key, label.fallback)}
              {binaryHint}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { createDocumentExportHandlers } from './create-handlers';
export type { DocumentExportOptions, DocumentExportMediaApi, DocumentExportFormat } from './types';
