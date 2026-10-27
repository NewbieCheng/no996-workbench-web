import type { ReactNode } from 'react';
import { cn } from '@no996/ui/utils';

export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>{children}</div>
  );
}
