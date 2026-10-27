import type { ReactNode } from 'react';
import { cn } from '@no996/ui/utils';

export function TableActionGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-1', className)}>{children}</div>;
}
