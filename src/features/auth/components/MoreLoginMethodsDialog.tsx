import { Landmark, Lock, Mail, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@no996/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@no996/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@no996/ui/tooltip';

export function MoreLoginMethodsDialog({
  open,
  onOpenChange,
  loginMethod,
  onSelectPassword,
  onSelectEmailCode,
  onSelectPlatform,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loginMethod: 'password' | 'emailCode';
  onSelectPassword: () => void;
  onSelectEmailCode: () => void;
  onSelectPlatform: () => void;
}) {
  const { t } = useTranslation('login');

  const pick = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="login-more-methods-dialog sm:max-w-sm">
        <DialogTitle>{t('moreLoginMethods')}</DialogTitle>
        <DialogDescription>{t('moreLoginMethodsDesc')}</DialogDescription>
        <div className="login-more-methods-dialog__list">
          {loginMethod === 'password' ? (
            <Button
              type="button"
              variant="outline"
              className="login-more-methods-dialog__item"
              onClick={() => pick(onSelectEmailCode)}
            >
              <Mail className="login-more-methods-dialog__icon" aria-hidden />
              {t('switchToEmailCode')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="login-more-methods-dialog__item"
              onClick={() => pick(onSelectPassword)}
            >
              <Lock className="login-more-methods-dialog__icon" aria-hidden />
              {t('switchToPassword')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="login-more-methods-dialog__item"
            onClick={() => pick(onSelectPlatform)}
          >
            <Landmark className="login-more-methods-dialog__icon" aria-hidden />
            {t('workspaceLogin.title.platform')}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="login-more-methods-dialog__item-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="login-more-methods-dialog__item"
                    disabled
                    aria-disabled="true"
                  >
                    <Smartphone className="login-more-methods-dialog__icon" aria-hidden />
                    {t('switchToPhoneCode')}
                  </Button>
                </span>
              }
            />
            <TooltipContent>{t('phoneCodeLoginUnavailable')}</TooltipContent>
          </Tooltip>
        </div>
      </DialogContent>
    </Dialog>
  );
}
