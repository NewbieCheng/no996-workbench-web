import '../../i18n'
import '../../fonts/alibaba-puhuiti.css'
import '../../index.css'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/app/ThemeProvider'
import { InkCapsuleToaster } from '@/components/InkCapsuleToaster'
import SocialStudioPrototypePage from './SocialStudioPrototypePage'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <BrowserRouter>
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
        <SocialStudioPrototypePage />
      </main>
      <InkCapsuleToaster />
    </BrowserRouter>
  </ThemeProvider>,
)
