import '@/i18n'
import { migrateContentWidthPreferences } from './lib/content-width-policy'
import './features/agent-flows'

migrateContentWidthPreferences()
import './fonts/alibaba-puhuiti.css'
import './fonts/home-noto.css'
import './index.css'
import './features/social-publish/social-publish.css'
import './styles/social-studio.css'
import './styles/social-studio-editor.css'
import './styles/extension-materials.css'
import './features/social-studio/creative/social-studio-creative.css'
import './features/social-studio/preview/preview-studio.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
