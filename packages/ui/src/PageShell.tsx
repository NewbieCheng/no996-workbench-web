import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@no996/ui/card';
import { cn } from '@no996/ui/utils';

export type PageShellHeaderProps = {
  title: string;
  /** `page` = 大号页标题 h2；`inline` = 顶栏工具条内普通字号（非 h2）。 */
  titleTone?: 'page' | 'inline';
  /** 页头最左侧（如侧栏收起钮），在标题之前。 */
  headerLeading?: ReactNode;
  /** Renders inline to the right of the page title (e.g. status badge). */
  titleExtra?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  /** 页头最右侧（在 actions 之后），如另一侧栏收起钮。 */
  headerTrailing?: ReactNode;
};

/** Page title row; can render inside PageShell or in ModuleLayout top chrome (full width). */
export function PageShellHeader({
  title,
  titleTone = 'page',
  headerLeading,
  titleExtra,
  subtitle,
  actions,
  headerTrailing,
}: PageShellHeaderProps) {
  if (!title && !titleExtra && !subtitle && !actions && !headerLeading && !headerTrailing) {
    return null;
  }

  const hasLead = Boolean(title || titleExtra || subtitle);

  return (
    <header className="page-shell-header flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {headerLeading ? <div className="page-shell-header__leading shrink-0">{headerLeading}</div> : null}
        {hasLead ? (
          <div className="min-w-0">
            {(title || titleExtra) && (
              <div
                className={cn(
                  'flex min-w-0 flex-nowrap items-center gap-3',
                  titleTone === 'inline' && 'wb-tool-chrome-header-row',
                )}
              >
                {title ? (
                  titleTone === 'inline' ? (
                    <span className="wb-tool-chrome-nav-title shrink-0">{title}</span>
                  ) : (
                    <h2 className="shrink-0 text-2xl font-bold tracking-tight text-foreground md:text-[28px] md:leading-tight">
                      {title}
                    </h2>
                  )
                ) : null}
                {titleExtra ? <div className="page-shell-header__extra shrink-0">{titleExtra}</div> : null}
              </div>
            )}
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {actions ? <div className="page-shell-header__actions flex flex-wrap items-center gap-2">{actions}</div> : null}
        {headerTrailing ? <div className="page-shell-header__trailing shrink-0">{headerTrailing}</div> : null}
      </div>
    </header>
  );
}

/**
 * Open page scaffold: bold title block + free-form sections. The old full-page
 * glass card is gone — sections compose their own cards (tables, toolbars, charts).
 */
export function PageShell({
  title,
  titleExtra,
  subtitle,
  actions,
  children,
  noCard,
  suppressHeader,
}: PageShellHeaderProps & {
  children: ReactNode;
  /** Legacy escape hatch: render children without the wrapping section card */
  noCard?: boolean;
  /** Header rendered elsewhere (e.g. ModuleLayout top chrome). */
  suppressHeader?: boolean;
}) {
  const body = noCard ? (
    children
  ) : (
    <Card className="border-border/70 bg-card shadow-xs">
      <CardContent className="p-5 md:p-6">{children}</CardContent>
    </Card>
  );

  const showHeader = !suppressHeader && (title || subtitle || actions);

  return (
    <div className="flex w-full animate-slide-in-up flex-col gap-4">
      {showHeader ? (
        <PageShellHeader title={title} titleExtra={titleExtra} subtitle={subtitle} actions={actions} />
      ) : null}
      {body}
    </div>
  );
}

export function PageCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('border-border/70 bg-card shadow-xs', className)}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}