import type { KeyframeEasing, TextStyle } from '../project.ts'

export type AssemblyComponentId =
  // 标题 6
  | 'title.opening'
  | 'title.chapter'
  | 'title.quote'
  | 'title.keyword'
  | 'title.speaker'
  | 'title.closing'
  // 字幕 5
  | 'caption.sentence'
  | 'caption.word-highlight'
  | 'caption.keyword-pill'
  | 'caption.double-line'
  | 'caption.bilingual'
  // 媒体 5
  | 'media.photo-motion'
  | 'media.focus-callout'
  | 'media.side-by-side'
  | 'media.speaker-pip'
  | 'media.photo-sequence'
  // 信息 6
  | 'info.steps'
  | 'info.timeline'
  | 'info.before-after'
  | 'info.checklist'
  | 'info.callout'
  | 'info.comparison'
  // 图表 6
  | 'chart.bar'
  | 'chart.line'
  | 'chart.donut'
  | 'chart.number'
  | 'chart.rank'
  | 'chart.progress'
  // 背景 4
  | 'background.solid'
  | 'background.soft-gradient'
  | 'background.grid'
  | 'background.spotlight'

export type AssemblyMotionId =
  // 入场 6
  | 'motion.fade-up'
  | 'motion.fade-in'
  | 'motion.slide-left'
  | 'motion.slide-right'
  | 'motion.scale-in'
  | 'motion.mask-reveal'
  // 持续 4
  | 'motion.photo-push'
  | 'motion.photo-pan'
  | 'motion.chart-draw'
  | 'motion.keyword-pulse'
  // 强调 4
  | 'motion.highlight-sweep'
  | 'motion.number-count'
  | 'motion.step-focus'
  | 'motion.callout-pop'
  // 退场/转场 4
  | 'motion.fade-out'
  | 'motion.slide-out'
  | 'motion.wipe'
  | 'motion.crossfade'

export type AssemblyLayoutId =
  | 'layout.speaker-full'
  | 'layout.speaker-info'
  | 'layout.speaker-pip'
  | 'layout.split-horizontal'
  | 'layout.split-vertical'
  | 'layout.chart-full'
  | 'layout.photo-story'
  | 'layout.type-led'

export type AssemblyStyleId =
  | 'style.knowledge-editorial'
  | 'style.interview'
  | 'style.product-tech'
  | 'style.business-data'
  | 'style.daily-life'
  | 'style.brand-speaker'

export type AssemblyRecipeId =
  | 'recipe.explainer'
  | 'recipe.product-overview'
  | 'recipe.data-story'
  | 'recipe.speaker-column'

export type AssemblyTextStyle = Pick<
  TextStyle,
  'font' | 'weight' | 'color' | 'outlineColor' | 'outlineWidth' | 'align' | 'lineHeight' | 'letterSpacing'
> & { size: number }

export type AssemblyComponentDefinition = {
  id: AssemblyComponentId
  label: string
  category: 'title' | 'caption' | 'media' | 'info' | 'chart' | 'background'
  output: 'text' | 'caption' | 'text-list' | 'info' | 'media' | 'chart' | 'background'
  editableFields: readonly string[]
  allowedMotions: readonly AssemblyMotionId[]
}

/**
 * 完整首版 32 组件规范目录
 */
