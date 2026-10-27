import i18n from '../../../i18n'
import { useTranslation } from 'react-i18next'
import zh from './locales/zh-CN.json'
import en from './locales/en-US.json'
i18n.addResourceBundle('zh-CN', 'ipComposition', zh, true, false)
i18n.addResourceBundle('en-US', 'ipComposition', en, true, false)
export function useCompositionCopy() {
  const { t } = useTranslation('ipComposition')
  const copy = (key: keyof typeof zh) => t(key, { defaultValue: zh[key] })
  const error = (value: unknown) => { const message = value instanceof Error ? value.message : String(value); return message in zh ? copy(message as keyof typeof zh) : message }
  return { t, copy, error }
}
