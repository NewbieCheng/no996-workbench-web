import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@no996/ui/button';
import { ActionDialog, ActionDialogFooter } from '@no996/ui/action-dialog';
import { Spinner } from '@no996/ui/spinner';

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel,
  cancelLabel,
  loading,
  widthClass = 'sm:max-w-lg',
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  widthClass?: string;
  bodyClassName?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      widthClass={widthClass}
      bodyClassName={bodyClassName}
      footer={
        <ActionDialogFooter className="sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t('cancel')}
          </Button>
          {onSubmit && (
            <Button type="button" onClick={onSubmit} disabled={loading}>
              {loading && <Spinner data-icon="inline-start" />}
              {submitLabel ?? t('save')}
            </Button>
          )}
        </ActionDialogFooter>
      }
    >
      {children}
    </ActionDialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel,
  cancelLabel,
  loading,
  destructive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}) {
  const { t } = useTranslation('common');
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      widthClass="sm:max-w-md"
      footer={
        <ActionDialogFooter className="sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner data-icon="inline-start" />}
            {confirmLabel ?? t('confirm')}
          </Button>
        </ActionDialogFooter>
      }
    >
      {undefined}
    </ActionDialog>
  );
}
