import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  FolderArchive,
  ArrowRight,
  BookOpen,
  Search,
  Link2,
  Trash2,
  Image,
  Settings,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Switch } from '@no996/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'
import { Notice, Page, WorkbenchToolPageHeaderTools, WorkbenchPageChromeActions } from '../../components/WorkbenchUI'
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs'
import { useAuth } from '../../auth/AuthContext'
import { extensionClient } from '../../services/extension/extension-client'
import type {
  WorkbenchBridgeAccountSummary,
  WorkbenchBridgePlatformId,
  WorkbenchBridgeStatus,
} from '../../services/extension/workbench-bridge-contract'
import { materialRepository, type SavedMaterial } from '../../services/materials/material-repository'
import { clearAllMaterialFallbacks } from '../../services/materials/material-asset-hydration'
import { readMaterialPersistImages, writeMaterialPersistImages } from './materials/material-settings'
import { toastInfo } from '../../lib/toast'
import { ExtensionMaterialLibraryPanel, type GroupViewMode } from './materials/ExtensionMaterialLibraryPanel'
import { ExtensionMaterialImport } from './materials/ExtensionMaterialImport'
import { ExtensionCapturePanel, type CaptureMode } from './capture/ExtensionCapturePanel'

// SVG illustration for Step 01: Open extension management
function Step01Illustration() {
  const { t } = useTranslation('extension')
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border/60 bg-muted/20 backdrop-blur-xs p-3 sm:p-5 shadow-xs select-none">
      <div className="flex items-center gap-1.5 pb-3 border-b border-border/40">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
        <div className="ml-3 text-[11px] text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-muted inline-block" /> {t('illusExtMgmt')}
        </div>
      </div>
      {/* Browser Bar */}
      <div className="flex items-center gap-2 my-3">
        <div className="flex-1 bg-background/80 border border-border/50 rounded-lg px-3 py-1.5 text-[11px] text-foreground/80 flex items-center justify-between">
          <span className="truncate font-mono">chrome://extensions/</span>
          <span className="text-muted-foreground text-xs">☆</span>
        </div>
        <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs">
          🧩
        </div>
      </div>
      {/* Mock Content & Dropdown */}
      <div className="relative bg-background/40 border border-border/40 rounded-xl p-4 min-h-[160px] flex">
        <div className="flex-1 space-y-2 opacity-30 pr-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-10 bg-muted/60 rounded-lg" />
          <div className="h-10 bg-muted/60 rounded-lg" />
        </div>
        {/* Dropdown Menu Overlay */}
        <div className="w-48 bg-card border border-border/80 rounded-xl p-2 shadow-xl space-y-1 z-10 animate-in fade-in">
          <div className="h-6 rounded bg-muted/50 px-2 flex items-center text-[11px] text-muted-foreground">{t('illusInstalledCount')}</div>
          <div className="h-6 rounded bg-muted/50 px-2 flex items-center text-[11px] text-muted-foreground">{t('illusOptions')}</div>
          <div className="h-8 rounded-lg bg-primary/15 border border-primary/40 px-2.5 flex items-center justify-between text-xs font-medium text-foreground shadow-xs">
            <span className="flex items-center gap-1.5">
              <span>🧩</span> {t('illusManageExt')}
            </span>
            <span className="text-xs">👆</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// SVG illustration for Step 02: Toggle developer mode
function Step02Illustration() {
  const { t } = useTranslation('extension')
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border/60 bg-muted/20 backdrop-blur-xs p-3 sm:p-5 shadow-xs select-none">
      <div className="flex items-center gap-1.5 pb-3 border-b border-border/40">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
        <div className="ml-3 text-[11px] text-muted-foreground font-mono">chrome://extensions</div>
      </div>
      <div className="bg-background/40 border border-border/40 rounded-xl p-4 mt-3 space-y-4">
        {/* Header with Dev Mode Switch */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="text-base">🧩</span>
            <span className="text-sm font-semibold text-foreground">{t('illusExtensions')}</span>
          </div>
          <div className="flex items-center gap-2.5 bg-card px-3 py-1 rounded-full border border-primary/30 shadow-xs">
            <span className="text-xs text-foreground font-medium">{t('illusDevMode')}</span>
            {/* Active Toggle Switch */}
            <div className="relative w-9 h-5 bg-primary rounded-full transition-colors flex items-center px-0.5">
              <div className="w-4 h-4 rounded-full bg-primary-foreground ml-auto shadow-xs" />
            </div>
            <span className="text-xs">👆</span>
          </div>
        </div>
        {/* Action Buttons Revealed */}
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
            {t('illusLoadUnpacked')}
          </div>
          <div className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[11px]">
            {t('illusPackExt')}
          </div>
          <div className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[11px]">
            {t('illusUpdate')}
          </div>
        </div>
      </div>
    </div>
  )
}

// SVG illustration for Step 03: Drag & drop ZIP package
function Step03Illustration() {
  const { t } = useTranslation('extension')
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border/60 bg-muted/20 backdrop-blur-xs p-3 sm:p-5 shadow-xs select-none">
      <div className="flex items-center gap-1.5 pb-3 border-b border-border/40">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
        <div className="ml-3 text-[11px] text-muted-foreground font-mono">chrome://extensions</div>
      </div>
      <div className="relative bg-background/40 border border-border/40 rounded-xl p-4 mt-3 min-h-[170px] flex items-center justify-center">
        {/* Dropzone Dotted Area */}
        <div className="w-full h-32 border-2 border-dashed border-primary/40 rounded-xl bg-primary/5 flex flex-col items-center justify-center text-center p-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-lg mb-1.5">
            🧩
          </div>
          <span className="text-xs text-foreground font-medium">{t('illusDropZip')}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">{t('illusChromiumBrowsers')}</span>
        </div>

        {/* Dragging ZIP Graphic floating */}
        <div className="absolute right-6 -top-2 rotate-6 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl p-2.5 shadow-xl border border-white/20 flex items-center gap-2">
          <FolderArchive size={22} className="text-white drop-shadow-sm" />
          <div className="text-left">
            <div className="text-[11px] font-bold leading-none">zhiyuan.zip</div>
            <div className="text-[9px] text-white/80 mt-0.5">{t('illusDragging')}</div>
          </div>
          <span className="text-base ml-1">👆</span>
        </div>
      </div>
    </div>
  )
}

