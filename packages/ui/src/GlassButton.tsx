import * as React from 'react';
import { cn } from '@no996/ui/utils';
import { Spinner } from './spinner';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'primary';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  loading?: boolean;
  wrapClassName?: string;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    {
      variant = 'default',
      size = 'default',
      loading = false,
      disabled,
      className,
      wrapClassName,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) {
    const sizeMap: Record<NonNullable<GlassButtonProps['size']>, string> = {
      sm: 'gb-sm',
      default: 'gb-default',
      lg: 'gb-lg',
      icon: 'gb-icon',
    };

    const variantClass = variant !== 'default' ? `gb-v-${variant}` : '';

    return (
      <div className={cn('glass-button-wrap', sizeMap[size], variantClass, wrapClassName)}>
        <button
          ref={ref}
          type={type}
          disabled={disabled || loading}
          className={cn('glass-button', className)}
          aria-busy={loading || undefined}
          {...props}
        >
          <span className="glass-button-text">
            {loading ? <Spinner className="size-3.5 animate-spin" /> : null}
            {children}
          </span>
        </button>
        <div className="glass-button-shadow" aria-hidden="true" />
      </div>
    );
  },
);

GlassButton.displayName = 'GlassButton';
