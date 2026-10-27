import i18n from '../../../i18n'
import { useTranslation } from 'react-i18next'
import zh from './v2-locales/zh-CN.json'
import en from './v2-locales/en-US.json'

i18n.addResourceBundle('zh-CN', 'ipTalkV2', zh, true, false)
i18n.addResourceBundle('en-US', 'ipTalkV2', en, true, false)
export const useTalkV2Copy = () => useTranslation('ipTalkV2')
