import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Check, Copy, SendHorizontal } from 'lucide-react';
import { WeChatIcon } from './WeChatIcon';
import { z } from 'zod';
import { GlassInput } from './GlassInput';
import { Button } from '@no996/ui/button';
import { LoginSplitOutlineButton, LoginSplitPrimaryButton } from './LoginSplitButtons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@no996/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@no996/ui/field';
import { Textarea } from '@no996/ui/textarea';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';

const WECHAT_ID = 'sihai332211';

type EnterpriseFormValues = {
  company_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  job_title: string;
  remark: string;
};

export function EnterpriseRegisterPanel({ className }: { className?: string }) {
  const { t } = useTranslation('login');
  const [wechatDialogOpen, setWechatDialogOpen] = useState(false);
  const [validatedValues, setValidatedValues] = useState<EnterpriseFormValues | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        company_name: z.string().trim().min(1, t('registerEnterpriseCompanyRequired')),
        contact_name: z.string().trim().min(1, t('registerEnterpriseContactNameRequired')),
        contact_phone: z.string().trim().min(1, t('registerEnterprisePhoneRequired')),
        contact_email: z.string().trim().min(1, t('registerEnterpriseEmailRequired')),
        job_title: z.string(),
        remark: z.string(),
      }),
    [t],
  );

  const form = useForm<EnterpriseFormValues>({
    defaultValues: {
      company_name: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      job_title: '',
      remark: '',
    },
  });

  const buildCopyText = (values: EnterpriseFormValues) => {
    const optional = (label: string, value: string) =>
      `${label}：${value.trim() || t('registerEnterpriseCopyNone')}`;

    return [
      t('registerEnterpriseCopyTitle'),
      `${t('registerEnterpriseCopyCompany')}：${values.company_name.trim()}`,
      `${t('registerEnterpriseCopyContact')}：${values.contact_name.trim()}`,
      `${t('registerEnterpriseCopyPhone')}：${values.contact_phone.trim()}`,
      `${t('registerEnterpriseCopyEmail')}：${values.contact_email.trim()}`,
      optional(t('registerEnterpriseCopyJobTitle'), values.job_title),
      optional(t('registerEnterpriseCopyRemark'), values.remark),
    ].join('\n');
  };

  const validateForm = (): EnterpriseFormValues | null => {
    form.clearErrors();
    const parsed = schema.safeParse(form.getValues());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          form.setError(field as keyof EnterpriseFormValues, { message: issue.message });
        }
      }
      return null;
    }
    return parsed.data;
  };

  const copyText = async (
    text: string,
    successKey: 'registerEnterpriseCopySuccess' | 'registerEnterpriseWechatCopySuccess',
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess(t(successKey));
    } catch {
      toastError(t('registerEnterpriseCopyFailed'));
    }
  };

  const onApply = () => {
    const values = validateForm();
    if (!values) return;
    setValidatedValues(values);
    setWechatDialogOpen(true);
  };

  const onCopyInfo = () => {
    const values = validateForm();
    if (!values) return;
    void copyText(buildCopyText(values), 'registerEnterpriseCopySuccess');
  };

  const onCopyWechat = () => copyText(WECHAT_ID, 'registerEnterpriseWechatCopySuccess');

  const onCopyInfoInDialog = () => {
    if (!validatedValues) return;
    void copyText(buildCopyText(validatedValues), 'registerEnterpriseCopySuccess');
  };

  const dialogSteps = [
    t('registerEnterpriseDialogStep1'),
    t('registerEnterpriseDialogStep2'),
    t('registerEnterpriseDialogStep3'),
  ];

  return (
    <>
      <div className={cn('login-enterprise-register', className)}>
        <p className="login-enterprise-register__intro">{t('registerEnterpriseIntro')}</p>

        <FieldGroup className="login-enterprise-register__fields">
          <Field data-invalid={!!form.formState.errors.company_name}>
            <FieldLabel htmlFor="enterprise-company" required>
              {t('registerEnterpriseCompanyLabel')}
            </FieldLabel>
            <GlassInput
              id="enterprise-company"
              placeholder={t('registerEnterpriseCompanyPlaceholder')}
              aria-invalid={!!form.formState.errors.company_name}
              {...form.register('company_name')}
            />
            <FieldError>{form.formState.errors.company_name?.message}</FieldError>
          </Field>

          <Field data-invalid={!!form.formState.errors.contact_name}>
            <FieldLabel htmlFor="enterprise-contact-name" required>
              {t('registerEnterpriseContactNameLabel')}
            </FieldLabel>
            <GlassInput
              id="enterprise-contact-name"
              placeholder={t('registerEnterpriseContactNamePlaceholder')}
              aria-invalid={!!form.formState.errors.contact_name}
              {...form.register('contact_name')}
            />
            <FieldError>{form.formState.errors.contact_name?.message}</FieldError>
          </Field>

          <div className="login-enterprise-register__row">
            <Field data-invalid={!!form.formState.errors.contact_phone}>
              <FieldLabel htmlFor="enterprise-phone" required>
                {t('registerEnterprisePhoneLabel')}
              </FieldLabel>
              <GlassInput
                id="enterprise-phone"
                placeholder={t('registerEnterprisePhonePlaceholder')}
                aria-invalid={!!form.formState.errors.contact_phone}
                {...form.register('contact_phone')}
              />
              <FieldError>{form.formState.errors.contact_phone?.message}</FieldError>
            </Field>

            <Field data-invalid={!!form.formState.errors.contact_email}>
              <FieldLabel htmlFor="enterprise-email" required>
                {t('registerEnterpriseEmailLabel')}
              </FieldLabel>
              <GlassInput
                id="enterprise-email"
                type="email"
                placeholder={t('registerEnterpriseEmailPlaceholder')}
                aria-invalid={!!form.formState.errors.contact_email}
                {...form.register('contact_email')}
              />
              <FieldError>{form.formState.errors.contact_email?.message}</FieldError>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="enterprise-job-title">{t('registerEnterpriseJobTitleLabel')}</FieldLabel>
            <GlassInput
              id="enterprise-job-title"
              placeholder={t('registerEnterpriseJobTitlePlaceholder')}
              {...form.register('job_title')}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="enterprise-remark">{t('registerEnterpriseRemarkLabel')}</FieldLabel>
            <Textarea
              id="enterprise-remark"
              className="login-split-field min-h-20 text-sm shadow-none focus-visible:ring-0"
              placeholder={t('registerEnterpriseRemarkPlaceholder')}
              {...form.register('remark')}
            />
          </Field>
        </FieldGroup>

        <div className="login-enterprise-register__actions">
          <LoginSplitPrimaryButton
            type="button"
            className="login-enterprise-register__apply"
            onClick={onApply}
          >
            <SendHorizontal className="size-4" />
            {t('registerEnterpriseApplyButton')}
          </LoginSplitPrimaryButton>
          <LoginSplitOutlineButton
            type="button"
            className="login-enterprise-register__copy-info"
            onClick={onCopyInfo}
          >
            <Copy className="size-4" />
            {t('registerEnterpriseCopyInfoButton')}
          </LoginSplitOutlineButton>
        </div>
      </div>

      <Dialog open={wechatDialogOpen} onOpenChange={setWechatDialogOpen}>
        <DialogContent
          className="login-enterprise-wechat-dialog gap-0 overflow-hidden p-0 sm:max-w-[420px]"
          showCloseButton
        >
          <div className="login-enterprise-wechat-dialog__hero" aria-hidden="true">
            <div className="login-enterprise-wechat-dialog__hero-glow" />
            <div className="login-enterprise-wechat-dialog__hero-icon">
              <WeChatIcon className="size-16" />
            </div>
          </div>

          <div className="login-enterprise-wechat-dialog__body">
            <DialogTitle className="login-enterprise-wechat-dialog__title">
              {t('registerEnterpriseDialogTitle')}
            </DialogTitle>
            <DialogDescription className="login-enterprise-wechat-dialog__desc">
              {t('registerEnterpriseDialogDesc')}
            </DialogDescription>

            <ol className="login-enterprise-wechat-dialog__steps">
              {dialogSteps.map((step, index) => (
                <li key={step} className="login-enterprise-wechat-dialog__step">
                  <span className="login-enterprise-wechat-dialog__step-index">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="login-enterprise-wechat-dialog__wechat-card">
              <span className="login-enterprise-wechat-dialog__wechat-label">
                {t('registerEnterpriseDialogWechatLabel')}
              </span>
              <span className="login-enterprise-wechat-dialog__wechat-id">{WECHAT_ID}</span>
              <Button
                type="button"
                size="sm"
                className="login-enterprise-wechat-dialog__wechat-copy"
                onClick={onCopyWechat}
              >
                {t('registerEnterpriseWechatCopy')}
              </Button>
            </div>

            <div className="login-enterprise-wechat-dialog__footer">
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 rounded-xl"
                onClick={onCopyInfoInDialog}
              >
                <Copy className="size-4" />
                {t('registerEnterpriseCopyInfoButton')}
              </Button>
              <Button
                type="button"
                className="h-10 flex-1 rounded-xl"
                onClick={() => setWechatDialogOpen(false)}
              >
                <Check className="size-4" />
                {t('registerEnterpriseDialogDone')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
