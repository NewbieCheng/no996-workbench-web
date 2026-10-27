import { Toaster } from 'sonner'
import { useTheme } from '@/app/ThemeProvider'
import { InkToastRing } from './InkToastRing'
import { INK_TOAST_DURATIONS } from '@/lib/toast-durations'

function InkToastCloseIcon() {
  return (
    <svg className="ink-toast__close-glyph" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** 全局墨囊 Toast（Sonner + 设计规范样式） */
export function InkCapsuleToaster() {
  const { dark } = useTheme()

  return (
    <Toaster
      theme={dark ? 'dark' : 'light'}
      position="top-center"
      richColors={false}
      expand
      closeButton
      visibleToasts={3}
      gap={10}
      duration={INK_TOAST_DURATIONS.info}
      className="ink-toast-host"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'ink-toast',
          title: 'ink-toast__title',
          description: 'ink-toast__description',
          content: 'ink-toast__content',
          icon: 'ink-toast__icon-slot',
          actionButton: 'ink-toast__action',
          cancelButton: 'ink-toast__cancel',
          closeButton: 'ink-toast__close',
        },
      }}
      icons={{
        success: <InkToastRing glyph="ok" />,
        error: <InkToastRing glyph="err" />,
        warning: <InkToastRing glyph="warn" />,
        info: <InkToastRing glyph="info" />,
        loading: <InkToastRing glyph="loading" />,
        close: <InkToastCloseIcon />,
      }}
    />
  )
}
