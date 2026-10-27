import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@no996/ui/utils';

const MARKDOWN_BODY_CLASS =
  'product-markdown-body prose prose-sm dark:prose-invert max-w-none text-foreground [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-foreground';

/** 只读 Markdown 正文（无 rehypeRaw，HTML 转义）。 */
export function MarkdownBody({ value, className }: { value: string; className?: string }) {
  if (!value || !value.trim()) return null;
  return (
    <div className={cn(MARKDOWN_BODY_CLASS, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );
}
