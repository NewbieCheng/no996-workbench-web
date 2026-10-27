import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
type ThemeMode = 'system' | 'light' | 'dark'
const ThemeContext = createContext<{ mode: ThemeMode; dark: boolean; setMode: (mode: ThemeMode) => void }>({ mode: 'system', dark: false, setMode: () => {} })
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => { try { const saved = localStorage.getItem('no996-web-theme'); return saved === 'dark' || saved === 'light' ? saved : 'system' } catch { return 'system' } })
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const dark = mode === 'system' ? systemDark : mode === 'dark'
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const change = () => setSystemDark(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change) }, [])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.documentElement.classList.toggle('dark', dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; try { localStorage.setItem('no996-web-theme', mode) } catch { /* The theme remains usable without browser storage. */ } }, [mode, dark])
  return <ThemeContext.Provider value={{ mode, dark, setMode }}>{children}</ThemeContext.Provider>
}
export function useTheme() { return useContext(ThemeContext) }
