import type { ComponentProps } from 'react';

import { Spinner } from '@no996/ui/spinner';
import { cn } from '@/lib/utils';

type BtnProps = ComponentProps<'button'>;

export function LoginSplitPrimaryButton({ className, children, type = 'submit', ...props }: BtnProps) {
  return (
    <button type={type} className={cn('login-split-btn login-split-btn--primary', className)} {...props}>
      {children}
    </button>
  );
}

export function LoginSplitOutlineButton({ className, children, type = 'button', ...props }: BtnProps) {
  return (
    <button type={type} className={cn('login-split-btn login-split-btn--outline', className)} {...props}>
      {children}
    </button>
  );
}

export function LoginSplitTextButton({ className, children, type = 'button', ...props }: BtnProps) {
  return (
    <button type={type} className={cn('login-split-text-btn', className)} {...props}>
      {children}
    </button>
  );
}

export function LoginSplitSpinner({ className }: { className?: string }) {
  return <Spinner data-icon="inline-start" className={className} />;
}
