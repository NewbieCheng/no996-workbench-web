import type { ReactNode } from 'react';
import { Button } from '@no996/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@no996/ui/tooltip';
import { cn } from '@no996/ui/utils';

export type IconActionVariant = 'default' | 'danger' | 'primary';

const variantMap: Record<IconActionVariant, 'ghost' | 'destructive' | 'default'> = {
  default: 'ghost',
  danger: 'destructive',
  primary: 'default',
};

export function IconActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  variant?: IconActionVariant;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={variantMap[variant]}
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className={cn(variant === 'default' && 'text-muted-foreground')}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
