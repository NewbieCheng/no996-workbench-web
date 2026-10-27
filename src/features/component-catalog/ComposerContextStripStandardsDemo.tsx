import { useMemo, useState } from 'react';
import { AppWindowIcon, PresentationIcon } from 'lucide-react';
import {
  AttachmentUploader,
  createAttachmentDrafts,
  releaseAttachmentDrafts,
  type AttachmentUploaderItem,
} from '@no996/ui/attachment-uploader';
import {
  ComposerContextStrip,
  ComposerContextStripRow,
} from '@no996/ui/composer-context-strip';

/** 设置页组件库：Composer 输入区上下文长条（PPT / 页面分享 / 附件）。 */
export function ComposerContextStripStandardsDemo() {
  const [showPpt, setShowPpt] = useState(true);
  const [showContext, setShowContext] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentUploaderItem[]>(() => [
    {
      id: 'demo-image',
      name: 'cover.png',
      size: 102400,
      mimeType: 'image/png',
      kind: 'image',
      previewUrl:
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150"><rect width="100%" height="100%" fill="%23c4c8d4"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-size="11">IMG</text></svg>',
      status: 'ready',
    },
    {
      id: 'demo-file',
      name: '产品说明.pdf',
      size: 245760,
      mimeType: 'application/pdf',
      kind: 'doc',
      status: 'ready',
    },
    {
      id: 'demo-xlsx',
      name: '工程费用明细表格.xlsx',
      size: 98304,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      kind: 'doc',
      status: 'ready',
    },
    {
      id: 'demo-docx',
      name: 'brief.docx',
      size: 131072,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      kind: 'doc',
      status: 'uploading',
      progress: 0.42,
    },
  ]);

  const hasStrip = showPpt || showContext || attachments.length > 0;

  const uploaderItems = useMemo(() => attachments, [attachments]);

  return (
    <div className="assets-component-card__stack">
      <div className="assets-component-card__row">
        <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowPpt((value) => !value)}>
          {showPpt ? '隐藏' : '显示'} PPT 模板行
        </button>
        <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowContext((value) => !value)}>
          {showContext ? '隐藏' : '显示'} 页面分享行
        </button>
      </div>
      {hasStrip ? (
        <div className="assets-composer-context-demo">
          {showPpt || showContext ? (
            <ComposerContextStrip>
              {showPpt ? (
                <ComposerContextStripRow
                  kind="ppt-template"
                  icon={<PresentationIcon className="size-3.5" />}
                  label="模板：深蓝决策"
                  mention="深蓝决策"
                  onClick={() => {}}
                  onDismiss={() => setShowPpt(false)}
                  dismissLabel="清除模板"
                />
              ) : null}
              {showContext ? (
                <ComposerContextStripRow
                  kind="page-share"
                  icon={<AppWindowIcon className="size-3.5" />}
                  label="正在分享「设置」标签页"
                  mention="设置"
                  onDismiss={() => setShowContext(false)}
                  dismissLabel="停止分享"
                />
              ) : null}
            </ComposerContextStrip>
          ) : null}
          {attachments.length > 0 ? (
            <AttachmentUploader
              layout="composer"
              items={uploaderItems}
              onAdd={() => {}}
              onRemove={(id) => {
                setAttachments((prev) => {
                  const target = prev.find((item) => item.id === id);
                  if (target && 'file' in target && target.file) {
                    releaseAttachmentDrafts([target as ReturnType<typeof createAttachmentDrafts>[number]]);
                  }
                  return prev.filter((item) => item.id !== id);
                });
              }}
              showAddTile={false}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">上方开关可恢复各行；上传中在附件大卡上转圈（与对话输入框一致）。</p>
      )}
    </div>
  );
}
