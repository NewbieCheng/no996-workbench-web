import {
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  CreditCard,
  WalletCards,
} from 'lucide-react'
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState, forwardRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import WorkbenchOutlet from './WorkbenchOutlet'
import { grantComponentCatalogAccess } from './private-component-catalog-access'
import { workbenchSurfaceClassFromPathname } from './workbench-surface'
import { Button } from '@no996/ui/button'
import { HoverTip } from '@no996/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@no996/ui/dropdown-menu'
import { normalizeAppLanguage } from '@/i18n'
import {
  desktopOnlyNavigation,
  navigation,
  navGroupIcons,
  navGroupBrandIcons,
  navGroupKeys,
  navGroups,
  DESKTOP_ONLY_GROUP,
  type NavItem,
} from './navigation'
import { useTheme } from './ThemeProvider'
import { useZoom } from './ZoomProvider'
import { WorkbenchZoomControl } from './WorkbenchZoomControl'
import { useAuth } from '../auth/AuthContext'
import { formatAnnouncementBadgeCount } from '@/api/announcements'
import { AnnouncementDialog } from '@/features/announcements/AnnouncementDialog'
import { useWorkbenchAnnouncements } from '@/features/announcements/useWorkbenchAnnouncements'
import { assetUrl } from '../services/browser'
import { WorkbenchNavIcon } from './WorkbenchNavIcon'
import {
  WORKBENCH_LOCKUP_DARK,
  WORKBENCH_LOCKUP_LIGHT,
  WORKBENCH_SYMBOL_DARK,
  WORKBENCH_SYMBOL_LIGHT,
} from './workbench-brand-assets'
import { TaskCenterTrigger } from '../features/tasks/TaskCenterDrawer'
import { UserAvatar } from '../components/UserAvatar'
import { toastInfo } from '../lib/toast'

const ABOUT_URL = 'https://no996ai.cn'

const SIDEBAR_EXPANDED_PX = 216
const SIDEBAR_RAIL_PX = 55
const SIDEBAR_MIN_PX = SIDEBAR_RAIL_PX
const SIDEBAR_MAX_PX = 306
/** 窄于该宽度：导航切为图标轨（文字收起，分组子项以图标列出） */
const SIDEBAR_ICON_RAIL_BELOW = 120
/** 介于图标轨与全宽之间：仍显示文字，靠 overflow 渐隐 */
const SIDEBAR_TEXT_COMPACT_BELOW = 170

function sidebarUsesIconRail(mode: SidebarMode, width: number): boolean {
  return mode === 'rail' || width <= SIDEBAR_ICON_RAIL_BELOW
}
const WIDTH_STORAGE_KEY = 'no996.wb.sidebar.width'
const MODE_STORAGE_KEY = 'no996.wb.sidebar.mode'
const DESKTOP_ONLY_GROUP_ID = DESKTOP_ONLY_GROUP

type SidebarMode = 'expanded' | 'rail' | 'hidden'

function readStoredMode(): SidebarMode {
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY)
    if (raw === 'expanded' || raw === 'rail' || raw === 'hidden') return raw
  } catch {
    /* ignore */
  }
  return 'expanded'
}

function readStoredWidth(): number {
  try {
    const raw = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
    if (Number.isFinite(raw) && raw >= SIDEBAR_MIN_PX) {
      return Math.min(SIDEBAR_MAX_PX, Math.max(SIDEBAR_MIN_PX, Math.round(raw)))
    }
  } catch {
    /* ignore */
  }
  return SIDEBAR_EXPANDED_PX
}

function clampSidebarWidth(px: number): number {
  return Math.min(SIDEBAR_MAX_PX, Math.max(SIDEBAR_MIN_PX, Math.round(px)))
}

function groupHasActive(pathname: string, items: NavItem[]): boolean {
  return items.some((item) => item.path && (pathname === item.path || pathname.startsWith(`${item.path}/`)))
}

