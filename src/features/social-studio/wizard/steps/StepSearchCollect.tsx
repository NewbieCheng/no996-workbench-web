import { useState, useEffect, useRef, useMemo, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { notifyOperationError, notifyOperationWarning } from '@/lib/toast'

const WIZARD_SEARCH_TOAST_ID = 'social-wizard-search'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import {
  Search,
  Link2,
  FileText,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Flame,
  RefreshCw,
  UploadCloud,
  X,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Trash2,
  Eye,
  Info,
  ExternalLink,
  Puzzle,
  Download,
} from 'lucide-react'
import { cn } from '@no996/ui/utils'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@no996/ui/select'
import { isWorkbenchAiDemoMode } from '../../../../api/workbench-ai'
import { extensionClient } from '../../../../services/extension/extension-client'
import {
  REQUIRED_EXTENSION_VERSION,
  isExtensionOutdated,
} from '../../../../services/extension/extension-version'
import { mapCaptureErrorMessage } from '../../material-import/map-capture-error'
import {
  mockSearchWorks,
  mockResolveWork,
  mockResolveWechatWork,
} from '../../material-import/material-import-mock'
import { resolveWechatArticleByUrl } from '../../../../services/wechat-article/resolve-wechat-article-url'
import {
  clearMaterialCaptureSession,
  createEmptySession,
  mergeItemIntoSession,
  readMaterialCaptureSession,
  writeMaterialCaptureSession,
} from '../../material-import/material-capture-session-store'
import type {
  WorkbenchBridgeCollectedItem,
} from '../../../../services/extension/workbench-bridge-contract'
import type { CreationOrigin, IdeationTopicForm, ExpressionStyle } from '../types'
import { WizardLocalMaterialPicker } from '../WizardLocalMaterialPicker'
import {
  materialBodyImages,
  materialBodyText,
  materialCoverUrls,
  materialDisplayTitle,
} from '../../../extension/materials/material-media'
import type { SavedMaterial } from '../../../../services/materials/material-repository'
import { CaptureLimitField, clampCaptureLimit } from '../../../../components/CaptureLimitField'
import {
  CAPTURE_SETTINGS_FIELD_CLASS,
  CAPTURE_SETTINGS_LABEL_CLASS,
  CAPTURE_SETTINGS_LIMIT_FIELD_CLASS,
  CAPTURE_SETTINGS_TRIGGER_CLASS,
} from '../../../../components/capture-settings-shared'
import {
  XHS_CAPTURE_MIN_COMMENTS_OPTIONS,
  XHS_CAPTURE_NOTE_TYPE_DEFAULT,
  XHS_CAPTURE_NOTE_TYPE_OPTIONS,
  XHS_CAPTURE_SEARCH_RANGE_OPTIONS,
} from '../../../extension/capture/xhs-keyword-filter-options'

type StepSearchCollectProps = {
  platform: 'xhs' | 'wechat'
  onCollected: (
    items: WorkbenchBridgeCollectedItem[],
    singleWork: boolean,
    origin?: CreationOrigin,
  ) => void
  onTopicIdeation?: (form: IdeationTopicForm) => void
  initialKeyword?: string
  initialOrigin?: CreationOrigin
  onGoToAdvancedStudio?: () => void
}

type CollectInputMode = 'keyword' | 'link' | 'script_media' | 'ideation'

/** 公众号对标复刻：可一键填入的示例文章（仅作演示，正式抓取仍走 wechat_fetch） */
const WECHAT_EXAMPLE_LINKS = [
  {
    label: '云栖大会 · AI 产业',
    url: 'https://mp.weixin.qq.com/s/NNo5CgwPi5PHnbwUo3U93A',
  },
  {
    label: '示例长文 · 可一键填入',
    url: 'https://mp.weixin.qq.com/s/vOhT5ycDbhnsMiJ42o9pvg',
  },
] as const

// 真实小红书热搜备选数据（4 页共 32 条真实小红书爆款热点与细分领域高热选题）
interface RealHotItem {
  id: number
  title: string
  heat: string
  tag: '热' | '新' | '荐' | '爆'
}

const REAL_XHS_HOT_ITEMS: RealHotItem[] = [
  // Page 1: 爆款生活与旅行拍照
  { id: 1, title: '用万能旅行拍照姿势美美出片', heat: '942.5w', tag: '爆' },
  { id: 2, title: '耗时三年拍下古诗词里的中国', heat: '918.2w', tag: '热' },
  { id: 3, title: '我拍到了海鸥雨', heat: '889.4w', tag: '新' },
  { id: 4, title: '超日常快手美食教程速来get', heat: '875.1w', tag: '荐' },
  { id: 5, title: '定格这一刻的日照金山', heat: '863.3w', tag: '热' },
  { id: 6, title: '你可以永远相信赛里木湖的春景', heat: '851.8w', tag: '热' },
  { id: 7, title: '拼豆上也可以作画了', heat: '839.5w', tag: '新' },
  { id: 8, title: '我的家庭旅行更像是打副本', heat: '822.6w', tag: '荐' },

  // Page 2: 高效办公、副业与搞钱实操
  { id: 9, title: '普通人低成本用AI做图文全流程', heat: '798.2w', tag: '爆' },
  { id: 10, title: '早八人必存的10分钟快手出街法', heat: '782.4w', tag: '热' },
  { id: 11, title: '30岁离职做超级个体的一周年复盘', heat: '766.1w', tag: '荐' },
  { id: 12, title: '极简主义让我一年攒下10万', heat: '751.9w', tag: '新' },
  { id: 13, title: '新手做自媒体必须避开的7个坑', heat: '738.5w', tag: '热' },
  { id: 14, title: '独居女孩提升幸福感的平价小家电', heat: '724.8w', tag: '荐' },
  { id: 15, title: '那些相见恨晚的职场偷懒神器', heat: '711.3w', tag: '热' },
  { id: 16, title: '拒绝精神内耗：把生活调成静音', heat: '698.7w', tag: '新' },

  // Page 3: 变美减脂与穿搭公式
  { id: 17, title: '不节食两周掉秤5斤的低卡便当', heat: '685.4w', tag: '爆' },
  { id: 18, title: '梨形身材穿搭万能公式解救假胯宽', heat: '671.2w', tag: '热' },
  { id: 19, title: '适合手残党的自然妈生感伪素颜', heat: '659.8w', tag: '荐' },
  { id: 20, title: '换季皮肤维稳避雷看这一篇就够', heat: '647.3w', tag: '新' },
  { id: 21, title: '胶囊衣橱：15件单品搭出整个春天', heat: '632.9w', tag: '热' },
  { id: 22, title: '5分钟肩颈拉伸告别斜方肌富贵包', heat: '621.5w', tag: '荐' },
  { id: 23, title: '谁懂啊！这套平价香氛高级感拉满', heat: '608.1w', tag: '新' },
  { id: 24, title: '平价又好喝的自制低糖轻断食饮品', heat: '596.4w', tag: '热' },

  // Page 4: 认知成长与治愈生活
  { id: 25, title: '真正厉害的人是如何管理精力的', heat: '584.2w', tag: '爆' },
  { id: 26, title: '读完这5本书让我彻底戒掉拖延症', heat: '571.8w', tag: '荐' },
  { id: 27, title: '治愈系独居Vlog：雨天煮一碗热汤面', heat: '559.3w', tag: '热' },
  { id: 28, title: '表达能力差？学会这个说话逻辑框架', heat: '548.1w', tag: '新' },
  { id: 29, title: '让房间焕然一新的整理收纳动线', heat: '536.7w', tag: '荐' },
  { id: 30, title: '零基础也能画的治愈系水彩简笔画', heat: '525.4w', tag: '新' },
  { id: 31, title: '慢下来的生活美学：养一盆喜欢的植物', heat: '512.9w', tag: '热' },
  { id: 32, title: '情绪稳定是成年人最大的自律', heat: '499.6w', tag: '荐' },
]

const HOT_TOPIC_SUGGESTIONS = [
  '早八通勤如何又快又美',
  '普通人的AI搞钱实操工作流',
  '低成本一周不重样快手食谱',
  '大厂离职后做超级个体',
  '新手学做自媒体必须避开的坑',
  '极简生活改变我的10个习惯',
]

const EXPRESSION_STYLES: { id: ExpressionStyle; label: string; desc: string }[] = [
  { id: 'dry_goods', label: '干货清单', desc: '步骤分明、高收藏价值' },
  { id: 'seeding', label: '真诚种草', desc: '生活感强、容易引共鸣' },
  { id: 'story', label: '故事心路', desc: '个人经历、阅读留存高' },
  { id: 'review', label: '深度测评', desc: '客观对比、信任感强' },
]

export function StepSearchCollect({
  platform,
  onCollected,
  onTopicIdeation,
  initialKeyword = '',
  initialOrigin = 'benchmark_clone',
  onGoToAdvancedStudio,
}: StepSearchCollectProps) {
  const { t } = useTranslation('socialPublish')
  const demoMode = isWorkbenchAiDemoMode()

  // 灵感创作表单
  const [topicForm, setTopicForm] = useState<IdeationTopicForm>({
    topic: initialKeyword || '',
    expressionStyle: 'dry_goods',
    audience: '',
  })

  // 顶层平铺模式：若传入初始是灵感创作则默认 ideation，否则微信默认 link，小红书默认 keyword
  const [mode, setMode] = useState<CollectInputMode>(() => {
    if (initialOrigin === 'topic_ideation') return 'ideation'
    return platform === 'wechat' ? 'link' : 'keyword'
  })
  const [keyword, setKeyword] = useState(initialKeyword)
  const [linkUrl, setLinkUrl] = useState('')
  const [loading, setLoading] = useState(false)

  // 扩展插件状态与小红书登录态
  const [isConnected, setIsConnected] = useState(demoMode)
  const [extensionChecking, setExtensionChecking] = useState(false)
  const [, setXhsLoggedIn] = useState(demoMode)
  // 采集高级过滤参数（专属于小红书）
  const [limit, setLimit] = useState(5)
  const [sortType, setSortType] = useState('most_liked')
  const [minLikes, setMinLikes] = useState('any')
  const [minComments, setMinComments] = useState('any')
  const [xhsNoteType, setXhsNoteType] = useState(XHS_CAPTURE_NOTE_TYPE_DEFAULT)
  const [xhsSearchRange, setXhsSearchRange] = useState('all')
  const [publishTime, setPublishTime] = useState('all')

  // 全网实时热搜风向标折叠状态（默认收缩隐藏）与分页状态
  const [hotRankOpen, setHotRankOpen] = useState(true)
  const [hotRankPage, setHotRankPage] = useState(0) // 0-based page
  const [hotRankItems, setHotRankItems] = useState<RealHotItem[]>(REAL_XHS_HOT_ITEMS)
  const [hotRankLoading, setHotRankLoading] = useState(false)
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false)
  const [wechatLinkHelpOpen, setWechatLinkHelpOpen] = useState(false)

  // 粘贴文稿与草稿状态
  const [pastedContent, setPastedContent] = useState('')

  // 导入图片状态
  const [uploadedImages, setUploadedImages] = useState<{ url: string; name: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [linkDropActive, setLinkDropActive] = useState(false)
  const [mediaDropActive, setMediaDropActive] = useState(false)

  // 检查是否已有缓存抓取（tick 用于删除后强制重读 sessionStorage）
  const [cacheTick, setCacheTick] = useState(0)
  const existingSession = useMemo(() => {
    void cacheTick
    return readMaterialCaptureSession()
  }, [cacheTick])
  const hasCachedItems = Boolean(existingSession && existingSession.items.length > 0)
  /** 正式环境：找爆款与对标复刻依赖知源扩展；未连接时允许填写，点击开始再用 toast 提示 */
  const needsExtension = !demoMode && !isConnected

  const wizardSortOptions = useMemo(
    () => [
      { value: 'most_liked', label: '点赞多' },
      { value: 'general', label: '综合' },
      { value: 'latest', label: '最新' },
    ],
    [],
  )
  const wizardMinLikesOptions = useMemo(
    () => [
      { value: 'any', label: '不限' },
      { value: '100', label: '≥100' },
      { value: '500', label: '≥500' },
      { value: '1000', label: '≥1000' },
      { value: '5000', label: '≥5000' },
    ],
    [],
  )
  const wizardPublishTimeOptions = useMemo(
    () => [
      { value: 'all', label: '不限' },
      { value: 'day', label: '24h' },
      { value: 'week', label: '1周' },
      { value: 'month', label: '1月' },
      { value: 'half_year', label: '半年' },
    ],
    [],
  )
  const wizardMinCommentsOptions = useMemo(
    () =>
      XHS_CAPTURE_MIN_COMMENTS_OPTIONS.map((opt) => ({
        value: opt.value,
        label:
          opt.value === 'any'
            ? '不限'
            : opt.label.replace('至少 ', '≥').replace(' 条评论', ''),
      })),
    [],
  )
  const wizardNoteTypeOptions = useMemo(
    () =>
      XHS_CAPTURE_NOTE_TYPE_OPTIONS.map((opt) => ({
        value: opt.value,
        label:
          opt.value === 'all'
            ? '不限'
            : opt.value === 'video'
              ? '视频'
              : '图文',
      })),
    [],
  )
  const wizardSearchRangeOptions = useMemo(
    () =>
      XHS_CAPTURE_SEARCH_RANGE_OPTIONS.map((opt) => ({
        value: opt.value,
        label:
          opt.value === 'all'
            ? '不限'
            : opt.value === 'recently-viewed'
              ? '看过'
              : opt.value === 'not-viewed'
                ? '未看'
                : '关注',
      })),
    [],
  )

  const TOAST_GATE_MS = 10_000

  const promptExtensionRequired = () => {
    toast.error(t('extensionMissing'), {
      duration: TOAST_GATE_MS,
      action: {
        label: '去安装',
        onClick: () => {
          window.location.assign('/workbench/extension')
        },
      },
    })
  }

  const promptXhsLoginRequired = () => {
    toast.error('请先登录小红书账号后再开始探测', {
      duration: TOAST_GATE_MS,
      action: {
        label: '去登录',
        onClick: () => {
          void handleConnectXhs()
        },
      },
    })
  }

  const promptExtensionUpdateRequired = (current: string) => {
    toast.error(`当前插件 v${current || '?'} 过旧，请更新到 v${REQUIRED_EXTENSION_VERSION}`, {
      duration: TOAST_GATE_MS,
      action: {
        label: '去更新',
        onClick: () => {
          window.location.assign('/workbench/extension')
        },
      },
    })
  }

  async function ensureXhsExploreReady(): Promise<boolean> {
    if (demoMode) return true

    try {
      const status = await extensionClient.checkStatus(1200)
      const connected = Boolean(status.connected)
      setIsConnected(connected)
      if (!connected) {
        promptExtensionRequired()
        return false
      }
      if (isExtensionOutdated(status.extensionVersion)) {
        promptExtensionUpdateRequired(status.extensionVersion || '')
        return false
      }

      const accs = await extensionClient.listAccounts()
      const currentAcc = accs.find((a) => a.platformId === 'xiaohongshu')
      const loggedIn = currentAcc?.status === 'logged_in'
      setXhsLoggedIn(loggedIn)
      if (!loggedIn) {
        promptXhsLoginRequired()
        return false
      }

      return true
    } catch {
      promptExtensionRequired()
      return false
    }
  }

  async function refreshExtensionStatus(): Promise<boolean> {
    if (demoMode) {
      setIsConnected(true)
      setXhsLoggedIn(true)
      return true
    }
    setExtensionChecking(true)
    try {
      const status = await extensionClient.checkStatus(1200)
      const connected = Boolean(status.connected)
      setIsConnected(connected)
      if (connected) {
        const accs = await extensionClient.listAccounts()
        const currentAcc = accs.find((a) => a.platformId === 'xiaohongshu')
        setXhsLoggedIn(currentAcc?.status === 'logged_in')
      } else {
        setXhsLoggedIn(false)
      }
      return connected
    } catch {
      setIsConnected(false)
      setXhsLoggedIn(false)
      return false
    } finally {
      setExtensionChecking(false)
    }
  }

  // 查询知源插件状态与小红书登录状态；切回本页时再刷一次，避免「切采集页才识别」
  useEffect(() => {
    let mounted = true
    const refresh = () => {
      if (!mounted) return
      void refreshExtensionStatus()
    }
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [demoMode])

  // 尝试拉取真实小红书热搜接口（rebang.today）
  useEffect(() => {
    let mounted = true
    const fetchRealHot = async () => {
      try {
        setHotRankLoading(true)
        const res = await fetch(
          'https://api.rebang.today/v1/items?tab=xiaohongshu&sub_tab=hot-search&page=1&version=1',
          { cache: 'no-store' },
        )
        if (res.ok) {
          const json = await res.json()
          const list = json?.data?.list
          if (Array.isArray(list) && list.length > 0 && mounted) {
            const mapped: RealHotItem[] = list.slice(0, 32).map((it: any, index: number) => ({
              id: index + 1,
              title: it.title || it.word || '热门话题',
              heat: it.heat_str || (it.view_num ? `${it.view_num}` : '880w'),
              tag: it.label === '热' ? '热' : it.label === '新' ? '新' : index < 3 ? '爆' : '荐',
            }))
            setHotRankItems(mapped)
          }
        }
      } catch {
        // 浏览器跨域或离线静默使用 REAL_XHS_HOT_ITEMS
      } finally {
        if (mounted) setHotRankLoading(false)
      }
    }
    void fetchRealHot()
    return () => {
      mounted = false
    }
  }, [])

  // 连接/去登录小红书
  async function handleConnectXhs() {
    try {
      await extensionClient.connectAccount('xiaohongshu')
      setTimeout(async () => {
        try {
          const accs = await extensionClient.listAccounts()
          const currentAcc = accs.find((a) => a.platformId === 'xiaohongshu')
          setXhsLoggedIn(currentAcc?.status === 'logged_in')
        } catch {}
      }, 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      notifyOperationError(`打开登录页失败: ${message}`, { id: WIZARD_SEARCH_TOAST_ID, raw: true })
    }
  }

  // 关键词全自动探测采集（只面向小红书）
  async function handleSearch(searchKw: string) {
    const kw = searchKw.trim()
    if (!kw) {
      notifyOperationWarning('请输入搜索关键词', { id: WIZARD_SEARCH_TOAST_ID, raw: true })
      return
    }

    const ready = await ensureXhsExploreReady()
    if (!ready) return

    setLoading(true)

    const session = createEmptySession('keyword')
    session.query = kw
    session.status = 'running'
    writeMaterialCaptureSession(session)

    try {
      const parsedLimit = clampCaptureLimit(limit)
      const items = demoMode
        ? await mockSearchWorks(kw, parsedLimit)
        : await extensionClient.searchWorks({
            platformId: 'xiaohongshu',
            keyword: kw,
            limit: parsedLimit,
            filters: {
              publishWithin: publishTime === 'all' ? 'all' : (publishTime as any),
              sortType,
              minLikes: minLikes !== 'any' ? Number(minLikes) : undefined,
              minComments: minComments !== 'any' ? Number(minComments) : undefined,
              noteType: xhsNoteType !== 'all' ? xhsNoteType : undefined,
              searchRange: xhsSearchRange !== 'all' ? xhsSearchRange : undefined,
              collectMode: 'auto',
            },
          })

      if (!items || items.length === 0) {
        notifyOperationWarning('暂未抓取到相关内容，请尝试更换关键词或降低过滤条件', {
          id: WIZARD_SEARCH_TOAST_ID,
          raw: true,
        })
      } else {
        session.items = items
        session.status = 'done'
        session.progress = { done: items.length, total: items.length }
        writeMaterialCaptureSession(session)
        onCollected(items, false, 'benchmark_clone')
      }
    } catch (err: unknown) {
      const message = mapCaptureErrorMessage(err instanceof Error ? err.message : String(err))
      notifyOperationError(`抓取失败: ${message}`, { id: WIZARD_SEARCH_TOAST_ID, raw: true })
    } finally {
      setLoading(false)
    }
  }

  // 单条链接解析采集（公众号走服务端 wechat_fetch；小红书走浏览器扩展）
  async function handleResolveLink() {
    if (platform !== 'wechat' && needsExtension) {
      promptExtensionRequired()
      return
    }
    const url = linkUrl.trim()
    if (!url) {
      notifyOperationWarning(
        platform === 'wechat' ? '请输入有效的微信公众号文章链接' : '请输入有效的小红书笔记链接',
        { id: WIZARD_SEARCH_TOAST_ID, raw: true },
      )
      return
    }
    setLoading(true)

    const session = createEmptySession('link')
    session.query = url
    session.status = 'running'
    writeMaterialCaptureSession(session)

    try {
      const item =
        platform === 'wechat'
          ? demoMode
            ? await mockResolveWechatWork(url)
            : await resolveWechatArticleByUrl(url)
          : demoMode
            ? await mockResolveWork(url)
            : await extensionClient.resolveWork(url)
      const merged = mergeItemIntoSession(session, item)
      writeMaterialCaptureSession(merged)
      onCollected(merged.items, false, 'benchmark_clone')
    } catch (err: unknown) {
      const message = mapCaptureErrorMessage(err instanceof Error ? err.message : String(err))
      notifyOperationError(`链接解析失败: ${message}`, { id: WIZARD_SEARCH_TOAST_ID, raw: true })
    } finally {
      setLoading(false)
    }
  }

  // 提交自拟图文（统一文本内容 + 本地素材图片合并提交，自动提取标题与正文）
  function handleScriptAndMediaSubmit() {
    const rawText = pastedContent.trim()
    const hasImages = uploadedImages.length > 0

    if (!rawText && !hasImages) {
      notifyOperationWarning(
        platform === 'wechat'
          ? '请在此粘贴文稿内容或上传一张素材图片'
          : '请在此粘贴文案内容或上传一张本地图片',
        { id: WIZARD_SEARCH_TOAST_ID, raw: true },
      )
      return
    }

    // 智能自动提取标题与主体：若有多行取首行标题（清理前导#等符号），其余为正文
    let autoTitle = ''
    let autoBody = rawText
    if (rawText) {
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length > 0) {
        const firstLineClean = lines[0].replace(/^[#\s*>\-0-9.、【】「」]+/, '').trim()
        if (firstLineClean.length <= 40) {
          autoTitle = firstLineClean
          autoBody = lines.length > 1 ? lines.slice(1).join('\n\n') : rawText
        } else {
          autoTitle = firstLineClean.slice(0, 30)
          autoBody = rawText
        }
      }
    }

    const fallbackTitle = platform === 'wechat' ? '微信长文排版' : '小红书图文素材'
    const finalTitle = autoTitle || fallbackTitle

    const customItem: WorkbenchBridgeCollectedItem = {
      url: `local://custom-${Date.now()}`,
      platformId: platform === 'wechat' ? 'weixin' : 'xiaohongshu',
      title: finalTitle,
      content:
        autoBody ||
        (platform === 'wechat'
          ? '这是基于本地上传素材图片创建的微信图文文章。'
          : '这是基于本地上传素材图片创建的小红书图文。'),
      author: '自备素材',
      coverUrl: uploadedImages[0]?.url,
      imageUrls: uploadedImages.map((img) => img.url),
      collectedAt: Date.now(),
    }

    onCollected([customItem], true, 'benchmark_clone')
  }

  // 本地图片选择
  function handleImageFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return
    const newItems: { url: string; name: string }[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.type.startsWith('image/')) {
        newItems.push({
          url: URL.createObjectURL(f),
          name: f.name,
        })
      }
    }
    setUploadedImages((prev) => [...prev, ...newItems])
  }

  function handleRemoveImage(idx: number) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx))
  }

  function handlePickSavedMaterial(mat: SavedMaterial) {
    const title = materialDisplayTitle(mat)
    const body = materialBodyText(mat)
    const text =
      body && title && body !== title && !body.startsWith(title)
        ? `${title}\n\n${body}`
        : body || title
    setPastedContent(text)
    const imageUrls = [...new Set([...materialCoverUrls(mat), ...materialBodyImages(mat)].filter(Boolean))]
    setUploadedImages(
      imageUrls.map((url, index) => ({
        url,
        name: `素材图 ${index + 1}`,
      })),
    )
  }

  function extractDroppedUrl(dataTransfer: DataTransfer): string {
    const raw = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain')
    const line = raw.split('\n').map((s) => s.trim()).find((s) => s && !s.startsWith('#'))
    return line ?? ''
  }

  function handleStepDragOver(event: DragEvent) {
    if (mode === 'link') {
      event.preventDefault()
      setLinkDropActive(true)
      return
    }
    if (mode === 'script_media') {
      event.preventDefault()
      setMediaDropActive(true)
    }
  }

  function handleStepDragLeave(event: DragEvent) {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return
    setLinkDropActive(false)
    setMediaDropActive(false)
  }

  function handleStepDrop(event: DragEvent) {
    event.preventDefault()
    setLinkDropActive(false)
    setMediaDropActive(false)
    if (mode === 'link') {
      const url = extractDroppedUrl(event.dataTransfer)
      if (url) {
        setLinkUrl(url)
      }
      return
    }
    if (mode === 'script_media' && event.dataTransfer.files.length > 0) {
      handleImageFilesSelected(event.dataTransfer.files)
    }
  }

  // 恢复历史会话（先进选择爆款，不直跳模板）
  function handleRestoreCachedSession() {
    if (!existingSession || existingSession.items.length === 0) return
    onCollected(existingSession.items, false, 'benchmark_clone')
  }

  function handleClearCachedSession() {
    clearMaterialCaptureSession()
    setCacheTick((n) => n + 1)
  }

  // 分页计算
  const pageSize = 8
  const totalPages = Math.ceil(hotRankItems.length / pageSize)
  const currentHotPageItems = hotRankItems.slice(
    hotRankPage * pageSize,
    (hotRankPage + 1) * pageSize,
  )

  return (
    <div
      className={`social-studio-wizard-step-search${
        linkDropActive ? ' social-studio-wizard-step-search--link-drop' : ''
      }${mediaDropActive ? ' social-studio-wizard-step-search--media-drop' : ''}`}
      onDragOver={handleStepDragOver}
      onDragLeave={handleStepDragLeave}
      onDrop={handleStepDrop}
    >
      <header className="ssw-step-head">
        <h2 className="ssw-step-title">第 1 步：选择您的创作起点</h2>
        <p className="ssw-step-lead">找爆款、对标复刻或导入素材，选一个起点即可。</p>
      </header>

      <div className="ssw-mode-rail-wrap">
        <div className="ssw-mode-rail" role="tablist" aria-label="创作起点">
        {platform === 'xhs' && (
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'keyword'}
            onClick={() => {
              setMode('keyword')
            }}
            className={`ssw-mode-btn${mode === 'keyword' ? ' ssw-mode-btn--active' : ''}`}
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span>找爆款</span>
          </button>
        )}

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'link'}
          onClick={() => {
            setMode('link')
          }}
          className={`ssw-mode-btn${mode === 'link' ? ' ssw-mode-btn--active' : ''}`}
        >
          <Link2 className="size-4 shrink-0" aria-hidden />
          <span>对标复刻</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'script_media'}
          onClick={() => {
            setMode('script_media')
          }}
          className={`ssw-mode-btn${mode === 'script_media' ? ' ssw-mode-btn--active' : ''}`}
        >
          <FileText className="size-4 shrink-0" aria-hidden />
          <span>导入素材</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'ideation'}
          onClick={() => {
            if (onGoToAdvancedStudio) {
              onGoToAdvancedStudio()
            } else {
              setMode('ideation')
            }
          }}
          className={`ssw-mode-btn ssw-mode-btn--spark${
            mode === 'ideation' ? ' ssw-mode-btn--active' : ''
          }`}
        >
          <span className="ssw-mode-btn__new" aria-hidden="true">NEW</span>
          <Sparkles className="size-4 shrink-0 text-primary/80" aria-hidden />
          <span>AI 主题灵感创作</span>
        </button>
        </div>
      </div>

      {mode !== 'ideation' && (
        <div className="ssw-body space-y-3.5">

          {platform === 'xhs' && needsExtension ? (
            <div className="ssw-extension-banner" role="status">
              <div className="ssw-extension-banner__icon" aria-hidden>
                <Puzzle size={15} />
              </div>
              <div className="ssw-extension-banner__body">
                <p className="ssw-extension-banner__title">找爆款 / 链接对标需要知源浏览器扩展</p>
                <p className="ssw-extension-banner__desc">
                  请先安装并启用扩展，再开始关键词探测或单链接采集；登录态仅保存在本机浏览器。
                </p>
              </div>
              <div className="ssw-extension-banner__actions">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={extensionChecking}
                  onClick={() => void refreshExtensionStatus()}
                >
                  {extensionChecking ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                  <span>重新检测</span>
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    window.location.assign('/workbench/extension')
                  }}
                >
                  <Download size={13} />
                  <span>去安装</span>
                </Button>
              </div>
            </div>
          ) : null}

          {/* 子模式 1：关键词探测爆款（小红书专属） */}
          {mode === 'keyword' && platform === 'xhs' && (
            <div className="w-full">
              <div className="ssw-panel space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <PopoverPrimitive.Root
                    open={searchFiltersOpen}
                    onOpenChange={setSearchFiltersOpen}
                    modal={false}
                  >
                    <div className="relative flex-1 min-w-0">
                      <Search
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-[1]"
                        size={17}
                      />
                      <Input
                        placeholder="输入小红书搜索关键词（如：早八好物 / 职场逆袭 / AI工具 / 减脂食谱）"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !loading && keyword.trim()) {
                            void handleSearch(keyword)
                          }
                        }}
                        disabled={loading}
                        className="h-11 w-full pl-10 pr-11 text-xs sm:text-sm bg-background shadow-xs focus:ring-primary/20 rounded-xl"
                      />
                      <PopoverPrimitive.Trigger
                        render={
                          <button
                            type="button"
                            className={cn(
                              'ssw-search-filters-trigger absolute right-2 top-1/2 z-[2] -translate-y-1/2',
                              searchFiltersOpen && 'is-open',
                            )}
                            aria-label="搜索条件"
                            disabled={loading}
                          />
                        }
                      >
                        <SlidersHorizontal size={16} aria-hidden />
                      </PopoverPrimitive.Trigger>
                    </div>
                    <PopoverPrimitive.Portal>
                      <PopoverPrimitive.Positioner
                        side="bottom"
                        align="end"
                        sideOffset={10}
                        collisionPadding={16}
                        className="ssw-search-filters-popover__positioner"
                      >
                        <PopoverPrimitive.Popup
                          className="ssw-search-filters-popover"
                          role="dialog"
                          aria-label="搜索条件"
                        >
                          <div className="ssw-search-filters-form">
                              <div className={CAPTURE_SETTINGS_LIMIT_FIELD_CLASS}>
                                <span className={CAPTURE_SETTINGS_LABEL_CLASS}>条数</span>
                                <CaptureLimitField
                                  value={limit}
                                  onChange={setLimit}
                                  disabled={loading}
                                  className="ssw-capture-limit"
                                />
                              </div>
                              <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                                <span className={CAPTURE_SETTINGS_LABEL_CLASS}>排序</span>
                                <Select items={wizardSortOptions} value={sortType} onValueChange={setSortType}>
                                  <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {wizardSortOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                                <span className={CAPTURE_SETTINGS_LABEL_CLASS}>点赞</span>
                                <Select items={wizardMinLikesOptions} value={minLikes} onValueChange={setMinLikes}>
                                  <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {wizardMinLikesOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                                <span className={CAPTURE_SETTINGS_LABEL_CLASS}>时间</span>
                                <Select
                                  items={wizardPublishTimeOptions}
                                  value={publishTime}
                                  onValueChange={setPublishTime}
                                >
                                  <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {wizardPublishTimeOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                                <span className={CAPTURE_SETTINGS_LABEL_CLASS}>评论</span>
                                <Select
                                  items={wizardMinCommentsOptions}
                                  value={minComments}
                                  onValueChange={setMinComments}
                                >
                                  <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {wizardMinCommentsOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                                <span className={CAPTURE_SETTINGS_LABEL_CLASS}>笔记</span>
                                <Select
                                  items={wizardNoteTypeOptions}
                                  value={xhsNoteType}
                                  onValueChange={setXhsNoteType}
                                >
                                  <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {wizardNoteTypeOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className={CAPTURE_SETTINGS_FIELD_CLASS}>
                                <span className={CAPTURE_SETTINGS_LABEL_CLASS}>范围</span>
                                <Select
                                  items={wizardSearchRangeOptions}
                                  value={xhsSearchRange}
                                  onValueChange={setXhsSearchRange}
                                >
                                  <SelectTrigger className={CAPTURE_SETTINGS_TRIGGER_CLASS}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {wizardSearchRangeOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                          </div>
                        </PopoverPrimitive.Popup>
                      </PopoverPrimitive.Positioner>
                    </PopoverPrimitive.Portal>
                  </PopoverPrimitive.Root>
                  <Button
                    size="lg"
                    onClick={() => handleSearch(keyword)}
                    disabled={loading || !keyword.trim()}
                    className="h-11 px-5 text-xs sm:text-sm font-medium gap-1.5 shadow-xs shrink-0 rounded-xl"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>后台采集中，无需切换标签…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>开始探测</span>
                      </>
                    )}
                  </Button>
                </div>

              <section className="ssw-hot-rank" aria-label="小红书热搜灵感">
                <button
                  type="button"
                  className="ssw-hot-rank__toggle"
                  aria-expanded={hotRankOpen}
                  onClick={() => setHotRankOpen((prev) => !prev)}
                >
                  <span className="ssw-hot-rank__title">
                    <Flame size={13} className="text-red-500 shrink-0" aria-hidden />
                    <span>热搜灵感</span>
                    <span className="ssw-hot-rank__hint">点词条填入关键词</span>
                  </span>
                  <span className="ssw-hot-rank__chevron" aria-hidden>
                    {hotRankOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {hotRankOpen ? (
                  <div className="ssw-hot-rank__body">
                    <div className="ssw-hot-rank__toolbar">
                      <span>
                        第 {hotRankPage + 1}/{totalPages} 页
                        {hotRankLoading ? (
                          <RefreshCw size={11} className="inline ml-1 animate-spin" aria-hidden />
                        ) : null}
                      </span>
                      <div className="ssw-hot-rank__pager">
                        <button
                          type="button"
                          className="ssw-hot-rank__pager-btn"
                          disabled={hotRankPage === 0}
                          onClick={() => setHotRankPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft size={12} aria-hidden />
                          上一页
                        </button>
                        <button
                          type="button"
                          className="ssw-hot-rank__pager-btn"
                          disabled={hotRankPage >= totalPages - 1}
                          onClick={() => setHotRankPage((p) => Math.min(totalPages - 1, p + 1))}
                        >
                          下一页
                          <ChevronRight size={12} aria-hidden />
                        </button>
                      </div>
                    </div>

                    <ul className="ssw-hot-rank__list">
                      {currentHotPageItems.map((item, idx) => {
                        const globalIndex = hotRankPage * pageSize + idx + 1
                        const rankLabel = globalIndex < 10 ? `0${globalIndex}` : String(globalIndex)
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              className="ssw-hot-rank__item"
                              onClick={() => {
                                setKeyword(item.title)
                              }}
                            >
                              <span className="ssw-hot-rank__item-main">
                                <span
                                  className={`ssw-hot-rank__rank${
                                    globalIndex <= 3 ? ' ssw-hot-rank__rank--top' : ''
                                  }`}
                                >
                                  {rankLabel}
                                </span>
                                <span className="ssw-hot-rank__label">{item.title}</span>
                              </span>
                              <span className="ssw-hot-rank__meta">{item.heat}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
              </section>
              </div>
            </div>
          )}

          {/* 子模式 2：单链接解析采集 */}
          {mode === 'link' && (
            <div className="w-full space-y-4">
              <div
                className={`ssw-panel space-y-4${
                  linkDropActive ? ' ssw-panel--drop-active' : ''
                }`}
              >
                <div className="space-y-3">
                  {platform !== 'wechat' ? (
                    <div className="min-w-0 space-y-0.5">
                      <label className="text-xs font-semibold text-foreground">
                        输入小红书单篇笔记链接
                      </label>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        支持 xhslink.com 或网页链接
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    {platform === 'wechat' ? (
                      <PopoverPrimitive.Root
                        open={wechatLinkHelpOpen}
                        onOpenChange={setWechatLinkHelpOpen}
                        modal={false}
                      >
                        <div className="relative flex-1 min-w-0">
                          <Link2
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-[1]"
                            size={17}
                          />
                          <Input
                            placeholder="粘贴微信公众号文章链接，如 https://mp.weixin.qq.com/s/..."
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' || loading) return
                              if (linkUrl.trim()) void handleResolveLink()
                            }}
                            disabled={loading}
                            className="h-11 w-full pl-10 pr-11 text-xs sm:text-sm bg-background shadow-xs focus:ring-primary/20 rounded-xl"
                          />
                          <PopoverPrimitive.Trigger
                            render={
                              <button
                                type="button"
                                className={cn(
                                  'ssw-search-filters-trigger absolute right-2 top-1/2 z-[2] -translate-y-1/2',
                                  wechatLinkHelpOpen && 'is-open',
                                )}
                                aria-label="如何获取文章链接"
                                disabled={loading}
                              />
                            }
                          >
                            <Info size={16} aria-hidden />
                          </PopoverPrimitive.Trigger>
                        </div>
                        <PopoverPrimitive.Portal>
                          <PopoverPrimitive.Positioner
                            side="bottom"
                            align="end"
                            sideOffset={10}
                            collisionPadding={16}
                            className="ssw-wechat-link-help__positioner"
                          >
                            <PopoverPrimitive.Popup
                              className="ssw-wechat-link-help"
                              role="dialog"
                              aria-label="如何获取文章链接"
                            >
                              <p className="ssw-wechat-link-help__title">如何复制文章链接</p>
                              <ol className="ssw-wechat-link-help__steps">
                                <li>微信里打开目标公众号文章</li>
                                <li>
                                  点右上角 <strong>···</strong>，选「用默认浏览器打开」或「复制链接」
                                </li>
                                <li>回到此处粘贴，点「一键采集导入」</li>
                              </ol>
                              <div className="ssw-wechat-link-help__examples">
                                <span className="ssw-wechat-link-help__examples-label">试试示例</span>
                                <div className="ssw-wechat-link-help__chips">
                                  {WECHAT_EXAMPLE_LINKS.map((example) => (
                                    <button
                                      key={example.url}
                                      type="button"
                                      className="ssw-wechat-link-help__chip"
                                      disabled={loading}
                                      onClick={() => {
                                        setLinkUrl(example.url)
                                        setWechatLinkHelpOpen(false)
                                      }}
                                    >
                                      <ExternalLink size={12} aria-hidden />
                                      <span>{example.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </PopoverPrimitive.Popup>
                          </PopoverPrimitive.Positioner>
                        </PopoverPrimitive.Portal>
                      </PopoverPrimitive.Root>
                    ) : (
                      <div className="relative flex-1 min-w-0">
                        <Link2
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                          size={17}
                        />
                        <Input
                          placeholder="粘贴小红书笔记链接，如 http://xhslink.com/... 或网页链接"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' || loading) return
                            if (linkUrl.trim()) void handleResolveLink()
                          }}
                          disabled={loading}
                          className="h-11 w-full pl-10 pr-4 text-xs sm:text-sm bg-background shadow-xs focus:ring-primary/20 rounded-xl"
                        />
                      </div>
                    )}
                    <Button
                      size="lg"
                      onClick={() => void handleResolveLink()}
                      disabled={loading || !linkUrl.trim()}
                      className="h-11 px-5 text-xs sm:text-sm font-medium gap-1.5 shadow-xs shrink-0 rounded-xl"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>解析抓取中...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>一键采集导入</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === 'script_media' && (
            <div className="w-full space-y-3.5">
              <div className="ssw-panel space-y-5 sm:p-5">
                <WizardLocalMaterialPicker platform={platform} onPick={handlePickSavedMaterial} />
                <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
                  <div className="flex w-full min-w-0 flex-col space-y-2 sm:w-[38%] sm:max-w-[360px] sm:shrink-0">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <UploadCloud size={14} className="text-primary" />
                        <span>
                          {platform === 'wechat'
                            ? '附件图文素材（选填）'
                            : '附件配图素材（选填）'}
                        </span>
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        已选 {uploadedImages.length} 张图片
                      </span>
                    </div>

                    {/* 图片预览与添加区域：有图片时展示网格，无图片时展示友好大拖拽卡片 */}
                    <div className="flex-1 min-h-[220px] rounded-xl border border-border/70 bg-muted/20 p-3 flex flex-col justify-start">
                      {uploadedImages.length === 0 ? (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => fileInputRef.current?.click()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              fileInputRef.current?.click()
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setMediaDropActive(true)
                          }}
                          onDragLeave={(e) => {
                            if (e.currentTarget.contains(e.relatedTarget as Node)) return
                            setMediaDropActive(false)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            setMediaDropActive(false)
                            handleImageFilesSelected(e.dataTransfer.files)
                          }}
                          className={`flex-1 min-h-[190px] rounded-lg border-2 border-dashed bg-background/50 flex flex-col items-center justify-center p-4 text-center transition-all cursor-pointer group ${
                            mediaDropActive
                              ? 'border-primary bg-primary/5'
                              : 'border-border/80 hover:border-primary/60 hover:bg-primary/5'
                          }`}
                        >
                          <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                            <UploadCloud size={20} />
                          </div>
                          <p className="text-xs font-semibold text-foreground">点击或拖拽上传本地图片</p>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-normal max-w-[200px]">
                            支持 JPG、PNG、WebP，可一次多选批量上传
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2.5 overflow-y-auto max-h-[260px] p-0.5">
                          {uploadedImages.map((img, idx) => (
                            <div
                              key={img.url}
                              className="group relative aspect-square rounded-lg overflow-hidden border border-border/80 bg-muted shadow-2xs"
                            >
                              <img
                                src={img.url}
                                alt={img.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 cursor-pointer"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-lg border border-dashed border-border/80 hover:border-primary/60 bg-background hover:bg-primary/5 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-all cursor-pointer shadow-2xs"
                          >
                            <UploadCloud size={16} />
                            <span className="text-[10px] font-medium">继续添加</span>
                          </button>
                        </div>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageFilesSelected(e.target.files)}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText size={14} className="text-primary" />
                        <span>
                          {platform === 'wechat'
                            ? '创作主题或文稿草稿（直接粘贴）'
                            : '创作主题或笔记文案（直接粘贴）'}
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        {pastedContent && (
                          <button
                            type="button"
                            onClick={() => setPastedContent('')}
                            className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            清空
                          </button>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {pastedContent.length} 字
                        </span>
                      </div>
                    </div>
                    <Textarea
                      rows={10}
                      placeholder={
                        platform === 'wechat'
                          ? '在此直接粘贴文章草稿、主题想法、长文或采访笔记，系统将自动提炼标题并为您智能拆解排版...'
                          : '在此直接粘贴主题想法、笔记草稿、爆款文案或脚本，系统将自动解析标题并拆解为分镜图文与封面...'
                      }
                      value={pastedContent}
                      onChange={(e) => setPastedContent(e.target.value)}
                      className="text-xs sm:text-sm rounded-xl bg-background leading-relaxed shadow-2xs flex-1 min-h-[220px] resize-y"
                    />
                  </div>
                </div>

                {/* 底部全宽操作栏 */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3.5 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground">
                    提示：输入文本或上传图片后，系统将自动解析标题与正文并进入模板排版。
                  </p>
                  <Button
                    onClick={handleScriptAndMediaSubmit}
                    disabled={!pastedContent.trim() && uploadedImages.length === 0}
                    className="gap-1.5 h-10 px-6 font-medium text-xs sm:text-sm rounded-xl shrink-0"
                  >
                    <span>自动解析并进入排版</span>
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 历史缓存提示 */}
          {hasCachedItems && (
            <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl border border-border/60 bg-muted/30 text-xs">
              <span className="text-muted-foreground min-w-0">
                检测到上次探测的 {existingSession?.items.length} 篇参考素材
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRestoreCachedSession}
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="查看上次抓取结果"
                >
                  <Eye size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearCachedSession}
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label="删除上次抓取缓存"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================= 分支 B：AI 主题灵感创作流程 ======================= */}
      {mode === 'ideation' && (
        <div className="ssw-body ssw-panel w-full space-y-5">
          <div className="space-y-1.5 border-b border-border/60 pb-3">
            <h3 className="text-base font-bold text-foreground">
              给出一个主题，AI 现场为您策划爆款视角
            </h3>
            <p className="text-xs text-muted-foreground">
              无需提前准备任何素材或链接，AI 将根据您的主题智能推演 3 个高点击率切入点供您挑选。
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              我想写的主题或行业（必填）
            </label>
            <Input
              value={topicForm.topic}
              onChange={(e) => setTopicForm((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="例如：早八好物、AI工具、减脂食谱、职场向上管理、独居生活日常"
              className="h-11 rounded-xl text-xs sm:text-sm bg-background shadow-2xs"
            />
            {/* 灵感标签快捷填入 */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground font-medium">热门灵感：</span>
              {HOT_TOPIC_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setTopicForm((prev) => ({ ...prev, topic: sug }))}
                  className="text-[11px] px-2.5 py-0.5 rounded-full border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-muted-foreground cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">表达方式与文风偏好</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {EXPRESSION_STYLES.map((style) => (
                <div
                  key={style.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTopicForm((prev) => ({ ...prev, expressionStyle: style.id }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setTopicForm((prev) => ({ ...prev, expressionStyle: style.id }))
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    topicForm.expressionStyle === style.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border/60 bg-muted/10 hover:border-border'
                  }`}
                >
                  <div className="font-semibold text-xs text-foreground">{style.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{style.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">目标读者画像（选填）</label>
            <Input
              value={topicForm.audience || ''}
              onChange={(e) => setTopicForm((prev) => ({ ...prev, audience: e.target.value }))}
              placeholder="例如：刚入职场的早八人、考研大学生、追求高品质的独居女生"
              className="h-10 rounded-xl text-xs sm:text-sm bg-background"
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-border/60">
            <Button
              size="lg"
              disabled={!topicForm.topic.trim()}
              onClick={() => {
                if (onTopicIdeation) {
                  onTopicIdeation(topicForm)
                }
              }}
              className="gap-2 px-6 h-11 rounded-xl text-xs sm:text-sm font-semibold shadow-xs"
            >
              <Sparkles size={15} />
              <span>智能推演 3 个高赞切入点</span>
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}