export const ASSEMBLY_COMPONENT_CATALOG: Readonly<Record<AssemblyComponentId, AssemblyComponentDefinition>> = {
  // 标题 6
  'title.opening': {
    id: 'title.opening',
    label: '开场主标题',
    category: 'title',
    output: 'text',
    editableFields: ['text', 'position', 'fontSize'],
    allowedMotions: ['motion.fade-up', 'motion.fade-in', 'motion.scale-in', 'motion.mask-reveal'],
  },
  'title.chapter': {
    id: 'title.chapter',
    label: '章节段落标题',
    category: 'title',
    output: 'text',
    editableFields: ['text', 'position', 'fontSize'],
    allowedMotions: ['motion.fade-in', 'motion.slide-left', 'motion.slide-right'],
  },
  'title.quote': {
    id: 'title.quote',
    label: '金句引用条',
    category: 'title',
    output: 'text',
    editableFields: ['text', 'author', 'position', 'fontSize'],
    allowedMotions: ['motion.fade-in', 'motion.fade-up'],
  },
  'title.keyword': {
    id: 'title.keyword',
    label: '句内强调重点词',
    category: 'title',
    output: 'text',
    editableFields: ['text', 'position', 'fontSize', 'color'],
    allowedMotions: ['motion.fade-in', 'motion.keyword-pulse', 'motion.highlight-sweep'],
  },
  'title.speaker': {
    id: 'title.speaker',
    label: '人物名条/身份标牌',
    category: 'title',
    output: 'text',
    editableFields: ['name', 'title', 'position'],
    allowedMotions: ['motion.fade-in', 'motion.slide-left'],
  },
  'title.closing': {
    id: 'title.closing',
    label: '收尾总结提示',
    category: 'title',
    output: 'text',
    editableFields: ['text', 'subtext', 'position'],
    allowedMotions: ['motion.fade-up', 'motion.scale-in', 'motion.fade-out'],
  },

  // 字幕 5
  'caption.sentence': {
    id: 'caption.sentence',
    label: '单行句字幕',
    category: 'caption',
    output: 'caption',
    editableFields: ['text', 'timing'],
    allowedMotions: [],
  },
  'caption.word-highlight': {
    id: 'caption.word-highlight',
    label: '逐词高亮卡拉OK字幕',
    category: 'caption',
    output: 'caption',
    editableFields: ['text', 'timing', 'wordTimings'],
    allowedMotions: [],
  },
  'caption.keyword-pill': {
    id: 'caption.keyword-pill',
    label: '安全区关键词胶囊字幕',
    category: 'caption',
    output: 'caption',
    editableFields: ['text', 'keyword', 'timing'],
    allowedMotions: ['motion.keyword-pulse'],
  },
  'caption.double-line': {
    id: 'caption.double-line',
    label: '双行重点字幕',
    category: 'caption',
    output: 'caption',
    editableFields: ['text', 'timing'],
    allowedMotions: [],
  },
  'caption.bilingual': {
    id: 'caption.bilingual',
    label: '双语对照字幕',
    category: 'caption',
    output: 'caption',
    editableFields: ['primaryText', 'secondaryText', 'timing'],
    allowedMotions: [],
  },

  // 媒体 5
  'media.photo-motion': {
    id: 'media.photo-motion',
    label: '静态图片运镜推近平移',
    category: 'media',
    output: 'media',
    editableFields: ['assetId', 'scale', 'motion'],
    allowedMotions: ['motion.photo-push', 'motion.photo-pan', 'motion.fade-in'],
  },
  'media.focus-callout': {
    id: 'media.focus-callout',
    label: '局部聚焦与标注框',
    category: 'media',
    output: 'media',
    editableFields: ['assetId', 'focusArea', 'calloutText'],
    allowedMotions: ['motion.callout-pop', 'motion.scale-in'],
  },
  'media.side-by-side': {
    id: 'media.side-by-side',
    label: '双图对照分屏',
    category: 'media',
    output: 'media',
    editableFields: ['leftAssetId', 'rightAssetId', 'leftLabel', 'rightLabel'],
    allowedMotions: ['motion.fade-in', 'motion.slide-left', 'motion.slide-right'],
  },
  'media.speaker-pip': {
    id: 'media.speaker-pip',
    label: '口播人物画中画',
    category: 'media',
    output: 'media',
    editableFields: ['assetId', 'position', 'round', 'border'],
    allowedMotions: ['motion.fade-in', 'motion.scale-in'],
  },
  'media.photo-sequence': {
    id: 'media.photo-sequence',
    label: '多图节奏切换序列',
    category: 'media',
    output: 'media',
    editableFields: ['assetIds', 'intervalUs'],
    allowedMotions: ['motion.wipe', 'motion.crossfade'],
  },

  // 信息 6
  'info.steps': {
    id: 'info.steps',
    label: '步骤信息卡',
    category: 'info',
    output: 'text-list',
    editableFields: ['title', 'items', 'position'],
    allowedMotions: ['motion.step-focus', 'motion.fade-in'],
  },
  'info.timeline': {
    id: 'info.timeline',
    label: '纵向/横向事件时间线',
    category: 'info',
    output: 'info',
    editableFields: ['events', 'activeStep'],
    allowedMotions: ['motion.fade-in', 'motion.step-focus'],
  },
  'info.before-after': {
    id: 'info.before-after',
    label: '前后对比卡片',
    category: 'info',
    output: 'info',
    editableFields: ['beforeLabel', 'beforeText', 'afterLabel', 'afterText'],
    allowedMotions: ['motion.slide-left', 'motion.fade-in'],
  },
  'info.checklist': {
    id: 'info.checklist',
    label: '要点清单核对表',
    category: 'info',
    output: 'info',
    editableFields: ['title', 'items'],
    allowedMotions: ['motion.step-focus', 'motion.fade-in'],
  },
  'info.callout': {
    id: 'info.callout',
    label: '内容引导标记圈/箭头',
    category: 'info',
    output: 'info',
    editableFields: ['targetX', 'targetY', 'text'],
    allowedMotions: ['motion.callout-pop', 'motion.fade-in'],
  },
  'info.comparison': {
    id: 'info.comparison',
    label: '多维度参数对照表',
    category: 'info',
    output: 'info',
    editableFields: ['dimensions', 'options'],
    allowedMotions: ['motion.fade-in'],
  },

  // 图表 6
  'chart.bar': {
    id: 'chart.bar',
    label: '柱状对比图',
    category: 'chart',
    output: 'chart',
    editableFields: ['data', 'unit', 'source', 'title'],
    allowedMotions: ['motion.chart-draw', 'motion.fade-in'],
  },
  'chart.line': {
    id: 'chart.line',
    label: '趋势折线图',
    category: 'chart',
    output: 'chart',
    editableFields: ['data', 'unit', 'source', 'title'],
    allowedMotions: ['motion.chart-draw', 'motion.fade-in'],
  },
  'chart.donut': {
    id: 'chart.donut',
    label: '环形占比图',
    category: 'chart',
    output: 'chart',
    editableFields: ['data', 'unit', 'source', 'title'],
    allowedMotions: ['motion.chart-draw', 'motion.fade-in'],
  },
  'chart.number': {
    id: 'chart.number',
    label: '关键数字大字报计数器',
    category: 'chart',
    output: 'chart',
    editableFields: ['targetValue', 'prefix', 'suffix', 'source'],
    allowedMotions: ['motion.number-count', 'motion.scale-in'],
  },
  'chart.rank': {
    id: 'chart.rank',
    label: '排行榜序列图',
    category: 'chart',
    output: 'chart',
    editableFields: ['items', 'unit', 'source'],
    allowedMotions: ['motion.chart-draw', 'motion.step-focus'],
  },
  'chart.progress': {
    id: 'chart.progress',
    label: '进度条比例指示器',
    category: 'chart',
    output: 'chart',
    editableFields: ['percent', 'label', 'source'],
    allowedMotions: ['motion.chart-draw', 'motion.fade-in'],
  },

  // 背景 4
  'background.solid': {
    id: 'background.solid',
    label: '品牌纯色/双色拼底',
    category: 'background',
    output: 'background',
    editableFields: ['color', 'secondaryColor'],
    allowedMotions: ['motion.fade-in'],
  },
  'background.soft-gradient': {
    id: 'background.soft-gradient',
    label: '柔和微动渐变底',
    category: 'background',
    output: 'background',
    editableFields: ['fromColor', 'toColor', 'angle'],
    allowedMotions: ['motion.fade-in'],
  },
  'background.grid': {
    id: 'background.grid',
    label: '轻量科技网格/纹理底',
    category: 'background',
    output: 'background',
    editableFields: ['gridSize', 'lineColor', 'backgroundColor'],
    allowedMotions: ['motion.fade-in'],
  },
  'background.spotlight': {
    id: 'background.spotlight',
    label: '局部聚焦聚光灯底',
    category: 'background',
    output: 'background',
    editableFields: ['spotX', 'spotY', 'radius', 'spotColor'],
    allowedMotions: ['motion.fade-in'],
  },
}