function SidebarChromeFooter({ iconRail }: { iconRail: boolean }) {
  const { t } = useTranslation('workbench')

  return (
    <footer className={`wb-sidebar-chrome-footer${iconRail ? ' wb-sidebar-chrome-footer--rail' : ''}`}>
      <HoverTip label={t('sidebarAboutUs')} side={iconRail ? 'right' : 'top'} enabled>
        <a
          href={ABOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="wb-sidebar-chrome-footer__action wb-sidebar-chrome-footer__about"
          aria-label={t('sidebarAboutAria')}
        >
          <Info size={16} strokeWidth={1.75} aria-hidden />
          {!iconRail ? <span>{t('sidebarAboutUs')}</span> : null}
        </a>
      </HoverTip>
      <HoverTip label={t('sidebarDesktopDownloadTip')} side="top" enabled>
        <button
          type="button"
          className="wb-sidebar-chrome-footer__action wb-sidebar-chrome-footer__download"
          aria-label={t('sidebarDesktopDownload')}
          onClick={() => toastInfo(t('sidebarDesktopNotOpen'))}
        >
          <Download size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </HoverTip>
    </footer>
  )
}

export const Brand = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  {
    compact?: boolean
    onToggle?: () => void
    toggleLabel?: string
    breadcrumb?: { root: string }
  }
>(function Brand({
  compact = false,
  onToggle,
  toggleLabel,
  breadcrumb,
}, ref) {
  const { t } = useTranslation('workbench')
  const { dark } = useTheme()
  const symbolSrc = assetUrl(dark ? WORKBENCH_SYMBOL_DARK : WORKBENCH_SYMBOL_LIGHT)
  const lockupSrc = assetUrl(dark ? WORKBENCH_LOCKUP_DARK : WORKBENCH_LOCKUP_LIGHT)
  const showLockup = !compact
  const mark = (
    <span className="wb-brand-hit">
      <img src={symbolSrc} alt="" width={20} height={20} />
    </span>
  )
  const lockup = (
    <span className="wb-brand-lockup-row">
      <img
        className="wb-brand-lockup"
        src={lockupSrc}
        alt={t('brandTitle')}
        width={160}
        height={32}
        decoding="async"
      />
      <span className="wb-brand-edition">{t('brandWebBadge')}</span>
    </span>
  )
  const className = [
    'wb-brand',
    onToggle ? 'wb-brand--icon-only' : '',
    compact ? 'wb-brand--compact' : 'wb-brand--lockup',
    breadcrumb && compact ? 'wb-brand--breadcrumb' : '',
  ]
    .filter(Boolean)
    .join(' ')
  if (onToggle) {
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={className}
        onClick={onToggle}
        aria-label={toggleLabel || t('sidebarExpand')}
      >
        {showLockup ? lockup : mark}
        {!showLockup && breadcrumb ? (
          <span className="wb-sidebar-brand__breadcrumb" aria-hidden="true">
            <span>{breadcrumb.root}</span>
          </span>
        ) : null}
      </button>
    )
  }
  return (
    <Link
      ref={ref as React.Ref<HTMLAnchorElement>}
      className={className}
      to="/workbench"
      aria-label={t('brandHomeAria')}
    >
      {showLockup ? lockup : (
        <>
          {mark}
          <strong className="wb-brand-title">{t('brandTitle')}</strong>
        </>
      )}
    </Link>
  )
})

function SidebarCollapseToggle({
  iconRail,
  label,
  onClick,
  className,
}: {
  iconRail: boolean
  label: string
  onClick: () => void
  className?: string
}) {
  const Icon = iconRail ? PanelLeftOpen : PanelLeftClose
  return (
    <HoverTip label={label} side="bottom">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={['wb-topbar-icon-btn', className].filter(Boolean).join(' ')}
        aria-label={label}
        onClick={onClick}
      >
        <Icon size={18} strokeWidth={1.75} aria-hidden />
      </Button>
    </HoverTip>
  )
}

