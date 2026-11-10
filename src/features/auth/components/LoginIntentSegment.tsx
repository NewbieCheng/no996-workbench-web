import { useTranslation } from 'react-i18next';

import { AuthIntentCards, type AuthIntent } from './AuthIntentCards';

/**
 * 登录/注册表单上的身份意图：个人账号 vs 企业（管理员）账号。
 *
 * 这不是空间类型 —— 空间类型是登录之后从 `/me/spaces` 拿到的 `kind`
 * （`personal|team|platform`）。两者刻意不共用类型：企业管理员登录后
 * 落在哪个空间由服务端决定，跟他在表单上点了哪个 tab 无关。
 */
export type LoginIntent = 'platform' | 'enterprise' | 'personal';

export function LoginIntentSegment({
  value,
  onChange,
}: {
  value: LoginIntent;
  onChange: (intent: LoginIntent) => void;
}) {
  const { t } = useTranslation('login');
  const safeValue: AuthIntent =
    value === 'enterprise' || value === 'personal' ? value : 'personal';

  return (
    <AuthIntentCards
      value={safeValue}
      onChange={(next) => onChange(next)}
      ariaLabel={t('intentAria')}
      labelPrefix="intent"
    />
  );
}

export function intentToApiMode(intent: LoginIntent): number {
  return intent === 'enterprise' ? 2 : 1;
}

export function intentMismatchMessageKey(intent: LoginIntent): string {
  return `mismatch.${intent}`;
}
