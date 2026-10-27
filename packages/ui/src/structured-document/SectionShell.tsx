import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SectionLayoutProps } from './types';

interface SectionShellProps extends SectionLayoutProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function SectionShell({
  section,
  sectionIdx,
  showSectionHint,
  children,
  className,
  compact = false,
}: SectionShellProps) {
  const { t } = useTranslation('workbench');

  return (
    <section
      id={`sec_${section.id}`}
      className={[
        'sd-section',
        sectionIdx === 0 ? 'sd-section--first' : '',
        compact ? 'sd-section--compact' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="sd-section__head">
        <h3 className="sd-section__title">{section.title}</h3>
        {section.subtitle ? <p className="sd-section__subtitle">{section.subtitle}</p> : null}
        {showSectionHint ? (
          <span className="sd-section__hint">
            {t('productSectionLockedHint', '章节名称锁定 · 正文可编辑')}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