function WorkbenchConfigurationMenu() {
  const { t, i18n } = useTranslation('workbench')
  const { t: tc } = useTranslation('common')
  const { dark, setMode } = useTheme()
  const language = normalizeAppLanguage(i18n.resolvedLanguage ?? i18n.language)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="wb-topbar-icon-btn"
            aria-label={t('topbarConfiguration')}
          />
        }
      >
        <Settings size={18} strokeWidth={1.75} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="wb-configuration-menu">
        <DropdownMenuLabel>{tc('selectLanguage')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => {
            if (value === 'zh-CN' || value === 'en-US') void i18n.changeLanguage(value)
          }}
        >
          <DropdownMenuRadioItem value="zh-CN">{tc('langZh')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en-US">{tc('langEn')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('themeMenuLabel')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={dark ? 'dark' : 'light'}
          onValueChange={(value) => {
            if (value === 'light' || value === 'dark') setMode(value)
          }}
        >
          <DropdownMenuRadioItem value="light">{t('themeLight')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t('themeDark')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('zoomMenuLabel')}</DropdownMenuLabel>
        <div className="wb-configuration-menu__zoom">
          <WorkbenchZoomControl />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu({ onExit, bottom = false }: { onExit: () => void; bottom?: boolean }) {
  const { t } = useTranslation('workbench')
  const { t: tc } = useTranslation('common')
  const { userEmail, userDisplayName } = useAuth()
  const displayName = userDisplayName || t('accountFallbackName')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className={bottom ? 'sidebar-user' : 'topbar-user'} aria-label={t('accountMenuAria')} />
        }
      >
        <UserAvatar alt={displayName} />
        <span className="user-label">
          {bottom ? <strong>{displayName}</strong> : <span className="topbar-user-label">{displayName}</span>}
          {bottom && <small>{userEmail || t('accountSignedIn')}</small>}
        </span>
        <ChevronDown className="wb-disclosure-chevron" size={14} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={bottom ? 'top' : 'bottom'} className="min-w-48">
        <DropdownMenuLabel>{userEmail || t('accountCurrent')}</DropdownMenuLabel>
        <DropdownMenuItem render={<Link to="/workbench/account" />}>
          <WalletCards />
          {t('accountAssets')}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/workbench/membership" />}>
          <CreditCard />
          {t('accountMembership')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onExit}>
          <LogOut />
          {tc('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Sidebar({
  mode,
  width,
  onResizeStart,
  onNavigate,
  dragging = false,
}: {
  mode: SidebarMode
  width: number
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void
  onNavigate?: () => void
  dragging?: boolean
}) {
  const { t } = useTranslation('workbench')
  const location = useLocation()
  const navigate = useNavigate()
  const desktopGroupClickTimes = useRef<number[]>([])
  const navMotionScope = useId()
  const reduceMotion = useReducedMotion()
  const iconRail = sidebarUsesIconRail(mode, width)
  const navLabelTips = iconRail
  const textCompact = width > 0 && width < SIDEBAR_TEXT_COMPACT_BELOW && !iconRail
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { [DESKTOP_ONLY_GROUP_ID]: false }
    for (const group of navGroups) init[group] = true
    return init
  })

  const labelOf = (item: NavItem) => t(item.labelKey, { defaultValue: item.labelKey })

  const groupDefaultOpen = (group: string) => group !== DESKTOP_ONLY_GROUP_ID

  const isGroupOpen = (group: string) => {
    const expanded = openGroups[group] ?? groupDefaultOpen(group)
    if (group !== DESKTOP_ONLY_GROUP_ID && iconRail) return true
    return expanded
  }

  const toggleGroup = (group: string) => {
    if (iconRail && group !== DESKTOP_ONLY_GROUP_ID) return
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !(prev[group] ?? groupDefaultOpen(group)),
    }))
  }

  const renderLink = (item: NavItem) => {
    const label = labelOf(item)
    if (!item.path || item.availability === 'desktop') {
      return (
        <HoverTip key={item.id} label={t('desktopOnlyHint')} side="right" enabled>
          <span className="wb-nav-item wb-nav-item--desktop-only" aria-disabled="true">
            <WorkbenchNavIcon icon={item.icon} brandSrc={item.brandIcon} />
            <span>{label}</span>
            {!iconRail && <span className="wb-desktop-badge">{t('desktopOnlyBadge')}</span>}
          </span>
        </HoverTip>
      )
    }
    return (
      <HoverTip key={item.id} label={label} side="right" enabled={navLabelTips}>
        <NavLink
          to={item.path}
          end={item.id === 'home'}
          onClick={onNavigate}
          className={({ isActive }) => `wb-nav-item ${isActive ? 'wb-nav-item--active' : ''}`}
          aria-label={label}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div
                  className="wb-nav-selection"
                  aria-hidden="true"
                  layoutId="nav-selection"
                  initial={false}
                  transition={reduceMotion || dragging ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }}
                />
              )}
              <WorkbenchNavIcon icon={item.icon} brandSrc={item.brandIcon} />
              <span>{label}</span>
              {!iconRail && item.badge === 'beta' ? (
                <span className="wb-nav-badge wb-nav-badge--beta">{t('navBetaBadge')}</span>
              ) : null}
            </>
          )}
        </NavLink>
      </HoverTip>
    )
  }

  const renderGroup = (
    group: string,
    groupKey: string,
    items: NavItem[],
    GroupIcon: (typeof navGroupIcons)[keyof typeof navGroupIcons],
    groupBrandIcon?: string,
  ) => {
    const open = isGroupOpen(group)
    const title = t(groupKey, { defaultValue: group })
    const hasActive = groupHasActive(location.pathname, items)
    return (
      <section className={`wb-nav-group${open ? '' : ' wb-nav-group--collapsed'}`} key={group}>
        <HoverTip enabled={navLabelTips} label={title} side="right">
          <button
            type="button"
            className={`wb-nav-item wb-nav-group-toggle${open ? ' wb-nav-group-toggle--open' : ''}${hasActive ? ' wb-nav-group-toggle--has-selection' : ''}`}
            aria-expanded={open}
            aria-current={hasActive ? 'true' : undefined}
            onClick={() => {
              toggleGroup(group)
              if (group !== DESKTOP_ONLY_GROUP_ID) return
              const now = Date.now()
              const recentClicks = desktopGroupClickTimes.current.filter((time) => now - time <= 2000)
              recentClicks.push(now)
              desktopGroupClickTimes.current = recentClicks
              if (recentClicks.length >= 7) {
                desktopGroupClickTimes.current = []
                grantComponentCatalogAccess()
                navigate('/workbench/ui-kit')
              }
            }}
          >
            <WorkbenchNavIcon icon={GroupIcon} brandSrc={groupBrandIcon} />
            <span className="wb-nav-group-title">{title}</span>
            <ChevronRight
              size={14}
              className={`wb-nav-chevron${open ? ' wb-nav-chevron--open' : ''}${hasActive ? ' wb-nav-chevron--selected' : ''}`}
            />
          </button>
        </HoverTip>
        <div
          className={`wb-nav-children-shell${open ? ' wb-nav-children-shell--open' : ''}`}
          aria-hidden={!open}
          {...(!open ? { inert: '' } : {})}
        >
          <div className="wb-nav-children-shell__inner">
            <div className="wb-nav-children">{items.map(renderLink)}</div>
          </div>
        </div>
      </section>
    )
  }

  const style = {
    width: mode === 'hidden' ? 0 : width,
    ['--nav-width' as string]: `${mode === 'hidden' ? 0 : width}px`,
  } as CSSProperties

  return (
    <aside
      className={`wb-sidebar ${iconRail ? 'wb-sidebar--icon-rail' : ''} ${textCompact ? 'wb-sidebar--narrow' : ''} ${dragging ? 'wb-sidebar--dragging' : ''} ${mode === 'hidden' ? 'wb-sidebar--hidden' : ''}`}
      style={style}
      aria-label={t('sidebarAria')}
      aria-hidden={mode === 'hidden'}
    >
      <div className="wb-sidebar__inner">
        <div className="wb-sidebar-panel">
          <div className="wb-sidebar-tools wb-sidebar-tools--brand">
            <Brand compact={iconRail} />
          </div>
          <LayoutGroup id={navMotionScope}>
          <nav className="wb-nav" aria-label={t('sidebarNav')}>
            {navGroups.map((group) =>
              renderGroup(
                group,
                navGroupKeys[group],
                navigation.filter((item) => item.group === group),
                navGroupIcons[group],
                navGroupBrandIcons[group],
              ),
            )}
            {renderGroup(
              DESKTOP_ONLY_GROUP_ID,
              'navGroupDesktopOnly',
              desktopOnlyNavigation,
              navGroupIcons[DESKTOP_ONLY_GROUP],
              navGroupBrandIcons[DESKTOP_ONLY_GROUP],
            )}
          </nav>
          </LayoutGroup>
          <SidebarChromeFooter iconRail={iconRail} />
          {/* 热区仅在导航面板内、圆角以下，与主区左上圆角对齐，不做遮罩 */}
          {(mode === 'expanded' || mode === 'rail') && onResizeStart ? (
            <div
              className="wb-sidebar-resize"
              onPointerDown={onResizeStart}
              role="separator"
              aria-orientation="vertical"
            />
          ) : null}
        </div>
      </div>
    </aside>
  )
}

