export type DocumentExportFormat = 'markdown' | 'html' | 'png' | 'pdf';

export type DocumentExportSaveResult = { status: 'saved'; path: string } | { status: 'cancelled' };

/** 导出所需的最小 media 能力（不依赖 module-sdk）。 */
export interface DocumentExportMediaApi {
  saveTextFile(input: {
    suggestedName: string;
    content: string;
    extensions?: string[];
  }): Promise<DocumentExportSaveResult>;
  saveBinaryFile?(input: {
    suggestedName: string;
    dataBase64: string;
    extensions?: string[];
  }): Promise<DocumentExportSaveResult>;
  exportHtmlToPdf?(input: { suggestedName: string; html: string }): Promise<DocumentExportSaveResult>;
}

export interface DocumentExportOptions {
  suggestedBaseName: string;
  getMarkdown: () => string;
  getHtmlDocument: () => string;
  captureRoot?: HTMLElement | null;
  getCaptureRoot?: () => HTMLElement | null;
  media: DocumentExportMediaApi;
  /** 桌面端是否支持 PNG/PDF（浏览器预览为 false）。 */
  desktopBinaryExport?: boolean;
  onSuccess?: (format: DocumentExportFormat, path: string) => void;
  onCancelled?: (format: DocumentExportFormat) => void;
  onError?: (format: DocumentExportFormat, error: unknown) => void;
}

export interface DocumentExportHandlers {
  exportMarkdown: () => Promise<void>;
  exportHtml: () => Promise<void>;
  exportPng: () => Promise<void>;
  exportPdf: () => Promise<void>;
}
