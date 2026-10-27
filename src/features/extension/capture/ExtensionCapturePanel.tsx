import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Layers,
  ExternalLink,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { extensionClient } from '../../../services/extension/extension-client'
import {
  materialRepository,
  type SavedMaterial,
} from '../../../services/materials/material-repository'
import { hydrateMaterialFallbacks } from '../../../services/materials/material-asset-hydration'
import type {
  WorkbenchBridgeAccountSummary,
  WorkbenchBridgeCollectedItem,
  WorkbenchBridgePlatformId,
} from '../../../services/extension/workbench-bridge-contract'
import { toastSuccess, useNotifyOperationMessage } from '../../../lib/toast'
import { resolveCollectToastTitle } from '../format-collect-toast'
import { assetUrl } from '../../../services/browser'
import {
  WORKBENCH_BRAND_BILIBILI,
  WORKBENCH_BRAND_DOUYIN,
  WORKBENCH_BRAND_XIAOHONGSHU,
} from '../../../app/workbench-brand-assets'
import { CaptureLimitField, clampCaptureLimit } from '../../../components/CaptureLimitField'
import {
  CAPTURE_SETTINGS_FIELD_CLASS,
  CAPTURE_SETTINGS_LABEL_CLASS,
  CAPTURE_SETTINGS_LIMIT_FIELD_CLASS,
  CAPTURE_SETTINGS_TRIGGER_CLASS,
  optionLabel,
} from '../../../components/capture-settings-shared'

export type CaptureMode = 'keyword' | 'links'

interface Props {
  userId: number | null
  isConnected: boolean
  mode: CaptureMode
  accounts?: WorkbenchBridgeAccountSummary[]
  onConnectAccount?: (platformId: WorkbenchBridgePlatformId) => Promise<void>
  onModeChange: (mode: CaptureMode) => void
  onAfterCapture: (batchId: string) => Promise<void>
  onSwitchToMaterials: (batchId?: string) => void
}

interface BatchProgress {
  total: number
  current: number
  successCount: number
  failCount: number
  activeUrl?: string
}