export default function WorkbenchLayout({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation('workbench')
  const { zoomFactor } = useZoom()
  const [mode, setMode] = useState<SidebarMode>(() => readStoredMode())
  const [expandedWidth, setExpandedWidth] = useState(() => readStoredWidth())
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const [sidebarDragging, setSidebarDragging] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const location = useLocation()
  const workbenchSurface = workbenchSurfaceClassFromPathname(location.pathname)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const prevPathRef = useRef(location.pathname)
  const sidebarModeBeforeVideoFactoryRef = useRef<SidebarMode | null>(null)
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const {
    items: announcementItems,
    unreadCount: announcementUnreadCount,
    loading: announcementLoading,
    onRead: onAnnouncementRead,
  } = useWorkbenchAnnouncements()

  useEffect(() => {
    if (announcementLoading || announcementUnreadCount <= 0) return
    try {
      if (sessionStorage.getItem('no996_wb_ann_auto_open_v1') === '1') return
      sessionStorage.setItem('no996_wb_ann_auto_open_v1', '1')
    } catch {
      /* private mode: still open once this mount */
    }
    setAnnouncementOpen(true)
  }, [announcementLoading, announcementUnreadCount])

  const displayWidth = dragWidth ?? (mode === 'rail' ? SIDEBAR_RAIL_PX : mode === 'hidden' ? 0 : expandedWidth)

  const persistMode = useCallback((next: SidebarMode) => {
    setMode(next)
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const cycleMode = useCallback(() => {
    const order: SidebarMode[] = ['expanded', 'rail', 'hidden']
    const idx = order.indexOf(mode)
    const next = order[(idx + 1) % order.length]!
    persistMode(next)
  }, [mode, persistMode])

  const onResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // 展开 ↔ 图标轨可拖；全隐无把手
      if (mode !== 'expanded' && mode !== 'rail') return
      event.preventDefault()
      const fromRail = mode === 'rail'
      const startWidth = fromRail ? SIDEBAR_RAIL_PX : expandedWidth
      if (fromRail) {
        persistMode('expanded')
      }
      dragRef.current = { startX: event.clientX, startWidth }
      setSidebarDragging(true)
      setDragWidth(startWidth)
      const target = event.currentTarget
      const dragZoom = zoomFactor > 0 ? zoomFactor : 1
      const pointerId = event.pointerId
      target.setPointerCapture(pointerId)

      const finish = (finalPx: number) => {
        try {
          target.releasePointerCapture(pointerId)
        } catch {
          /* ignore */
        }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        dragRef.current = null
        let nextWidth = clampSidebarWidth(finalPx)
        setDragWidth(null)
        setSidebarDragging(false)
        if (nextWidth <= SIDEBAR_ICON_RAIL_BELOW) {
          persistMode('rail')
        } else {
          persistMode('expanded')
          setExpandedWidth(nextWidth)
          try {
            localStorage.setItem(WIDTH_STORAGE_KEY, String(nextWidth))
          } catch {
            /* ignore */
          }
        }
      }

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const delta = (ev.clientX - dragRef.current.startX) / dragZoom
        const next = clampSidebarWidth(dragRef.current.startWidth + delta)
        setDragWidth(next)
      }
      const onUp = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const finalPx = clampSidebarWidth(
          dragRef.current.startWidth + (ev.clientX - dragRef.current.startX) / dragZoom,
        )
        finish(finalPx)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [expandedWidth, mode, persistMode, zoomFactor],
  )

  useEffect(() => {
    const prev = prevPathRef.current
    const curr = location.pathname
    prevPathRef.current = curr

    const wasOnVideoFactory = prev.includes('/workbench/video-factory')
    const isOnVideoFactory = curr.includes('/workbench/video-factory')

    if (isOnVideoFactory && !wasOnVideoFactory) {
      sidebarModeBeforeVideoFactoryRef.current = modeRef.current
      persistMode('rail')
    } else if (!isOnVideoFactory && wasOnVideoFactory && sidebarModeBeforeVideoFactoryRef.current) {
      persistMode(sidebarModeBeforeVideoFactoryRef.current)
      sidebarModeBeforeVideoFactoryRef.current = null
    }
  }, [location.pathname, persistMode])

  useEffect(() => {
    if (mode !== 'hidden') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') persistMode('expanded')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, persistMode])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const shellNavWidthPx = mobileOpen
    ? Math.max(expandedWidth, SIDEBAR_EXPANDED_PX)
    : displayWidth
  const iconRail = sidebarUsesIconRail(mode, shellNavWidthPx)
  const cycleLabel =
    mode === 'expanded'
      ? t('sidebarCollapse')
      : mode === 'rail'
        ? t('sidebarHide')
        : t('sidebarShow')
  const shellClass = [
    'wb-shell',
    mode === 'hidden' ? 'wb-shell--hidden' : '',
    sidebarDragging ? 'wb-shell--sidebar-drag' : '',
    mobileOpen ? 'wb-shell--mobile-nav-open' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const shellStyle = {
    ['--nav-width' as string]: `${shellNavWidthPx}px`,
  } as CSSProperties

  return (
    <div className={shellClass} style={shellStyle}>
      {mobileOpen ? (
        <button
          type="button"
          className="mobile-navigation-scrim"
          aria-label={t('closeNav')}
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <header className="wb-topbar">
        <div className="wb-topbar-leading">
          {mode === 'hidden' ? (
            <SidebarCollapseToggle
              iconRail
              label={t('sidebarShow')}
              onClick={() => persistMode('expanded')}
              className="wb-sidebar-tools-toggle--topbar"
            />
          ) : (
            <SidebarCollapseToggle
              iconRail={iconRail}
              label={cycleLabel}
              onClick={cycleMode}
              className="wb-sidebar-tools-toggle--topbar"
            />
          )}
          <button
            type="button"
            className="wb-topbar-nav-action wb-topbar-announcement-trigger"
            aria-label={
              announcementUnreadCount > 0
                ? t('announcementTopbarAriaWithCount', { count: announcementUnreadCount })
                : t('topbarAnnouncements')
            }
            onClick={() => setAnnouncementOpen(true)}
          >
            {t('topbarAnnouncements')}
            {announcementUnreadCount > 0 ? (
              <span className="wb-topbar-announcement-badge" aria-hidden>
                {formatAnnouncementBadgeCount(announcementUnreadCount)}
              </span>
            ) : null}
          </button>
          <Button
            className="mobile-menu"
            variant="ghost"
            size="icon"
            aria-label={t('openNav')}
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
        </div>
        <div className="wb-topbar-actions">
          <TaskCenterTrigger />
          <WorkbenchConfigurationMenu />
          <span className="topbar-divider" />
          <UserMenu onExit={onExit} />
        </div>
      </header>
      <div className="desktop-sidebar">
        <Sidebar
          mode={mode}
          width={shellNavWidthPx}
          onResizeStart={onResizeStart}
          dragging={sidebarDragging}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>
      <div className="wb-main">
        <div
          className={['wb-page-area', workbenchSurface].filter(Boolean).join(' ')}
        >
          <div className="wb-page-area__scroll">
            <WorkbenchOutlet />
          </div>
        </div>
      </div>
      <AnnouncementDialog
        open={announcementOpen}
        onOpenChange={setAnnouncementOpen}
        activeItems={announcementItems}
        unreadCount={announcementUnreadCount}
        onRead={onAnnouncementRead}
      />
    </div>
  )
}
