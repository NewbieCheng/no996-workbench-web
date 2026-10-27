import type { ReactNode } from 'react';
import { cn } from '@no996/ui/utils';
import { GlassPanel } from './GlassPanel';

/**
 * Universal Liquid Glass Card: 1px gradient edge, backdrop blur, inner specular highlights.
 */
export function GlassCard({
  children,
  className = '',
  padding = true,
  glow = true,
  ...props
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  glow?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <GlassPanel
      glow={glow}
      className={cn(
        'rounded-2xl transition-all duration-300',
        padding && 'p-5 md:p-6',
        className,
      )}
      {...props}
    >
      {children}
    </GlassPanel>
  );
}
