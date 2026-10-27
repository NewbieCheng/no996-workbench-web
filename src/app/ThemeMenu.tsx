import { Sun } from 'lucide-react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { useTheme } from './ThemeProvider'
import { runThemeTransition } from '../lib/theme-transition'

export function ThemeMenu() {
  const { t } = useTranslation('workbench')
  const { dark, setMode } = useTheme()

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark'
    runThemeTransition(() => {
      flushSync(() => setMode(next))
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t(dark ? 'themeSwitchToLight' : 'themeSwitchToDark')}
      aria-pressed={dark}
      onClick={toggleTheme}
    >
      <Sun aria-hidden="true" />
    </Button>
  )
}
