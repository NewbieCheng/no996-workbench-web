import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../../../i18n'
import zh from './locales/zh-CN.json'
import en from './locales/en-US.json'
import { TalkTemplateError } from './model'

export type TemplateCopyKey = keyof typeof zh
export const TALK_TEMPLATE_NAMESPACE = 'ipTalkTemplates'
i18n.addResourceBundle('zh-CN', TALK_TEMPLATE_NAMESPACE, zh, true, false)
i18n.addResourceBundle('en-US', TALK_TEMPLATE_NAMESPACE, en, true, false)
export function useTemplateCopy() {
  const { t } = useTranslation(TALK_TEMPLATE_NAMESPACE)
  const copy = useCallback((key: TemplateCopyKey): string => t(key, { defaultValue: zh[key] }), [t])
  const error = useCallback((failure: unknown): string => {
    const key = failure instanceof TalkTemplateError ? failure.code : 'operationFailed'
    return copy(Object.hasOwn(zh, key) ? key as TemplateCopyKey : 'operationFailed')
  }, [copy])
  const builtinName = useCallback((id: string): string => {
    const key = `preset_${id}`
    return Object.hasOwn(zh, key) ? copy(key as TemplateCopyKey) : copy('customStyle')
  }, [copy])
  return { copy, error, builtinName }
}
