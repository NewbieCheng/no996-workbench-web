import { toPng } from 'html-to-image';
import type { DocumentExportFormat, DocumentExportHandlers, DocumentExportOptions } from './types';

const MAX_CAPTURE_HEIGHT_PX = 16_000;

async function captureElementPngBase64(root: HTMLElement): Promise<string> {
  const height = root.scrollHeight;
  if (height > MAX_CAPTURE_HEIGHT_PX) {
    throw new Error(`报告过长（${height}px），请使用 PDF 导出`);
  }
  const dataUrl = await toPng(root, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(root).backgroundColor || '#ffffff',
    height,
    style: {
      height: `${height}px`,
      maxHeight: 'none',
      overflow: 'visible',
    },
  });
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function fileName(base: string, ext: string): string {
  const safe = base.replace(/[<>:"/\\|?*]/g, '_').trim() || 'export';
  return safe.endsWith(`.${ext}`) ? safe : `${safe}.${ext}`;
}

export function createDocumentExportHandlers(options: DocumentExportOptions): DocumentExportHandlers {
  const {
    suggestedBaseName,
    getMarkdown,
    getHtmlDocument,
    captureRoot,
    getCaptureRoot,
    media,
    desktopBinaryExport = true,
    onSuccess,
    onCancelled,
    onError,
  } = options;

  const run = async (format: DocumentExportFormat, task: () => Promise<{ status: 'saved'; path: string } | { status: 'cancelled' }>) => {
    try {
      const result = await task();
      if (result.status === 'saved') onSuccess?.(format, result.path);
      else onCancelled?.(format);
    } catch (error) {
      onError?.(format, error);
      throw error;
    }
  };

  return {
    exportMarkdown: () =>
      run('markdown', () =>
        media.saveTextFile({
          suggestedName: fileName(suggestedBaseName, 'md'),
          content: getMarkdown(),
          extensions: ['md'],
        }),
      ),

    exportHtml: () =>
      run('html', () =>
        media.saveTextFile({
          suggestedName: fileName(suggestedBaseName, 'html'),
          content: getHtmlDocument(),
          extensions: ['html'],
        }),
      ),

    exportPng: async () => {
      if (!desktopBinaryExport || !media.saveBinaryFile) {
        throw new Error('PNG 导出仅桌面端可用');
      }
      const root = getCaptureRoot?.() ?? captureRoot ?? null;
      if (!root) throw new Error('未找到可导出的内容区域');
      await run('png', async () => {
        const dataBase64 = await captureElementPngBase64(root);
        return media.saveBinaryFile!({
          suggestedName: fileName(suggestedBaseName, 'png'),
          dataBase64,
          extensions: ['png'],
        });
      });
    },

    exportPdf: async () => {
      if (!desktopBinaryExport || !media.exportHtmlToPdf) {
        throw new Error('PDF 导出仅桌面端可用');
      }
      await run('pdf', () =>
        media.exportHtmlToPdf!({
          suggestedName: fileName(suggestedBaseName, 'pdf'),
          html: getHtmlDocument(),
        }),
      );
    },
  };
}
