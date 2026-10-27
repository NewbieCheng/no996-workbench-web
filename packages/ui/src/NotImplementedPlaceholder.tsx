import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './GlassCard';

export function NotImplementedPlaceholder({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation('common');
  return (
    <GlassCard className="not-implemented-placeholder py-12 text-center">
      <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{hint ?? t('placeholderDefault')}</p>
      <div className="mx-auto mt-4 max-w-[480px] text-left text-sm text-muted-foreground">
        {children}
      </div>
    </GlassCard>
  );
}