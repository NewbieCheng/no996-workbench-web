import { useTranslation } from 'react-i18next';
import { MarkdownBody } from '@no996/ui/markdown';
import { FloatingInput, FloatingTextarea, FormField } from '@no996/ui/module-form';
import type { StructuredDocumentItem, StructuredDocumentItemChangeHandler } from './types';
import { hasArrowChain, splitArrowChain } from './utils';

interface ItemFieldsProps {
  sectionId: string;
  item: StructuredDocumentItem;
  mode: 'read' | 'edit';
  onItemChange?: StructuredDocumentItemChangeHandler;
  showArrowChain?: boolean;
  heroQuote?: boolean;
  pillList?: boolean;
  hideTitle?: boolean;
}

export function ItemFields({
  sectionId,
  item,
  mode,
  onItemChange,
  showArrowChain = false,
  heroQuote = false,
  pillList = false,
  hideTitle = false,
}: ItemFieldsProps) {
  const { t } = useTranslation('workbench');

  if (mode === 'edit') {
    return (
      <>
        <FormField labelMode="floating">
          <FloatingInput
            label={t('productInsightTitlePlaceholder', '洞察标题')}
            value={item.title}
            onChange={(e) => onItemChange?.(sectionId, item.id, 'title', e.target.value)}
          />
        </FormField>
        <FormField labelMode="floating">
          <FloatingTextarea
            label={t('productInsightContentPlaceholder', '洞察正文')}
            rows={4}
            value={item.content}
            onChange={(e) => onItemChange?.(sectionId, item.id, 'content', e.target.value)}
          />
        </FormField>
      </>
    );
  }

  if (heroQuote) {
    return (
      <blockquote className="sd-hero-quote">
        {item.title ? <p className="sd-hero-quote__title">{item.title}</p> : null}
        <MarkdownBody value={item.content} className="sd-hero-quote__body" />
      </blockquote>
    );
  }

  const chain = showArrowChain && hasArrowChain(item.content) ? splitArrowChain(item.content) : null;

  if (pillList && !chain) {
    const lines = item.content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-*]\s*/, ''));
    return (
      <>
        {!hideTitle && item.title ? <h4 className="sd-item__title">{item.title}</h4> : null}
        {lines.length > 0 ? (
          <ul className="sd-pill-list" aria-label={item.title || undefined}>
            {lines.map((line, idx) => (
              <li key={idx} className="sd-pill-list__item">{line}</li>
            ))}
          </ul>
        ) : (
          <MarkdownBody value={item.content} className="sd-item__content" />
        )}
      </>
    );
  }

  return (
    <>
      {!hideTitle && item.title ? <h4 className="sd-item__title">{item.title}</h4> : null}
      {chain ? (
        <ol className="sd-chain" aria-label={item.title || undefined}>
          {chain.map((step, idx) => (
            <li key={idx} className="sd-chain__step">
              <span className="sd-chain__text">{step}</span>
              {idx < chain.length - 1 ? <span className="sd-chain__arrow" aria-hidden>→</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <MarkdownBody value={item.content} className="sd-item__content" />
      )}
    </>
  );
}