function platformLabel(
  platformId: WorkbenchBridgePlatformId,
  t: (key: string) => string,
): string {
  if (platformId === 'douyin') return t('platformDouyin')
  if (platformId === 'xiaohongshu') return t('platformXiaohongshu')
  if (platformId === 'bilibili') return t('platformBilibili')
  if (platformId === 'weixin') return t('platformWeixin')
  return platformId
}

export default function ExtensionPage() {
  const { t } = useTranslation(['extension', 'workbench'])
  const { userId } = useAuth()
  const [tab, setTab] = useState<'install' | 'capture' | 'materials'>('install')
  const [captureSubMode, setCaptureSubMode] = useState<CaptureMode>('keyword')
  const [materialViewMode, setMaterialViewMode] = useState<GroupViewMode>('task')
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(() => new Set())
  const [persistImages, setPersistImages] = useState(() => readMaterialPersistImages())

  const [status, setStatus] = useState<WorkbenchBridgeStatus | null>(null)
  const [accounts, setAccounts] = useState<WorkbenchBridgeAccountSummary[]>([])
  const [materials, setMaterials] = useState<SavedMaterial[]>([])
  const [copiedLink, setCopiedLink] = useState(false)
  const [error, setError] = useState('')
  const [focusedBatchId, setFocusedBatchId] = useState<string | undefined>(undefined)
  const [showTutorialOverride, setShowTutorialOverride] = useState(false)

  const refreshAll = async () => {
    setError('')
    try {
      const extStatus = await extensionClient.checkStatus(800)
      setStatus(extStatus)
      if (extStatus.connected) {
        const accs = await extensionClient.listAccounts()
        setAccounts(accs)
      }
    } catch {
      setStatus({
        connected: false,
        extensionVersion: '',
        protocolVersion: '1.0.0',
        supportedPlatforms: [],
      })
    }
    if (userId != null) {
      const list = await materialRepository.listMaterials(userId)
      setMaterials(list)
    }
  }

  // 挂载初次加载及素材同步
  useEffect(() => {
    let cancelled = false
    setMaterials([])
    setSelectedMaterialIds(new Set())
    if (userId != null) {
      void materialRepository.listMaterials(userId).then((list) => { if (!cancelled) setMaterials(list) })
    }
    return () => { cancelled = true }
  }, [userId])

  // 实时探针：自动轮询 + 窗口聚焦监听，无需用户手动刷新网页
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const probe = async () => {
      try {
        const extStatus = await extensionClient.checkStatus(800)
        if (cancelled) return
        setStatus((prev) => {
          if (
            prev?.connected !== extStatus.connected ||
            prev?.extensionVersion !== extStatus.extensionVersion
          ) {
            return extStatus
          }
          return prev ?? extStatus
        })
        if (extStatus.connected) {
          const accs = await extensionClient.listAccounts()
          if (!cancelled) setAccounts(accs)
        }
      } catch {
        if (!cancelled) {
          setStatus({
            connected: false,
            extensionVersion: '',
            protocolVersion: '1.0.0',
            supportedPlatforms: [],
          })
        }
      }
    }

    void probe()

    // 智能轮询：未连接时每 1.5 秒探针一次；已连接时降为 8 秒
    const scheduleNext = () => {
      timer = window.setTimeout(async () => {
        await probe()
        if (!cancelled) scheduleNext()
      }, status?.connected ? 8000 : 1500)
    }
    scheduleNext()

    const onFocus = () => {
      void probe()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [status?.connected])

  const handleConnect = async (platformId: WorkbenchBridgePlatformId) => {
    setError('')
    try {
      const res = await extensionClient.connectAccount(platformId)
      toastInfo(res.message || t('extension:connectOpenedFallback'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('extension:connectFailed'))
    }
  }

  const handleDeleteMaterials = async (ids: string[]) => {
    if (userId == null) return
    await materialRepository.deleteMaterials(userId, ids)
    if (userId != null) {
      const updated = await materialRepository.listMaterials(userId)
      setMaterials(updated)
    }
  }

  const refreshMaterials = async () => {
    if (userId == null) return
    const updated = await materialRepository.listMaterials(userId)
    setMaterials(updated)
  }

  const handleCopyExtPath = async () => {
    try {
      await navigator.clipboard.writeText('chrome://extensions/')
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleAfterCapture = async (batchId: string) => {
    setFocusedBatchId(batchId)
    await refreshMaterials()
  }

  const handleSwitchToMaterials = (batchId?: string) => {
    if (batchId) setFocusedBatchId(batchId)
    setTab('materials')
  }

  // 素材库专用操作
  const handlePersistChange = (checked: boolean) => {
    setPersistImages(checked)
    writeMaterialPersistImages(checked)
  }

  const handleDeleteSelectedMaterials = async () => {
    if (!selectedMaterialIds.size) return
    if (!window.confirm(t('materialDeleteSelectedConfirm', { count: selectedMaterialIds.size }))) return
    const ids = [...selectedMaterialIds]
    await handleDeleteMaterials(ids)
    setSelectedMaterialIds(new Set())
  }

  const handleClearAllMaterials = async () => {
    if (!materials.length) return
    if (!window.confirm(t('materialClearAllConfirm'))) return
    const ids = materials.map((m) => m.id)
    await handleDeleteMaterials(ids)
    setSelectedMaterialIds(new Set())
  }

  const handleClearFallbacks = async () => {
    if (userId == null) return
    if (!window.confirm(t('materialClearFallbacksConfirm'))) return
    await clearAllMaterialFallbacks(userId)
    await refreshMaterials()
  }

  const isConnected = Boolean(status?.connected)

  return (
    <Page
      moduleId="extension"
      title={t('workbench:navExtension')}
      description={t('extension:pageDesc')}
      chrome="workbench-tool"
      titleExtra={
        <WorkbenchToolPageHeaderTools>
          <Tabs
            value={tab}
            onValueChange={(next) => {
              if (next === 'install' || next === 'capture' || next === 'materials') {
                setTab(next)
              }
            }}
          >
            <TabsList
              variant="toolbar"
              className="wb-page-view-tabs extension-page-view-tabs"
              aria-label={t('extension:pageDesc')}
            >
              <TabsTrigger value="install" className="flex items-center gap-1.5">
                <span>{t('extension:tabInstallAndStatus') || '安装与状态'}</span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                    isConnected
                      ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                      : 'bg-muted-foreground/40'
                  }`}
                  aria-hidden="true"
                />
              </TabsTrigger>
              <TabsTrigger value="capture">
                {t('extension:tabCapture') || '爆款采集'}
              </TabsTrigger>
              <TabsTrigger value="materials">
                {t('extension:tabMaterials')} ({materials.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </WorkbenchToolPageHeaderTools>
      }
      actions={
        tab === 'capture' ? (
          <WorkbenchPageChromeActions>
            <Tabs
              value={captureSubMode}
              onValueChange={(v) => setCaptureSubMode(v as CaptureMode)}
            >
              <TabsList variant="toolbar" className="wb-page-view-tabs">
                <TabsTrigger value="keyword" className="gap-1.5 text-xs">
                  <Search size={13} /> 关键词抓取
                </TabsTrigger>
                <TabsTrigger value="links" className="gap-1.5 text-xs">
                  <Link2 size={13} /> 链接采集
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </WorkbenchPageChromeActions>
        ) : tab === 'materials' ? (
          <WorkbenchPageChromeActions>
            <div className="flex items-center gap-1.5">
              {/* 删除选中项（若有选中则显示） */}
              {selectedMaterialIds.size > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => void handleDeleteSelectedMaterials()}
                >
                  <Trash2 size={13} className="mr-1" />
                  删除 ({selectedMaterialIds.size})
                </Button>
              )}

              {/* 更多与批量清理选项下拉菜单 */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="更多管理选项"
                      aria-label="更多管理选项"
                    />
                  }
                >
                  <MoreHorizontal size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  <DropdownMenuItem
                    onClick={() => void handleClearAllMaterials()}
                    disabled={!materials.length}
                    variant="destructive"
                    className="cursor-pointer"
                  >
                    <Trash2 size={13} className="mr-2" />
                    <span>清空素材库</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 素材库设置下拉菜单（聚合保存图片开关、清除本地缓存） */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="素材库设置"
                      aria-label="素材库设置"
                    />
                  }
                >
                  <Settings size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs p-1.5 space-y-1">
                  {/* 保存图片到本地开关 */}
                  <div
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer select-none"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePersistChange(!persistImages)
                    }}
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground">保存图片到本机</div>
                      <div className="text-[10.5px] text-muted-foreground">占用存储空间，提供离线预览</div>
                    </div>
                    <Switch
                      checked={persistImages}
                      onCheckedChange={handlePersistChange}
                      className="scale-75 shrink-0"
                    />
                  </div>

                  <DropdownMenuSeparator />

                  {/* 清除图片兜底缓存 */}
                  <DropdownMenuItem
                    onClick={() => void handleClearFallbacks()}
                    disabled={userId == null}
                    className="cursor-pointer py-2"
                  >
                    <Image size={13} className="mr-2 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <div>清除图片缓存</div>
                      <div className="text-[10.5px] text-muted-foreground">保留素材正文，重置本地缩略图</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </WorkbenchPageChromeActions>
        ) : tab === 'install' && isConnected ? (
          <WorkbenchPageChromeActions>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTutorialOverride((prev) => !prev)}
              className="text-xs gap-1.5 h-8 px-3"
            >
              <BookOpen size={13} /> {showTutorialOverride ? '返回连接状态' : '查看安装教程'}
            </Button>
          </WorkbenchPageChromeActions>
        ) : undefined
      }
    >
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {/* Tab 1: 安装与连接状态（已安装/未安装自适应） */}
      {tab === 'install' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 左侧固定：扩展档案与下载卡片 */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs flex flex-col items-center text-center">
              <h2 className="text-xl font-bold tracking-tight mb-1 text-foreground">
                {isConnected ? '知源扩展已正常运行' : t('extension:installHeroTitle')}
              </h2>
              <p className="text-xs text-muted-foreground mb-6">
                {isConnected
                  ? '已成功接通浏览器沙箱，支持各平台登录态无缝复用'
                  : t('extension:installHeroSubtitle')}
              </p>

              <img
                src="/brand/extension-icon.png"
                alt={t('extension:productName')}
                className="w-24 h-24 object-contain mb-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />

              <h3 className="text-base font-semibold text-foreground">{t('extension:productName')}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">
                {status?.extensionVersion ? `v${status.extensionVersion}` : t('extension:productVersion')}
              </p>
              <div className="text-[11px] px-3 py-1 rounded-full bg-muted text-muted-foreground mb-6">
                {t('extension:browserSupport')}
              </div>

              {/* 状态与下载操作 */}
              <div className="w-full rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
                <div className="text-xs font-medium text-foreground">
                  {isConnected ? '插件通信检测' : t('extension:installPrompt')}
                </div>

                {isConnected ? (
                  <div className="w-full py-2.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={16} />{' '}
                    {t('extension:connectedBadge', { version: status?.extensionVersion || '3.7.4' })}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center gap-1.5"
                    onClick={refreshAll}
                  >
                    <RefreshCw size={13} /> {t('extension:checkInstallStatus')}
                  </Button>
                )}

                <a
                  href="/downloads/zhiyuan-extension.zip"
                  download="zhiyuan-extension.zip"
                  className="block w-full"
                >
                  <Button
                    variant={isConnected ? 'outline' : 'default'}
                    className="w-full gap-2 shadow-xs font-medium"
                  >
                    <Download size={15} />
                    {isConnected ? t('extension:redownloadZip') : t('extension:downloadZip')}
                  </Button>
                </a>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-4">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>{t('extension:sandboxNote')}</span>
              </div>
            </div>
          </div>

          {/* 右侧自适应区域 */}
          <div className="lg:col-span-8 space-y-6">
            {/* 场景 A：已连接状态，直接展示平台登录状态与快捷采集跳转 */}
            {isConnected && !showTutorialOverride ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                      <CheckCircle2 size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground">
                        {t('extension:connectedTitle', { version: status?.extensionVersion })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t('extension:connectedHint')}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={refreshAll} className="gap-1.5 shrink-0">
                      <RefreshCw size={13} /> {t('extension:recheck')}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t('extension:accountsHeading')}
                    </h4>
                    {accounts.map((acc) => (
                      <div
                        key={acc.platformId}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/30"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-xs capitalize w-14">
                            {platformLabel(acc.platformId, (k) => t(`extension:${k}`))}
                          </span>
                          <span className="text-xs text-muted-foreground">{acc.displayName}</span>
                          {acc.status === 'logged_in' ? (
                            <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                              <CheckCircle2 size={12} /> {t('extension:loggedIn')}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium">
                              {t('extension:notLoggedIn')}
                            </span>
                          )}
                        </div>
                        {acc.status !== 'logged_in' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleConnect(acc.platformId)}
                          >
                            {t('extension:goLogin')} <ExternalLink size={11} className="ml-1" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <hr className="section-divider my-4" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>{t('extension:cookiePrivacy')}</span>
                  </div>
                </div>

                {/* 引导前往爆款采集 */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">连接就绪，马上开启爆款采集</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      前往“爆款采集”页，可直接输入作品链接解析，或输入关键词进行全自动批量抓取。
                    </p>
                  </div>
                  <Button onClick={() => setTab('capture')} className="gap-1.5 shrink-0">
                    前往爆款采集 <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            ) : (
              /* 场景 B：未连接状态，或者已连接用户点击了查看教程，展示3步安装图解 */
              <div className="space-y-8">
                {/* Step 01 */}
                <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-6 shadow-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-extrabold tracking-tight text-primary">01</span>
                      <h3 className="text-lg font-bold text-foreground">{t('extension:step01Title')}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyExtPath}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                    >
                      {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedLink ? t('extension:step01CopyDone') : t('extension:step01Copy')}</span>
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('extension:step01BodyBefore')}{' '}
                    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground">
                      chrome://extensions/
                    </code>{' '}
                    {t('extension:step01BodyAfter')}
                  </p>

                  <Step01Illustration />
                </div>

                {/* Step 02 */}
                <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-6 shadow-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-extrabold tracking-tight text-primary">02</span>
                      <h3 className="text-lg font-bold text-foreground">{t('extension:step02Title')}</h3>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                      {t('extension:step02Badge')}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('extension:step02Body')}
                  </p>

                  <Step02Illustration />
                </div>

                {/* Step 03 */}
                <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-6 shadow-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-extrabold tracking-tight text-primary">03</span>
                      <h3 className="text-lg font-bold text-foreground">{t('extension:step03Title')}</h3>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600">
                      {t('extension:step03Badge')}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('extension:step03BodyBefore')}{' '}
                    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground">
                      zhiyuan-extension.zip
                    </code>{' '}
                    {t('extension:step03BodyAfter')}
                  </p>

                  <Step03Illustration />

                  {/* Fallback Notice */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold text-foreground">{t('extension:fallbackTitle')}</div>
                      <div className="text-muted-foreground leading-relaxed">
                        {t('extension:fallbackStep1')}
                        <br />
                        {t('extension:fallbackStep2')}
                        <br />
                        {t('extension:fallbackStep3')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Call to Action */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{t('extension:afterInstallTitle')}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('extension:afterInstallBody')}</p>
                  </div>
                  <Button onClick={refreshAll} className="gap-1.5 shrink-0">
                    <RefreshCw size={14} /> 检测连接状态
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: 独立爆款采集工作台 */}
      {tab === 'capture' && (
        <ExtensionCapturePanel
          userId={userId}
          isConnected={isConnected}
          mode={captureSubMode}
          accounts={accounts}
          onConnectAccount={handleConnect}
          onModeChange={setCaptureSubMode}
          onAfterCapture={handleAfterCapture}
          onSwitchToMaterials={handleSwitchToMaterials}
        />
      )}

      {/* Tab 3: 本机纯素材资产库（多维分类与高颜值自媒体网格） */}
      {tab === 'materials' && (
        <div className="space-y-4">
        {userId != null && <ExtensionMaterialImport key={userId} userId={userId} onRefresh={refreshMaterials} />}
        <ExtensionMaterialLibraryPanel
          materials={materials}
          userId={userId}
          focusedBatchId={focusedBatchId}
          viewMode={materialViewMode}
          onViewModeChange={setMaterialViewMode}
          selectedIds={selectedMaterialIds}
          onSelectedIdsChange={setSelectedMaterialIds}
          onRefresh={refreshMaterials}
          onDeleteIds={handleDeleteMaterials}
          platformLabel={(platformId) => platformLabel(platformId, (k) => t(`extension:${k}`))}
        />
        </div>
      )}
    </Page>
  )
}
