import * as React from 'react';
import { cn } from '@no996/ui/utils';

export interface GlassBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  dot?: boolean;
}

export const GlassBadge = React.forwardRef<HTMLSpanElement, GlassBadgeProps>(
  function GlassBadge({ dot = true, className, children, ...props }, ref) {
    return (
      <span ref={ref} className={cn('glass-badge', className)} {...props}>
        {dot ? <span className="dot" aria-hidden="true" /> : null}
        {children}
      </span>
    );
  },
);

GlassBadge.displayName = 'GlassBadge';