export const ASSEMBLY_LAYOUTS: Readonly<Record<AssemblyLayoutId, { id: AssemblyLayoutId; label: string; description: string }>> = {
  'layout.speaker-full': { id: 'layout.speaker-full', label: '人物全屏', description: '口播人物居中全屏沉浸展示' },
  'layout.speaker-info': { id: 'layout.speaker-info', label: '人物与信息区', description: '上方或侧方留白展示图表与文字' },
  'layout.speaker-pip': { id: 'layout.speaker-pip', label: '人物画中画', description: '主画面展示素材，小窗悬浮口播' },
  'layout.split-horizontal': { id: 'layout.split-horizontal', label: '左右分屏', description: '左右对照与重点信息呈现' },
  'layout.split-vertical': { id: 'layout.split-vertical', label: '上下分区', description: '上图下文或视频与要点结合' },
  'layout.chart-full': { id: 'layout.chart-full', label: '全屏图表', description: '数据主导场景聚焦' },
  'layout.photo-story': { id: 'layout.photo-story', label: '图片叙事', description: '单图或组图主导图文口播' },
  'layout.type-led': { id: 'layout.type-led', label: '文字主导', description: '大字报与清单信息流' },
}

export const ASSEMBLY_STYLES: Readonly<Record<AssemblyStyleId, {
  id: AssemblyStyleId
  label: string
  primaryColor: string
  accentColor: string
  fontFamily: string
}>> = {
  'style.knowledge-editorial': {
    id: 'style.knowledge-editorial',
    label: '知识编辑部',
    primaryColor: '#FFFFFF',
    accentColor: '#FFD60A',
    fontFamily: '"Alibaba PuHuiTi", sans-serif',
  },
  'style.interview': {
    id: 'style.interview',
    label: '杂志访谈',
    primaryColor: '#F5F5F7',
    accentColor: '#E65100',
    fontFamily: '"Alibaba PuHuiTi", sans-serif',
  },
  'style.product-tech': {
    id: 'style.product-tech',
    label: '科技产品',
    primaryColor: '#FFFFFF',
    accentColor: '#00E5FF',
    fontFamily: '"Alibaba PuHuiTi", sans-serif',
  },
  'style.business-data': {
    id: 'style.business-data',
    label: '商务数据',
    primaryColor: '#F0F4F8',
    accentColor: '#1E88E5',
    fontFamily: '"Alibaba PuHuiTi", sans-serif',
  },
  'style.daily-life': {
    id: 'style.daily-life',
    label: '生活记录',
    primaryColor: '#FFF8E1',
    accentColor: '#FF7043',
    fontFamily: '"Alibaba PuHuiTi", sans-serif',
  },
  'style.brand-speaker': {
    id: 'style.brand-speaker',
    label: '品牌口播',
    primaryColor: '#FFFFFF',
    accentColor: '#E50914',
    fontFamily: '"Alibaba PuHuiTi", sans-serif',
  },
}

