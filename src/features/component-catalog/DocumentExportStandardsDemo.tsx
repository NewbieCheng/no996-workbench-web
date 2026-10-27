import { useRef } from 'react';
import { DocumentExportMenu } from '@no996/ui/document-export';
import { StructuredDocument } from '@no996/ui/structured-document';
import { STRUCTURED_DOCUMENT_DEMO_SECTIONS } from './StructuredDocumentStandardsDemo';

const DEMO_MARKDOWN = `# AI 产品洞察报告：竹蜻蜓

> 演示导出 · Markdown 格式`;

const DEMO_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>演示导出</title></head><body><h1>竹蜻蜓洞察报告</h1></body></html>`;

export function DocumentExportStandardsDemo() {
  const captureRef = useRef<HTMLElement>(null);

  return (
    <div className="assets-structured-document-stage">
      <div className="assets-document-export-demo">
        <div className="assets-document-export-demo__toolbar">
          <DocumentExportMenu
            suggestedBaseName="竹蜻蜓-洞察报告"
            getMarkdown={() => DEMO_MARKDOWN}
            getHtmlDocument={() => DEMO_HTML}
            getCaptureRoot={() => captureRef.current}
            desktopBinaryExport={false}
            media={{
              saveTextFile: async ({ suggestedName, content }) => {
                const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = suggestedName;
                anchor.click();
                URL.revokeObjectURL(url);
                return { status: 'saved', path: suggestedName };
              },
            }}
          />
        </div>
        <div className="assets-document-export-demo__preview">
          <StructuredDocument
            ref={captureRef}
            sections={STRUCTURED_DOCUMENT_DEMO_SECTIONS.slice(0, 2)}
            mode="read"
            exportRoot="export-demo"
          />
        </div>
      </div>
    </div>
  );
}
