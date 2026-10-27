import { Globe2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  LANG_STORAGE_KEY,
  normalizeAppLanguage,
  type AppLanguage,
} from '@/i18n'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'

const UI_LANGS: { id: AppLanguage; labelKey: 'langZh' | 'langEn' }[] = [
  { id: 'zh-CN', labelKey: 'langZh' },
  { id: 'en-US', labelKey: 'langEn' },
]

export function LanguageMenu({ className }: { className?: string }) {
  const { t, i18n } = useTranslation('common')
  const active = normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language)
  const items = UI_LANGS.map((item) => ({ value: item.id, label: t(item.labelKey) }))

  const selectLanguage = (value: unknown) => {
    if (value !== 'zh-CN' && value !== 'en-US') return
    const lng = value as AppLanguage
    if (lng === active) return
    void i18n.changeLanguage(lng)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lng)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lng.startsWith('zh') ? 'zh-CN' : 'en'
  }

  return (
    <Select items={items} value={active} onValueChange={selectLanguage}>
      <SelectTrigger
        size="sm"
        className={cn('lang-select', className)}
        aria-label={t('switchLanguage')}
      >
        <Globe2 size={15} aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