export const ASSEMBLY_RECIPES: Readonly<Record<AssemblyRecipeId, { id: AssemblyRecipeId; label: string; sequence: readonly string[] }>> = {
  'recipe.explainer': {
    id: 'recipe.explainer',
    label: '知识讲解配方',
    sequence: ['title.opening', 'caption.sentence', 'info.steps', 'chart.bar', 'title.closing'],
  },
  'recipe.product-overview': {
    id: 'recipe.product-overview',
    label: '产品说明配方',
    sequence: ['title.opening', 'media.photo-motion', 'info.before-after', 'info.checklist', 'title.closing'],
  },
  'recipe.data-story': {
    id: 'recipe.data-story',
    label: '数据解读配方',
    sequence: ['title.opening', 'chart.number', 'chart.line', 'info.comparison', 'title.closing'],
  },
  'recipe.speaker-column': {
    id: 'recipe.speaker-column',
    label: '人物专栏配方',
    sequence: ['title.opening', 'title.speaker', 'title.quote', 'caption.sentence', 'title.closing'],
  },
}

export const ASSEMBLY_MOTIONS: Readonly<Record<AssemblyMotionId, {
  id: AssemblyMotionId
  label: string
  durationUs: number
  easing: KeyframeEasing
}>> = {
  // 入场 6
  'motion.fade-up': { id: 'motion.fade-up', label: '向上淡入', durationUs: 250_000, easing: 'easeOut' },
  'motion.fade-in': { id: 'motion.fade-in', label: '原位淡入', durationUs: 200_000, easing: 'easeOut' },
  'motion.slide-left': { id: 'motion.slide-left', label: '从左滑入', durationUs: 220_000, easing: 'easeOut' },
  'motion.slide-right': { id: 'motion.slide-right', label: '从右滑入', durationUs: 220_000, easing: 'easeOut' },
  'motion.scale-in': { id: 'motion.scale-in', label: '缩放弹出', durationUs: 240_000, easing: 'easeOut' },
  'motion.mask-reveal': { id: 'motion.mask-reveal', label: '遮罩展开', durationUs: 280_000, easing: 'easeInOut' },

  // 持续 4
  'motion.photo-push': { id: 'motion.photo-push', label: '缓推近运镜', durationUs: 2_000_000, easing: 'linear' },
  'motion.photo-pan': { id: 'motion.photo-pan', label: '缓平移运镜', durationUs: 2_000_000, easing: 'linear' },
  'motion.chart-draw': { id: 'motion.chart-draw', label: '图表绘制生成', durationUs: 600_000, easing: 'easeOut' },
  'motion.keyword-pulse': { id: 'motion.keyword-pulse', label: '重点词微脉冲', durationUs: 400_000, easing: 'easeInOut' },

  // 强调 4
  'motion.highlight-sweep': { id: 'motion.highlight-sweep', label: '高光扫过', durationUs: 350_000, easing: 'easeInOut' },
  'motion.number-count': { id: 'motion.number-count', label: '数值滚动跳动', durationUs: 800_000, easing: 'easeOut' },
  'motion.step-focus': { id: 'motion.step-focus', label: '步骤依次显现', durationUs: 180_000, easing: 'easeOut' },
  'motion.callout-pop': { id: 'motion.callout-pop', label: '标注指示气泡跳显', durationUs: 220_000, easing: 'easeOut' },

  // 退场/转场 4
  'motion.fade-out': { id: 'motion.fade-out', label: '淡出退场', durationUs: 200_000, easing: 'easeIn' },
  'motion.slide-out': { id: 'motion.slide-out', label: '滑出退场', durationUs: 200_000, easing: 'easeIn' },
  'motion.wipe': { id: 'motion.wipe', label: '擦除转场', durationUs: 300_000, easing: 'easeInOut' },
  'motion.crossfade': { id: 'motion.crossfade', label: '交叉渐融', durationUs: 300_000, easing: 'easeInOut' },
}

export const ASSEMBLY_TEXT_THEME = {
  font: '"Alibaba PuHuiTi", sans-serif',
  primary: '#FFFFFF',
  accent: '#FFD60A',
  outline: '#111111',
} as const
