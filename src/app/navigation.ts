import {
  AudioLines,
  BadgeHelp,
  Clapperboard,
  Film,
  Folder,
  Globe,
  House,
  Images,
  Mic,
  Monitor,
  Package,
  Palette,
  PenLine,
  Presentation,
  Puzzle,
  Scissors,
  ShieldCheck,
  SquareTerminal,
  Target,
  TrendingUp,
  UserRound,
  CreditCard,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import {
  WORKBENCH_BRAND_AUDIO_VIDEO,
  WORKBENCH_BRAND_WECHAT,
  WORKBENCH_BRAND_WECHAT_MOMENTS,
  WORKBENCH_BRAND_XIAOHONGSHU,
} from './workbench-brand-assets'

export type PageId =
  | 'home'
  | 'persona'
  | 'product-position'
  | 'titles'
  | 'video-script'
  | 'live-script'
  | 'xiaohongshu'
  | 'wechat-article'
  | 'moments'
  | 'voice'
  | 'digital-human'
  | 'ip-video'
  | 'video-factory'
  | 'extension'
  | 'account'
  | 'membership'

export type DesktopNavId =
  | 'desktop-product'
  | 'desktop-product-marketing'
  | 'desktop-ppt'
  | 'desktop-ecom-visual'
  | 'desktop-promo-key-visual'
  | 'desktop-compliance'
  | 'desktop-files'
  | 'desktop-terminal'
  | 'desktop-computer-use'
  | 'desktop-browser'
  | 'desktop-ai-video-edit'

export type NavItemId = PageId | DesktopNavId

export type NavAvailability = 'demo' | 'pending' | 'desktop'

export type NavItem = {
  id: NavItemId
  /** i18n key under `workbench` namespace */
  labelKey: string
  /** i18n key for short description under `workbench` namespace */
  descriptionKey: string
  group: string
  /** i18n key for group title; empty = top-level (home) */
  groupKey?: string
  icon: LucideIcon
  /** Full-color mark from `public/`; overrides stroke icon when set. */
  brandIcon?: string
  path?: string
  availability: NavAvailability
  /** Small label beside the title in the sidebar (e.g. Beta). */
  badge?: 'beta'
}

export const DESKTOP_ONLY_GROUP = '桌面端专属'
export const DESKTOP_ONLY_GROUP_KEY = 'navGroupDesktopOnly'

export const navigation: NavItem[] = [
  {
    id: 'home',
    labelKey: 'navHome',
    descriptionKey: 'navDescHome',
    group: '',
    icon: House,
    path: '/workbench',
    availability: 'demo',
  },
  {
    id: 'persona',
    labelKey: 'navPersona',
    descriptionKey: 'navDescPersona',
    group: '内容创作',
    groupKey: 'navGroupContent',
    icon: UserRound,
    path: '/workbench/persona',
    availability: 'demo',
  },
  {
    id: 'product-position',
    labelKey: 'navProductPosition',
    descriptionKey: 'navDescProductPosition',
    group: '内容创作',
    groupKey: 'navGroupContent',
    icon: Target,
    path: '/workbench/product-position',
    availability: 'demo',
    badge: 'beta',
  },
  {
    id: 'titles',
    labelKey: 'navTitles',
    descriptionKey: 'navDescTitles',
    group: '内容创作',
    groupKey: 'navGroupContent',
    icon: BadgeHelp,
    path: '/workbench/titles',
    availability: 'demo',
  },
  {
    id: 'video-script',
    labelKey: 'navVideoScript',
    descriptionKey: 'navDescVideoScript',
    group: '内容创作',
    groupKey: 'navGroupContent',
    icon: Clapperboard,
    path: '/workbench/video-script',
    availability: 'demo',
  },
  {
    id: 'live-script',
    labelKey: 'navLiveScript',
    descriptionKey: 'navDescLiveScript',
    group: '内容创作',
    groupKey: 'navGroupContent',
    icon: Mic,
    path: '/workbench/live-script',
    availability: 'demo',
  },
  {
    id: 'xiaohongshu',
    labelKey: 'navXiaohongshu',
    descriptionKey: 'navDescXiaohongshu',
    group: '内容创作',
    groupKey: 'navGroupContent',
    icon: PenLine,
    brandIcon: WORKBENCH_BRAND_XIAOHONGSHU,
    path: '/workbench/xiaohongshu',
    availability: 'demo',
    badge: 'beta',
  },
  {
    id: 'wechat-article',
    labelKey: 'navWechatArticle',
    descriptionKey: 'navDescWechatArticle',
    group: '内容创作',
    groupKey: 'navGroupContent',
    icon: PenLine,
    brandIcon: WORKBENCH_BRAND_WECHAT,
    path: '/workbench/wechat-article',
    availability: 'demo',
    badge: 'beta',
  },
  {
    id: 'moments',
    labelKey: 'navMoments',
    descriptionKey: 'navDescMoments',
    group: '内容创作',
    groupKey: 'navGroupContent',
    icon: Images,
    brandIcon: WORKBENCH_BRAND_WECHAT_MOMENTS,
    path: '/workbench/moments',
    availability: 'demo',
    badge: 'beta',
  },
  {
    id: 'voice',
    labelKey: 'navVoice',
    descriptionKey: 'navDescVoice',
    group: '音视频',
    groupKey: 'navGroupAv',
    icon: AudioLines,
    path: '/workbench/voice',
    availability: 'demo',
  },
  {
    id: 'digital-human',
    labelKey: 'navDigitalHuman',
    descriptionKey: 'navDescDigitalHuman',
    group: '音视频',
    groupKey: 'navGroupAv',
    icon: UserRound,
    path: '/workbench/digital-human',
    availability: 'pending',
  },
  {
    id: 'ip-video',
    labelKey: 'navIPVideo',
    descriptionKey: 'navDescIPVideo',
    group: '音视频',
    groupKey: 'navGroupAv',
    icon: Clapperboard,
    path: '/workbench/ip-video',
    availability: 'demo',
    badge: 'beta',
  },
  {
    id: 'video-factory',
    labelKey: 'navVideoFactory',
    descriptionKey: 'navDescVideoFactory',
    group: '音视频',
    groupKey: 'navGroupAv',
    icon: Film,
    path: '/workbench/video-factory',
    availability: 'demo',
    badge: 'beta',
  },
  {
    id: 'extension',
    labelKey: 'navExtension',
    descriptionKey: 'navDescExtension',
    group: '下载与安装',
    groupKey: 'navGroupDownload',
    icon: Puzzle,
    path: '/workbench/extension',
    availability: 'demo',
    badge: 'beta',
  },
  {
    id: 'account',
    labelKey: 'navAccount',
    descriptionKey: 'navDescAccount',
    group: '账号',
    groupKey: 'navGroupAccount',
    icon: WalletCards,
    path: '/workbench/account',
    availability: 'demo',
  },
  {
    id: 'membership',
    labelKey: 'navMembership',
    descriptionKey: 'navDescMembership',
    group: '账号',
    groupKey: 'navGroupAccount',
    icon: CreditCard,
    path: '/workbench/membership',
    availability: 'demo',
  },
]

/** 桌面端专属入口：侧栏展示但不可导航。 */
export const desktopOnlyNavigation: NavItem[] = [
  {
    id: 'desktop-product',
    labelKey: 'navDesktopProduct',
    descriptionKey: 'navDescDesktopProduct',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: Package,
    availability: 'desktop',
  },
  {
    id: 'desktop-product-marketing',
    labelKey: 'navDesktopProductMarketing',
    descriptionKey: 'navDescDesktopProductMarketing',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: TrendingUp,
    availability: 'desktop',
  },
  {
    id: 'desktop-ppt',
    labelKey: 'navDesktopPpt',
    descriptionKey: 'navDescDesktopPpt',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: Presentation,
    availability: 'desktop',
  },
  {
    id: 'desktop-ecom-visual',
    labelKey: 'navDesktopEcomVisual',
    descriptionKey: 'navDescDesktopEcomVisual',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: Images,
    availability: 'desktop',
  },
  {
    id: 'desktop-promo-key-visual',
    labelKey: 'navDesktopPromoKeyVisual',
    descriptionKey: 'navDescDesktopPromoKeyVisual',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: Palette,
    availability: 'desktop',
  },
  {
    id: 'desktop-compliance',
    labelKey: 'navDesktopCompliance',
    descriptionKey: 'navDescDesktopCompliance',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: ShieldCheck,
    availability: 'desktop',
  },
  {
    id: 'desktop-files',
    labelKey: 'navDesktopFiles',
    descriptionKey: 'navDescDesktopFiles',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: Folder,
    availability: 'desktop',
  },
  {
    id: 'desktop-terminal',
    labelKey: 'navDesktopTerminal',
    descriptionKey: 'navDescDesktopTerminal',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: SquareTerminal,
    availability: 'desktop',
  },
  {
    id: 'desktop-computer-use',
    labelKey: 'navDesktopComputerUse',
    descriptionKey: 'navDescDesktopComputerUse',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: Monitor,
    availability: 'desktop',
  },
  {
    id: 'desktop-browser',
    labelKey: 'navDesktopBrowser',
    descriptionKey: 'navDescDesktopBrowser',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: Globe,
    availability: 'desktop',
  },
  {
    id: 'desktop-ai-video-edit',
    labelKey: 'navDesktopAiVideoEdit',
    descriptionKey: 'navDescDesktopAiVideoEdit',
    group: DESKTOP_ONLY_GROUP,
    groupKey: DESKTOP_ONLY_GROUP_KEY,
    icon: Scissors,
    availability: 'desktop',
  },
]

export const navGroups = ['内容创作', '音视频', '下载与安装', '账号'] as const

export const navGroupKeys: Record<(typeof navGroups)[number], string> = {
  内容创作: 'navGroupContent',
  音视频: 'navGroupAv',
  '下载与安装': 'navGroupDownload',
  账号: 'navGroupAccount',
}

/** 一级分组图标（对齐桌面 nav-group-trigger）。 */
export const navGroupIcons: Record<(typeof navGroups)[number] | typeof DESKTOP_ONLY_GROUP, LucideIcon> = {
  内容创作: PenLine,
  音视频: AudioLines,
  '下载与安装': Puzzle,
  账号: WalletCards,
  [DESKTOP_ONLY_GROUP]: Monitor,
}

export const navGroupBrandIcons: Partial<
  Record<(typeof navGroups)[number] | typeof DESKTOP_ONLY_GROUP, string>
> = {
  音视频: WORKBENCH_BRAND_AUDIO_VIDEO,
}

export const legacyRoutes: Record<string, string> = {
  '/': '/workbench',
  '/home': '/workbench',
  '/account': '/workbench/account',
  '/membership': '/workbench/membership',
  '/pricing': '/workbench/membership',
  '/persona': '/workbench/persona',
  '/titles': '/workbench/titles',
  '/video': '/workbench/video-script',
  '/live': '/workbench/live-script',
  '/note': '/workbench/xiaohongshu',
  '/wechat': '/workbench/wechat-article',
  '/moments': '/workbench/moments',
  '/voice': '/workbench/voice',
  '/digital': '/workbench/digital-human',
  '/extension': '/workbench/extension',
}
