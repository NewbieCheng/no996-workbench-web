import * as React from 'react';
import { cn } from '@no996/ui/utils';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  as?: React.ElementType;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    {
      glow = true,
      as: Component = 'div',
      className,
      children,
      onPointerMove,
      onPointerLeave,
      ...props
    },
    forwardedRef,
  ) {
    const internalRef = React.useRef<HTMLDivElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        internalRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef],
    );

    const handlePointerMove = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (glow && internalRef.current) {
          const rect = internalRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const mx = ((e.clientX - rect.left) / rect.width) * 100;
            const my = ((e.clientY - rect.top) / rect.height) * 100;
            internalRef.current.style.setProperty('--mx', `${mx.toFixed(2)}%`);
            internalRef.current.style.setProperty('--my', `${my.toFixed(2)}%`);
          }
        }
        onPointerMove?.(e);
      },
      [glow, onPointerMove],
    );

    const handlePointerLeave = React.useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (glow && internalRef.current) {
          internalRef.current.style.removeProperty('--mx');
          internalRef.current.style.removeProperty('--my');
        }
        onPointerLeave?.(e);
      },
      [glow, onPointerLeave],
    );

    return (
      <Component
        ref={setRefs}
        className={cn('glass-panel', className)}
        data-glow={glow ? undefined : 'false'}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

GlassPanel.displayName = 'GlassPanel';
