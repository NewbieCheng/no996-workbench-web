import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState } from 'react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@no996/ui/input-group';
import { cn } from '@/lib/utils';

export const GlassPasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function GlassPasswordInput({ className, ...props }, ref) {
    const [show, setShow] = useState(false);

    return (
      <InputGroup className={cn('login-split-field', className)}>
        <InputGroupInput
          ref={ref}
          type={show ? 'text' : 'password'}
          className="login-split-field__control"
          {...props}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-sm"
            aria-label={show ? '隐藏密码' : '显示密码'}
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
);
