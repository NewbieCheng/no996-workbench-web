import * as React from 'react';
import type { ClassValue } from 'clsx';
import { cn } from '@no996/ui/utils';
import {
  glassMenuClass,
  glassMenuItemClass,
  glassMenuSurfaceClass,
} from './glass-menu-classes';

export { glassMenuClass, glassMenuItemClass, glassMenuSurfaceClass };

export function glassMenuSurface(...inputs: ClassValue[]) {
  return cn(glassMenuSurfaceClass, ...inputs);
}

/** Static glass menu container (reference: `.glass-menu`). */
export function GlassMenu({
  className,
  scrollable = true,
  children,
  ...props
}: React.ComponentProps<'div'> & { scrollable?: boolean }) {
  if (!scrollable) {
    return (
      <div
        data-slot="glass-menu"
        className={cn(glassMenuSurfaceClass, glassMenuClass, className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      data-slot="glass-menu"
      className={cn(glassMenuSurfaceClass, 'glass-menu-surface--scroll-shell', className)}
      {...props}
    >
      <div className={cn(glassMenuClass, 'glass-menu-surface--scrollable')}>{children}</div>
    </div>
  );
}

/** Menu row (reference: `.menu-item`). */
export function GlassMenuItem({
  className,
  icon,
  children,
  ...props
}: React.ComponentProps<'button'> & { icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(glassMenuItemClass, 'w-full text-left', className)}
      {...props}
    >
      {icon ? <span className="glass-menu-item__icon">{icon}</span> : null}
      <span className="glass-menu-item__text">{children}</span>
    </button>
  );
}

export function GlassMenuSeparator({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      role="separator"
      data-slot="glass-menu-separator"
      className={cn('glass-menu-separator', className)}
      {...props}
    />
  );
}

/** Pinned footer region below scrollable menu body (hairline uses --glass-menu-separator). */
export function GlassMenuFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-menu-footer"
      className={cn('glass-menu-footer', className)}
      {...props}
    />
  );
}

export function GlassMenuGroupLabel({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      role="presentation"
      data-slot="glass-menu-group-label"
      className={cn('glass-menu-group-label', className)}
      {...props}
    />
  );
}

export {
  GlassMenuDropdown,
  GlassMenuDropdownContent,
  GlassMenuDropdownGroup,
  GlassMenuDropdownItem,
  GlassMenuDropdownSeparator,
  GlassMenuDropdownShortcut,
  GlassMenuDropdownSub,
  GlassMenuDropdownSubContent,
  GlassMenuDropdownSubTrigger,
  GlassMenuDropdownTrigger,
} from './glass-menu-dropdown';
