import { forwardRef } from 'react';
import { cn } from '@no996/ui/utils';
import { groupStructuredDocumentSections } from './group-sections';
import { renderStructuredDocumentSection } from './layouts';
import type { StructuredDocumentProps } from './types';
import './structured-document.css';

export const StructuredDocument = forwardRef<HTMLElement, StructuredDocumentProps>(
  function StructuredDocument(
    { sections, mode, onItemChange, exportRoot = 'structured-document', className, showSectionHint = false },
    ref,
  ) {
    const blocks = groupStructuredDocumentSections(sections);
    if (blocks.length === 0) return null;

    return (
      <div className="sd-doc-wrap">
        <article
          ref={ref}
          className={cn('sd-doc', className)}
          data-export-root={exportRoot}
        >
          {blocks.map((block) => {
            if (block.type === 'section') {
              return renderStructuredDocumentSection({
                section: block.section,
                sectionIdx: block.sectionIdx,
                mode,
                onItemChange,
                showSectionHint,
              });
            }

            return (
              <div key={block.rowGroup} className="sd-row-group" data-row-group={block.rowGroup}>
                {block.sections.map(({ section, sectionIdx }) =>
                  renderStructuredDocumentSection({
                    section,
                    sectionIdx,
                    mode,
                    onItemChange,
                    showSectionHint,
                  }),
                )}
              </div>
            );
          })}
        </article>
      </div>
    );
  },
);