export function ExtensionCapturePanel({
  userId,
  isConnected,
  mode,
  accounts = [],
  onConnectAccount,
  onModeChange: _onModeChange,
  onAfterCapture,
  onSwitchToMaterials,
}: Props) {
  const { t } = useTranslation('extension')

  // 国际化动态选项
  const platformChips = useMemo(
    () => [
      {
        id: 'xiaohongshu' as const,
        name: t('platformXiaohongshu', { defaultValue: '小红书' }),
        tag: t('tagXiaohongshu', { defaultValue: '图文与生活笔记' }),
        brandIcon: WORKBENCH_BRAND_XIAOHONGSHU,
        activeBadgeClass: 'bg-[#ff2442] text-white',
        activeBorderClass: 'border-[#ff2442]/50 bg-[#ff2442]/5 text-[#ff2442]',
      },
      {
        id: 'douyin' as const,
        name: t('platformDouyin', { defaultValue: '抖音' }),
        tag: t('tagDouyin', { defaultValue: '短视频与热榜' }),
        brandIcon: WORKBENCH_BRAND_DOUYIN,
        activeBadgeClass: 'bg-[#161823] text-white',
        activeBorderClass: 'border-foreground/40 bg-foreground/5 text-foreground',
      },
      {
        id: 'bilibili' as const,
        name: t('platformBilibili', { defaultValue: 'B站' }),
        tag: t('tagBilibili', { defaultValue: '中长视频与弹幕' }),
        brandIcon: WORKBENCH_BRAND_BILIBILI,
        activeBadgeClass: 'bg-[#00aeec] text-white',
        activeBorderClass: 'border-[#00aeec]/50 bg-[#00aeec]/5 text-[#00aeec]',
      },
    ],
    [t]
  )

  const strategyOptions = useMemo(
    () => [
      { value: 'auto', label: t('strategyAuto', { defaultValue: '智能混合' }) },
      { value: 'api', label: t('strategyApi', { defaultValue: 'API 极速采集（推荐）' }) },
      { value: 'rpa', label: t('strategyRpa', { defaultValue: 'RPA 真实页面采集' }) },
    ],
    [t]
  )

  const xhsSortOptions = useMemo(
    () => [
      { value: 'most_liked', label: t('sortMostLiked', { defaultValue: '最多点赞' }) },
      { value: 'general', label: t('sortGeneral', { defaultValue: '综合排序' }) },
      { value: 'latest', label: t('sortLatest', { defaultValue: '最新发布' }) },
    ],
    [t]
  )

  const douyinSortOptions = useMemo(
    () => [
      { value: 'most-liked', label: t('sortMostLiked', { defaultValue: '最多点赞' }) },
      { value: 'latest', label: t('sortLatest', { defaultValue: '最新发布' }) },
      { value: 'comprehensive', label: t('sortGeneral', { defaultValue: '综合排序' }) },
    ],
    [t]
  )

  const bilibiliSortOptions = useMemo(
    () => [
      { value: 'click', label: t('sortClick', { defaultValue: '最多播放' }) },
      { value: 'pubdate', label: t('sortLatest', { defaultValue: '最新发布' }) },
      { value: 'stow', label: t('sortStow', { defaultValue: '最多收藏' }) },
      { value: 'dm', label: t('sortDm', { defaultValue: '最多弹幕' }) },
      { value: '', label: t('sortGeneral', { defaultValue: '综合排序' }) },
    ],
    [t]
  )

  const standardPublishTimeOptions = useMemo(
    () => [
      { value: 'all', label: t('timeAll', { defaultValue: '不限时间' }) },
      { value: 'one-day', label: t('timeOneDay', { defaultValue: '一天内' }) },
      { value: 'one-week', label: t('timeOneWeek', { defaultValue: '一周内' }) },
      { value: 'half-year', label: t('timeHalfYear', { defaultValue: '半年内' }) },
    ],
    [t]
  )

  const bilibiliPublishTimeOptions = useMemo(
    () => [
      { value: 'all', label: t('timeAll', { defaultValue: '不限时间' }) },
      { value: 'one-day', label: t('timeOneDay', { defaultValue: '一天内' }) },
      { value: 'one-week', label: t('timeOneWeek', { defaultValue: '一周内' }) },
      { value: 'one-month', label: t('timeOneMonth', { defaultValue: '一月内' }) },
    ],
    [t]
  )

  const minLikesOptions = useMemo(
    () => [
      { value: 'any', label: t('likesAny', { defaultValue: '不限点赞' }) },
      { value: '100', label: t('likesAtLeast', { count: 100, defaultValue: '至少 100 赞' }) },
      { value: '500', label: t('likesAtLeast', { count: 500, defaultValue: '至少 500 赞' }) },
      { value: '1000', label: t('likesAtLeast', { count: 1000, defaultValue: '至少 1000 赞' }) },
      { value: '5000', label: t('likesAtLeast', { count: 5000, defaultValue: '至少 5000 赞' }) },
      { value: '10000', label: t('likesAtLeast', { count: 10000, defaultValue: '至少 10000 赞' }) },
    ],
    [t]
  )

  const minCommentsOptions = useMemo(
    () => [
      { value: 'any', label: t('commentsAny', { defaultValue: '不限评论' }) },
      { value: '10', label: t('commentsAtLeast', { count: 10, defaultValue: '至少 10 条评论' }) },
      { value: '50', label: t('commentsAtLeast', { count: 50, defaultValue: '至少 50 条评论' }) },
      { value: '100', label: t('commentsAtLeast', { count: 100, defaultValue: '至少 100 条评论' }) },
      { value: '500', label: t('commentsAtLeast', { count: 500, defaultValue: '至少 500 条评论' }) },
    ],
    [t]
  )

  const xhsNoteTypeOptions = useMemo(
    () => [
      { value: 'all', label: t('noteTypeAll', { defaultValue: '不限笔记形式' }) },
      { value: 'video', label: t('noteTypeVideo', { defaultValue: '仅视频笔记' }) },
      { value: 'image-text', label: t('noteTypeImageText', { defaultValue: '仅图文笔记' }) },
    ],
    [t]
  )

  const xhsSearchRangeOptions = useMemo(
    () => [
      { value: 'all', label: t('searchRangeAll', { defaultValue: '不限搜索范围' }) },
      { value: 'recently-viewed', label: t('searchRangeRecentlyViewed', { defaultValue: '已看过' }) },
      { value: 'not-viewed', label: t('searchRangeNotViewed', { defaultValue: '未看过' }) },
      { value: 'following', label: t('searchRangeFollowing', { defaultValue: '已关注' }) },
    ],
    [t]
  )

  const douyinContentTypeOptions = useMemo(
    () => [
      { value: 'all', label: t('contentTypeAll', { defaultValue: '不限内容形式' }) },
      { value: 'video', label: t('contentTypeVideo', { defaultValue: '视频' }) },
      { value: 'image-text', label: t('contentTypeImageText', { defaultValue: '图文' }) },
    ],
    [t]
  )

  const douyinDurationOptions = useMemo(
    () => [
      { value: 'all', label: t('durationAll', { defaultValue: '不限时长' }) },
      { value: 'under-one-minute', label: t('durationUnderOneMin', { defaultValue: '1分钟以下' }) },
      { value: 'one-to-five-minutes', label: t('durationOneToFiveMin', { defaultValue: '1–5分钟' }) },
      { value: 'over-five-minutes', label: t('durationOverFiveMin', { defaultValue: '5分钟以上' }) },
    ],
    [t]
  )

  const bilibiliDurationOptions = useMemo(
    () => [
      { value: 'all', label: t('durationAllBili', { defaultValue: '全部时长' }) },
      { value: '1', label: t('durationBiliUnder10', { defaultValue: '10 分钟以下' }) },
      { value: '2', label: t('durationBili10To30', { defaultValue: '10–30 分钟' }) },
      { value: '3', label: t('durationBili30To60', { defaultValue: '30–60 分钟' }) },
      { value: '4', label: t('durationBiliOver60', { defaultValue: '60 分钟以上' }) },
    ],
    [t]
  )

  // 1. 关键词搜索基础状态
  const [keyword, setKeyword] = useState('')
  const [platform, setPlatform] = useState<WorkbenchBridgePlatformId>('xiaohongshu')
  // 采集策略
  const [strategy, setStrategy] = useState<'auto' | 'api' | 'rpa'>('auto')
  // 目标条数
  const [limit, setLimit] = useState<number>(5)
  const [isSearching, setIsSearching] = useState(false)

  // 排序与筛选（根据目标平台动态变化）
  const [sortType, setSortType] = useState<string>('most_liked')
  const [publishTime, setPublishTime] = useState<string>('all')

  // 平台专属快捷字段
  const [xhsNoteType, setXhsNoteType] = useState<string>('all')
  const [xhsSearchRange, setXhsSearchRange] = useState<string>('all')
  const [douyinContentType, setDouyinContentType] = useState<string>('all')
  const [douyinVideoDuration, setDouyinVideoDuration] = useState<string>('all')
  const [bilibiliDuration, setBilibiliDuration] = useState<string>('all')

  const [minLikes, setMinLikes] = useState<string>('any')
  const [minComments, setMinComments] = useState<string>('any')
  const [captureSettingsOpen, setCaptureSettingsOpen] = useState(false)

  // 2. 链接采集配置项
  const [urlInput, setUrlInput] = useState('')
  const [isCapturingLinks, setIsCapturingLinks] = useState(false)
  const [linkProgress, setLinkProgress] = useState<BatchProgress | null>(null)

  // 通用错误与最新结果
  const [error, setError] = useState('')
  useNotifyOperationMessage(error, 'error', 'extension-capture')
  const [lastBatchResult, setLastBatchResult] = useState<{
    batchId: string
    title: string
    count: number
    items: SavedMaterial[]
  } | null>(null)

  // 初始化与登录态自适应平台选择（优先自动选中已登录平台）
  useEffect(() => {
    if (!accounts || accounts.length === 0) return
    const currentAcc = accounts.find((a) => a.platformId === platform)
    if (currentAcc?.status !== 'logged_in') {
      const firstLoggedIn = accounts.find((a) => a.status === 'logged_in')
      if (firstLoggedIn) {
        setPlatform(firstLoggedIn.platformId)
      }
    }
  }, [accounts])

  // 1. 关键词全自动采集
  const handleSearchKeyword = async () => {
    if (!isConnected) {
      setError(t('captureNotConnectedError', { defaultValue: '插件未连接，请先在“安装与状态”页确认知源扩展已正常运行' }))
      return
    }
    const kw = keyword.trim()
    if (!kw) return

    setError('')
    setIsSearching(true)
    setLastBatchResult(null)

    const batchId = `batch_kw:${Date.now()}`
    const platformName =
      platform === 'xiaohongshu'
        ? t('platformXiaohongshu', { defaultValue: '小红书' })
        : platform === 'douyin'
          ? t('platformDouyin', { defaultValue: '抖音' })
          : t('platformBilibili', { defaultValue: 'B站' })
    const captureLimit = clampCaptureLimit(limit)
    const batchTitle = `${platformName}: "${kw}" (${captureLimit})`

    try {
      const items = await extensionClient.searchWorks({
        platformId: platform,
        keyword: kw,
        limit: captureLimit,
        filters: {
          publishWithin: publishTime === 'all' ? 'all' : (publishTime as any),
          sortType: platform !== 'bilibili' ? sortType : undefined,
          minLikes: minLikes !== 'any' ? Number(minLikes) : undefined,
          minComments: minComments !== 'any' ? Number(minComments) : undefined,
          noteType:
            platform === 'xiaohongshu' && xhsNoteType !== 'all' ? xhsNoteType : undefined,
          searchRange:
            platform === 'xiaohongshu' && xhsSearchRange !== 'all' ? xhsSearchRange : undefined,
          collectMode: strategy,
        },
      })

      if (items.length === 0) {
        setError(t('captureNotFoundKeyword', { keyword: kw, defaultValue: `未找到与关键词“${kw}”相关的热门作品，请尝试更换关键词。` }))
        setIsSearching(false)
        return
      }

      if (userId != null) {
        const saved = await materialRepository.saveCollectedBatch(userId, items, {
          batchId,
          batchTitle,
          captureType: 'keyword',
          captureKeyword: kw,
        })

        for (const s of saved) {
          void hydrateMaterialFallbacks(s.id)
        }

        await onAfterCapture(batchId)
        setLastBatchResult({
          batchId,
          title: batchTitle,
          count: saved.length,
          items: saved,
        })
        toastSuccess(t('captureSuccessKeywordBatch', { count: saved.length, defaultValue: `抓取完成：成功获取 ${saved.length} 篇热门笔记/作品` }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('captureFailedGeneric', { defaultValue: '关键词抓取失败，请检查扩展程序运行状态' }))
    } finally {
      setIsSearching(false)
    }
  }

  // 2. 链接采集（支持单行与多行批量）
  const handleCollectLinks = async () => {
    if (!isConnected) {
      setError(t('captureNotConnectedError', { defaultValue: '插件未连接，请先在“安装与状态”页确认知源扩展已正常运行' }))
      return
    }
    const rawLines = urlInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (rawLines.length === 0) return

    setError('')
    setIsCapturingLinks(true)
    setLastBatchResult(null)

    const batchId = `batch_urls:${Date.now()}`
    const isSingle = rawLines.length === 1
    const batchTitle = isSingle ? t('captureSingleWorkFallback', { defaultValue: '链接单篇采集' }) : `${t('linksModeBatchBadge', { defaultValue: '批量链接采集' })} (${rawLines.length})`

    setLinkProgress({
      total: rawLines.length,
      current: 0,
      successCount: 0,
      failCount: 0,
    })

    const collectedItems: WorkbenchBridgeCollectedItem[] = []
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < rawLines.length; i++) {
      const u = rawLines[i]
      setLinkProgress({
        total: rawLines.length,
        current: i + 1,
        successCount,
        failCount,
        activeUrl: u,
      })

      try {
        const item = await extensionClient.resolveWork(u)
        collectedItems.push(item)
        successCount++
      } catch (err) {
        console.warn(`采集失败: ${u}`, err)
        failCount++
      }
    }

    setLinkProgress({
      total: rawLines.length,
      current: rawLines.length,
      successCount,
      failCount,
    })

    if (collectedItems.length > 0 && userId != null) {
      const saved = await materialRepository.saveCollectedBatch(userId, collectedItems, {
        batchId,
        batchTitle,
        captureType: isSingle ? 'single_url' : 'batch_urls',
      })

      for (const s of saved) {
        void hydrateMaterialFallbacks(s.id)
      }

      await onAfterCapture(batchId)
      setLastBatchResult({
        batchId,
        title: batchTitle,
        count: saved.length,
        items: saved,
      })
      setUrlInput('')

      if (isSingle) {
        const title = resolveCollectToastTitle(collectedItems[0]) || t('captureSingleWorkFallback', { defaultValue: '单篇作品' })
        toastSuccess(t('captureSuccessSingle', { title, defaultValue: `采集成功：${title}` }))
      } else {
        toastSuccess(t('captureSuccessBatchSummary', { success: successCount, fail: failCount, defaultValue: `批量采集完成：成功 ${successCount} 篇，失败 ${failCount} 篇` }))
      }
    } else if (collectedItems.length === 0) {
      setError(t('captureAllUrlsFailed', { defaultValue: '所有输入的链接均未能解析，请检查作品链接格式或确认在浏览器中已登录该平台。' }))
    }

    setIsCapturingLinks(false)
  }

  const captureSettingsSummary = useMemo(() => {
    const sortOptions =
      platform === 'bilibili'
        ? bilibiliSortOptions
        : platform === 'douyin'
          ? douyinSortOptions
          : xhsSortOptions
    const publishOptions =
      platform === 'bilibili' ? bilibiliPublishTimeOptions : standardPublishTimeOptions
    const limitLabel = t('filterLimitUnit', { count: limit, defaultValue: `${limit} 篇` })
    return [
      limitLabel,
      optionLabel(strategyOptions, strategy),
      optionLabel(sortOptions, sortType),
      optionLabel(publishOptions, publishTime),
    ].join(' · ')
  }, [
    bilibiliPublishTimeOptions,
    bilibiliSortOptions,
    douyinSortOptions,
    limit,
    platform,
    publishTime,
    sortType,
    strategy,
    strategyOptions,
    standardPublishTimeOptions,
    t,
    xhsSortOptions,
  ])

  return (
    <div className="space-y-4">
      {/* 模式一：关键词搜索采集（根据要求彻底重构：输入框放顶，底部平台胶囊选择，支持展开条件面板） */}
      {mode === 'keyword' && (
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
          {/* Section 1: 核心输入栏（大输入框 + 独立抓取按钮，并排无遮挡布局） */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={17} />
              <Input
                placeholder={t('searchKeywordPlaceholder', { defaultValue: '输入要抓取的关键词，按回车或点击右侧开始（如：AI副业 / 减脂食谱 / 穿搭公式 / 水煮肉片）' })}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSearching && keyword.trim()) {
                    void handleSearchKeyword()
                  }
                }}
                disabled={isSearching}
                className="h-11 w-full pl-10 pr-4 text-xs sm:text-sm bg-background shadow-xs focus:ring-primary/20 rounded-xl"
              />
            </div>
            <Button
              size="lg"
              onClick={handleSearchKeyword}
              disabled={isSearching || !keyword.trim() || !isConnected}
              className="h-11 px-5 text-xs sm:text-sm font-medium gap-1.5 shadow-xs shrink-0 rounded-xl"
            >
              {isSearching ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t('capturing', { defaultValue: '抓取中...' })}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {t('startCapture', { defaultValue: '开始抓取' })}
                </>
              )}
            </Button>
          </div>

          {/* Section 2: 目标平台胶囊选择（紧贴输入框下方，参考向导卡片风格） */}
          <div className="space-y-1.5 pt-0.5">
            <div className="text-xs text-muted-foreground px-0.5">
              <span>{t('selectTargetPlatform', { defaultValue: '选择采集目标平台：' })}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {platformChips.map((chip) => {
                const isSelected = platform === chip.id
                // 账号登录态判断
                const account = accounts?.find((acc) => acc.platformId === chip.id)
                const isLoggedIn = account?.status === 'logged_in'

                return (
                  <div
                    key={chip.id}
                    onClick={() => {
                      if (isLoggedIn) {
                        setPlatform(chip.id)
                      }
                    }}
                    className={`relative flex items-center gap-2.5 justify-between p-3 rounded-xl border text-left transition-all ${
                      !isLoggedIn
                        ? 'border-border/60 bg-muted/10 opacity-70 cursor-not-allowed'
                        : isSelected
                          ? `${chip.activeBorderClass} ring-1 ring-current shadow-xs cursor-pointer`
                          : 'border-border/70 bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground cursor-pointer'
                    }`}
                  >
                    <img
                      src={assetUrl(chip.brandIcon)}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 shrink-0 object-contain"
                      aria-hidden="true"
                      decoding="async"
                    />
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-foreground">{chip.name}</span>
                        {isLoggedIn ? (
                          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                            <CheckCircle2 size={10} /> {t('loggedIn', { defaultValue: '已登录' })}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10.5px] opacity-75 mt-0.5 truncate">{chip.tag}</div>
                    </div>

                    {isLoggedIn ? (
                      isSelected && (
                        <span className={`w-4 h-4 rounded-full ${chip.activeBadgeClass} flex items-center justify-center shrink-0`}>
                          <CheckCircle2 size={12} />
                        </span>
                      )
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1 shrink-0 font-medium text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onConnectAccount) {
                            void onConnectAccount(chip.id)
                          }
                        }}
                      >
                        {t('goLogin', { defaultValue: '去登录' })} <ExternalLink size={10} />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <section className="wb-capture-settings" aria-label={t('captureFiltersAria', { defaultValue: '采集条件' })}>
            <button
              type="button"
              className="wb-capture-settings__head"
              aria-expanded={captureSettingsOpen}
              onClick={() => setCaptureSettingsOpen((open) => !open)}
            >
              <span className="wb-capture-settings__head-main">
                <span className="wb-capture-settings__title">
                  {t('captureSettingsTitle', { defaultValue: '采集条件' })}
                </span>
                {!captureSettingsOpen ? (
                  <span className="wb-capture-settings__summary">{captureSettingsSummary}</span>
                ) : null}
              </span>
              <ChevronDown className="wb-capture-settings__chevron size-4" aria-hidden />
            </button>

            {captureSettingsOpen ? (
              <div className="wb-capture-settings__body">
                <div className="wb-capture-settings__grid">
                <div className={CAPTURE_SETTINGS_LIMIT_FIELD_CLASS}>
                  <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterLimitLabel', { defaultValue: '条数' })}</span>
                  <CaptureLimitField value={limit} onChange={setLimit} disabled={isSearching} />
                </div>

                <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                  <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterStrategyLabel', { defaultValue: '策略' })}</span>
                  <Select
                    items={strategyOptions}
                    value={strategy}
                    onValueChange={(v) => {
                      if (v) setStrategy(v as 'auto' | 'api' | 'rpa')
                    }}
                    disabled={isSearching}
                  >
                    <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {strategyOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                  <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterSortLabel', { defaultValue: '排序' })}</span>
                  {platform === 'bilibili' ? (
                    <Select
                      items={bilibiliSortOptions}
                      value={sortType}
                      onValueChange={(v) => {
                        if (v !== null) setSortType(v)
                      }}
                      disabled={isSearching}
                    >
                      <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {bilibiliSortOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : platform === 'douyin' ? (
                    <Select
                      items={douyinSortOptions}
                      value={sortType}
                      onValueChange={(v) => {
                        if (v) setSortType(v)
                      }}
                      disabled={isSearching}
                    >
                      <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {douyinSortOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      items={xhsSortOptions}
                      value={sortType}
                      onValueChange={(v) => {
                        if (v) setSortType(v)
                      }}
                      disabled={isSearching}
                    >
                      <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {xhsSortOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                  <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterPublishTimeLabel', { defaultValue: '时间' })}</span>
                  {platform === 'bilibili' ? (
                    <Select
                      items={bilibiliPublishTimeOptions}
                      value={publishTime}
                      onValueChange={(v) => {
                        if (v) setPublishTime(v)
                      }}
                      disabled={isSearching}
                    >
                      <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {bilibiliPublishTimeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      items={standardPublishTimeOptions}
                      value={publishTime}
                      onValueChange={(v) => {
                        if (v) setPublishTime(v)
                      }}
                      disabled={isSearching}
                    >
                      <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {standardPublishTimeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                  <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterMinLikesLabel', { defaultValue: '点赞' })}</span>
                  <Select
                    items={minLikesOptions}
                    value={minLikes}
                    onValueChange={(v) => {
                      if (v) setMinLikes(v)
                    }}
                    disabled={isSearching}
                  >
                    <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minLikesOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                  <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterMinCommentsLabel', { defaultValue: '评论' })}</span>
                  <Select
                    items={minCommentsOptions}
                    value={minComments}
                    onValueChange={(v) => {
                      if (v) setMinComments(v)
                    }}
                    disabled={isSearching}
                  >
                    <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {minCommentsOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 平台专属选项 */}
                {platform === 'xiaohongshu' && (
                  <>
                    <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                      <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterNoteTypeLabel', { defaultValue: '笔记' })}</span>
                      <Select
                        items={xhsNoteTypeOptions}
                        value={xhsNoteType}
                        onValueChange={(v) => {
                          if (v) setXhsNoteType(v)
                        }}
                        disabled={isSearching}
                      >
                        <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {xhsNoteTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                      <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterSearchRangeLabel', { defaultValue: '范围' })}</span>
                      <Select
                        items={xhsSearchRangeOptions}
                        value={xhsSearchRange}
                        onValueChange={(v) => {
                          if (v) setXhsSearchRange(v)
                        }}
                        disabled={isSearching}
                      >
                        <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {xhsSearchRangeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {platform === 'douyin' && (
                  <>
                    <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                      <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterContentTypeLabel', { defaultValue: '形式' })}</span>
                      <Select
                        items={douyinContentTypeOptions}
                        value={douyinContentType}
                        onValueChange={(v) => {
                          if (v) setDouyinContentType(v)
                        }}
                        disabled={isSearching}
                      >
                        <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {douyinContentTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                      <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterDurationLabel', { defaultValue: '时长' })}</span>
                      <Select
                        items={douyinDurationOptions}
                        value={douyinVideoDuration}
                        onValueChange={(v) => {
                          if (v) setDouyinVideoDuration(v)
                        }}
                        disabled={isSearching}
                      >
                        <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {douyinDurationOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {platform === 'bilibili' && (
                  <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                    <span className={CAPTURE_SETTINGS_LABEL_CLASS}>{t('filterDurationLabel', { defaultValue: '时长' })}</span>
                    <Select
                      items={bilibiliDurationOptions}
                      value={bilibiliDuration}
                      onValueChange={(v) => {
                        if (v) setBilibiliDuration(v)
                      }}
                      disabled={isSearching}
                    >
                      <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {bilibiliDurationOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                </div>
              </div>
            ) : null}
          </section>

          {/* 底部轻量提示 */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 px-0.5">
            <span>
              {t('captureTip', { defaultValue: '💡 提示：抓取前请确保浏览器已登录对应平台，未登录的平台无法直接发起抓取。' })}
            </span>
          </div>
        </div>
      )}

      {/* 模式二：链接采集 */}
      {mode === 'links' && (
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
          <div className="space-y-1.5">
            <textarea
              rows={4}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={isCapturingLinks}
              placeholder={t('linksInputPlaceholder', {
                defaultValue: `请粘贴作品链接，支持多行批量输入，例如：\nhttps://www.xiaohongshu.com/explore/64f123...\nhttps://v.douyin.com/idK1234/\nhttps://www.bilibili.com/video/BV1xx411...`,
              })}
              className="w-full rounded-xl border border-border/80 bg-background/80 p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono leading-relaxed resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>{t('linksInputCount', { count: urlInput.split('\n').filter((l) => l.trim()).length, defaultValue: `已输入 ${urlInput.split('\n').filter((l) => l.trim()).length} 条链接` })}</span>
              <span>{t('linksPrivacyNote', { defaultValue: '解析过程全在本地执行，Cookie 与隐私绝不上云' })}</span>
            </div>
          </div>

          {/* 批量进度指示 */}
          {linkProgress && linkProgress.total > 1 && (
            <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  {isCapturingLinks ? (
                    <Loader2 size={13} className="animate-spin text-primary" />
                  ) : (
                    <CheckCircle2 size={13} className="text-emerald-500" />
                  )}
                  {isCapturingLinks
                    ? t('linksParsingProgress', { current: linkProgress.current, total: linkProgress.total, defaultValue: `正在解析第 ${linkProgress.current} / ${linkProgress.total} 篇...` })
                    : t('linksParsingCompleted', { defaultValue: '批量解析完成' })}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {t('linksProgressSuccess', { defaultValue: '成功' })} <strong className="text-emerald-600">{linkProgress.successCount}</strong> · {t('linksProgressFail', { defaultValue: '失败' })}{' '}
                  <strong className="text-destructive">{linkProgress.failCount}</strong>
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${Math.round((linkProgress.current / linkProgress.total) * 100)}%`,
                  }}
                />
              </div>
              {linkProgress.activeUrl && isCapturingLinks && (
                <div className="text-[11px] text-muted-foreground truncate font-mono">
                  {t('linksReadingUrl', { url: linkProgress.activeUrl, defaultValue: `正在读取：${linkProgress.activeUrl}` })}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={isCapturingLinks || !urlInput}
              onClick={() => setUrlInput('')}
            >
              {t('clearInput', { defaultValue: '清空输入' })}
            </Button>
            <Button
              size="sm"
              onClick={handleCollectLinks}
              disabled={isCapturingLinks || !urlInput.trim() || !isConnected}
              className="gap-1.5 shadow-xs px-5"
            >
              {isCapturingLinks ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t('collectingLinks', { defaultValue: '正在抓取解析...' })}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {t('startCollectLinks', { defaultValue: '开始采集' })}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 最新采集成功任务卡片反馈 */}
      {lastBatchResult && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                {lastBatchResult.title}
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                  {t('batchResultSuccessBadge', { count: lastBatchResult.count, defaultValue: `成功沉淀 ${lastBatchResult.count} 篇素材` })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('batchResultSuccessDesc', { defaultValue: '素材已安全保存在工作台本机素材库中，并已打上该采集任务标签，可直接选用或一键查看。' })}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => onSwitchToMaterials(lastBatchResult.batchId)}
            className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-xs"
          >
            <Layers size={14} /> {t('viewBatchMaterials', { defaultValue: '查看本次素材' })} <ArrowRight size={14} />
          </Button>
        </div>
      )}
    </div>
  )
}
