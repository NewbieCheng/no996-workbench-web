import i18n from 'i18next';
import type { Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANG_STORAGE_KEY = 'no996_wb_lang';
export const SUPPORTED_LANGS = ['zh-CN', 'en-US'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGS)[number];

function readStoredLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored) return normalizeAppLanguage(stored);
  } catch {
    /* ignore */
  }
  return 'zh-CN';
}

function syncDocumentLanguage(lng: AppLanguage) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng.startsWith('zh') ? 'zh-CN' : 'en';
}

const localeModules = import.meta.glob('./locales/*/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Resource[string]>;

function buildResources(): Resource {
  const resources: Resource = {};
  for (const [modPath, mod] of Object.entries(localeModules)) {
    const match = modPath.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
    if (!match) continue;
    const [, lang, ns] = match;
    if (!resources[lang]) resources[lang] = {};
    resources[lang][ns] = mod;
  }
  return resources;
}

export function normalizeAppLanguage(lng: string | undefined): AppLanguage {
  if (!lng) return 'zh-CN';
  if (lng === 'en' || lng.startsWith('en-')) return 'en-US';
  if (lng === 'zh' || lng.startsWith('zh')) return 'zh-CN';
  if ((SUPPORTED_LANGS as readonly string[]).includes(lng)) {
    return lng as AppLanguage;
  }
  return 'zh-CN';
}

const initialLanguage = readStoredLanguage();
syncDocumentLanguage(initialLanguage);

void i18n
  .use(initReactI18next)
  .init({
    resources: buildResources(),
    lng: initialLanguage,
    fallbackLng: 'zh-CN',
    supportedLngs: [...SUPPORTED_LANGS],
    defaultNS: 'login',
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  const normalized = normalizeAppLanguage(lng);
  syncDocumentLanguage(normalized);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
});

export default i18n;
