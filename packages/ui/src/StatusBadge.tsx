import { Badge } from '@no996/ui/badge';
import { cn } from '@no996/ui/utils';

export type StatusBadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'info';

const toneClass: Record<StatusBadgeTone, string> = {
  success:
    'border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-300',
  warning:
    'border-amber-500/25 bg-amber-500/12 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200',
  error:
    'border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/20',
  neutral: 'border-border bg-muted/60 text-muted-foreground',
  info: 'border-sky-500/25 bg-sky-500/12 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-300',
};

const toneDotClass: Record<StatusBadgeTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-destructive',
  neutral: 'bg-muted-foreground',
  info: 'bg-sky-500',
};

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusBadgeTone }) {
  return (
    <Badge variant="outline" className={cn('gap-1.5 border', toneClass[tone])}>
      <span className={cn('size-1.5 rounded-full', toneDotClass[tone])} aria-hidden />
      {label}
    </Badge>
  );
}

export function statusFromCode(status: number): { label: string; tone: StatusBadgeTone } {
  switch (status) {
    case 1:
      return { label: '正常', tone: 'success' };
    case 2:
      return { label: '已冻结', tone: 'warning' };
    case 3:
      return { label: '已停用', tone: 'error' };
    default:
      return { label: String(status), tone: 'neutral' };
  }
}

export function enabledStatus(enabled: boolean): { label: string; tone: StatusBadgeTone } {
  return enabled
    ? { label: '已启用', tone: 'success' }
    : { label: '已停用', tone: 'neutral' };
}

export function tenantStatus(status: number): { label: string; tone: StatusBadgeTone } {
  return status === 1
    ? { label: '正常', tone: 'success' }
    : { label: '已停用', tone: 'error' };
}

export function roleFromCode(role: number): { label: string; tone: StatusBadgeTone } {
  switch (role) {
    case 3:
      return { label: '平台运营', tone: 'info' };
    case 2:
      return { label: '租户管理员', tone: 'info' };
    case 1:
      return { label: '成员', tone: 'neutral' };
    default:
      return { label: String(role), tone: 'neutral' };
  }
}
