import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { TooltipProvider } from '@no996/ui/tooltip'
import { Button } from '@no996/ui/button'
import { InkCapsuleToaster } from './components/InkCapsuleToaster'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ThemeProvider } from './app/ThemeProvider'
import { ZoomProvider } from './app/ZoomProvider'
import WorkbenchLayout from './app/WorkbenchLayout'
import { WorkbenchTaskProvider } from './services/workbench-tasks'
import { legacyRoutes } from './app/navigation'
import LoginPage from './features/auth/LoginPage'
import HomePage from './features/home/HomePage'
import PersonaPage from './features/persona/PersonaPage'
import ProductPositionPage from './features/product-position/ProductPositionPage'
import TitlesPage from './features/titles/TitlesPage'
import ScriptLabPage from './features/script-lab/ScriptLabPage'
import XiaohongshuPage from './features/xiaohongshu/XiaohongshuPage'
import WechatArticlePage from './features/wechat-article/WechatArticlePage'
import MomentsPage from './features/moments/MomentsPage'
import VoicePage from './features/voice/VoicePage'
import DigitalHumanPage from './features/digital-human/DigitalHumanPage'
import IPVideoPage from './features/ip-video/IPVideoPage'
import { Suspense, lazy } from 'react'

const VideoFactoryPage = lazy(() => import('./features/video-factory/VideoFactoryPage'))

// 开发专用：镜头渲染自检页。生产构建不会引用到它。
const ShotCheckPage = lazy(() => import('./features/video-factory/dev/ShotCheckPage'))
import ExtensionPage from './features/extension/ExtensionPage'
import AccountPage from './features/account/AccountPage'
import MembershipPage from './features/membership/MembershipPage'
import ComponentCatalogPage from './features/component-catalog/ComponentCatalogPage'
import SocialStudioPrototypePage from './features/social-studio/SocialStudioPrototypePage'
import { hasComponentCatalogAccess, clearComponentCatalogAccess } from './app/private-component-catalog-access'

function PrivateComponentCatalogRoute() {
  return hasComponentCatalogAccess() ? <ComponentCatalogPage /> : <Navigate to="/workbench" replace />
}

function AuthBootPlaceholder() {
  return <div className="auth-session-boot" aria-busy="true" aria-live="polite" />
}

function AppRoutes() {
  const navigate = useNavigate()
  const { authStatus, isAuthenticated, logout } = useAuth()

  async function handleLogout() {
    clearComponentCatalogAccess()
    await logout()
    navigate('/login', { replace: true })
  }

  if (authStatus === 'booting') {
    return <AuthBootPlaceholder />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? '/workbench' : '/login'} replace />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/workbench" replace /> : <LoginPage />} />
      <Route
        path="/workbench"
        element={isAuthenticated ? <WorkbenchLayout onExit={handleLogout} /> : <Navigate to="/login" replace />}
      >
        <Route index element={<HomePage />} />
        <Route path="persona" element={<PersonaPage />} />
        <Route path="product-position" element={<ProductPositionPage />} />
        <Route path="titles" element={<TitlesPage />} />
        <Route path="video-script" element={<ScriptLabPage key="video-script" mode="video" />} />
        <Route path="live-script" element={<ScriptLabPage key="live-script" mode="live" />} />
        <Route path="xiaohongshu" element={<XiaohongshuPage />} />
        <Route path="wechat-article" element={<WechatArticlePage />} />
        <Route path="moments" element={<MomentsPage />} />
        <Route path="voice" element={<VoicePage />} />
        <Route path="ip-video" element={<IPVideoPage />} />
        <Route path="video-factory" element={<Suspense fallback={<div className="auth-session-boot" aria-busy="true" />}><VideoFactoryPage /></Suspense>} />
        <Route path="digital-human" element={<DigitalHumanPage />} />
        <Route path="extension" element={<ExtensionPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="membership" element={<MembershipPage />} />
        <Route path="ui-kit" element={<PrivateComponentCatalogRoute />} />
        {import.meta.env.DEV ? (
          <>
            <Route path="shot-check" element={<Suspense fallback={null}><ShotCheckPage /></Suspense>} />
            <Route path="social-studio-prototype" element={<SocialStudioPrototypePage />} />
          </>
        ) : null}
      </Route>
      {Object.entries(legacyRoutes).map(([oldPath, path]) => (
        <Route key={oldPath} path={oldPath} element={<Navigate to={path} replace />} />
      ))}
      <Route
        path="*"
        element={
          <div className="not-found">
            <h1>页面不存在</h1>
            <p>请从工作台导航选择需要的工具。</p>
            <Button onClick={() => navigate('/workbench')}>返回工作台</Button>
          </div>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ZoomProvider>
      <ThemeProvider>
        <TooltipProvider delay={180}>
          <AuthProvider>
            <WorkbenchTaskProvider>
              <AppRoutes />
              <InkCapsuleToaster />
            </WorkbenchTaskProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
      </ZoomProvider>
    </BrowserRouter>
  )
}
