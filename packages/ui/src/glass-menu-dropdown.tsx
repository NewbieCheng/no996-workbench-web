'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu';

/** Floating menu root — same as DropdownMenu, named for GlassMenu 浮层菜单规范。 */
export const GlassMenuDropdown = DropdownMenu;
export const GlassMenuDropdownTrigger = DropdownMenuTrigger;
export const GlassMenuDropdownItem = DropdownMenuItem;
export const GlassMenuDropdownSeparator = DropdownMenuSeparator;
export const GlassMenuDropdownShortcut = DropdownMenuShortcut;
export const GlassMenuDropdownGroup = DropdownMenuGroup;
export const GlassMenuDropdownSub = DropdownMenuSub;
export const GlassMenuDropdownSubTrigger = DropdownMenuSubTrigger;
export const GlassMenuDropdownSubContent = DropdownMenuSubContent;

/** Portal 浮层内容：自动套用 glass-menu-surface + 深浅色变量。 */
export function GlassMenuDropdownContent({
  className,
  scrollable = true,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent className={className} scrollable={scrollable} {...props}>
      {children}
    </DropdownMenuContent>
  );
}
