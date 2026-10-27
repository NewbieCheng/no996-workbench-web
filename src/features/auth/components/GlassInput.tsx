import { forwardRef } from 'react';
import { Input } from '@no996/ui/input';
import { cn } from '@/lib/utils';

export const GlassInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function GlassInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        className={cn('login-split-field', className)}
        {...props}
      />
    );
  },
);
