import { useTranslation } from 'react-i18next';
import { PasswordResetForm } from './PasswordResetForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@no996/ui/dialog';

export function ForgotPasswordPanel({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation('login');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 sm:max-w-md">
        <DialogTitle>{t('forgotPasswordTitle')}</DialogTitle>
        <DialogDescription>{t('forgotPasswordDesc')}</DialogDescription>
        <PasswordResetForm
          compact
          onSuccess={() => {
            onSuccess?.();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
