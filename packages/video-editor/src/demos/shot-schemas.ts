/**
 * 镜头参数契约（Shot Schema）
 *
 * 统一描述每个动效镜头可被用户手工编辑或由 AI 填写的参数字段（overrides 与 slots）。
 * 覆盖：主标题、副标题、高亮词、数值指标、图片素材槽位、强调色等。
 */

import { findShot } from './registry.generated.ts'

export type ShotParamFieldType = 'text' | 'textarea' | 'number' | 'image' | 'color'

export type ShotParamCategory = 'content' | 'dashboard' | 'style'

export type ShotParamField = {
  /** 对应 element.overrides 或 element.slots 的键名 */
  key: string
  /** 界面显示的字段名称 */
  label: string
  /** 控件类型 */
  type: ShotParamFieldType
  /** 字段所属子页签分类（默认根据语义推断） */
  category?: ShotParamCategory
  /** 是否属于素材槽位（属于 slots，否则属于 overrides） */
  isSlot?: boolean
  /** 默认值提示 */
  defaultValue?: string
  placeholder?: string
  description?: string
  /** 建议最大字符数（中文按字符计数）；超出时检查器内联提示，不静默截断 */
  maxLength?: number
}

export type ShotSchema = {
  shotId?: string
  displayName?: string
  fields: ShotParamField[]
  features: {
    hasText: boolean
    hasImageSlot: boolean
    hasData: boolean
  }
}

/** 预定义高频核心镜头的精细配置 */
const SPECIFIC_SHOT_SCHEMAS: Record<string, Partial<ShotSchema>> = {
  // 1. typography: lead-word-zoom-assemble 首词推近组句
  'typography/lead-word-zoom-assemble': {
    fields: [
      { key: 'text', label: '主标题文案', type: 'text', placeholder: '如：3个关键逆袭认知', defaultValue: 'Introducing Studio Video' },
      { key: 'highlightWord', label: '高亮强调词', type: 'text', placeholder: '如：关键逆袭', defaultValue: 'Studio Video' },
      { key: 'subline', label: '底部副标题', type: 'textarea', placeholder: '如：掌握底层逻辑，告别盲目努力', defaultValue: 'One shot card, one motion recipe — copy, paste, render.' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 2. opening: spotlight-hero-card 聚光灯聚焦卡片
  'opening/spotlight-hero-card': {
    fields: [
      { key: 'title', label: '卡片主标题', type: 'text', placeholder: '核心产品/观点名称', defaultValue: 'Your product, in motion.' },
      { key: 'subline', label: '卡片标签/说明', type: 'text', placeholder: '如：重磅功能发布', defaultValue: 'Featured Highlights' },
      { key: 'cardImage', label: '卡片封面图片', type: 'image', isSlot: true, placeholder: '选择或上传替换图片' },
    ],
    features: { hasText: true, hasImageSlot: true, hasData: false },
  },

  // 2b. opening 文案批次（2.A）
  'opening/dataviz-landscape-open': {
    fields: [
      { key: 'title', label: '主标题上行', type: 'text', placeholder: '如：Every shot,', defaultValue: 'Every shot,', maxLength: 14, description: '单行大字，建议 ≤14 字，超出可能出画（仅横屏）' },
      { key: 'subline', label: '主标题下行', type: 'text', placeholder: '如：one film.', defaultValue: 'one film.', maxLength: 14, description: '与上行同一字号，建议 ≤14 字（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },
  'opening/icon-field-colorize': {
    fields: [
      { key: 'title', label: '主标题上行', type: 'text', placeholder: '如：Every shot,', defaultValue: 'Every shot,', maxLength: 14, description: '单行大字，建议 ≤14 字（仅横屏）' },
      { key: 'subline', label: '主标题下行', type: 'text', placeholder: '如：one place.', defaultValue: 'one place.', maxLength: 14, description: '单行大字，建议 ≤14 字（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },
  'opening/fracture': {
    fields: [
      { key: 'eyebrow', label: '海报眉题', type: 'text', placeholder: '如：INTRODUCING', defaultValue: 'INTRODUCING', maxLength: 18, description: '海报小字（随瓦片切片），建议 ≤18 字（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },
  'opening/magician-card-flourish': {
    fields: [
      { key: 'kicker', label: '眉题', type: 'text', placeholder: '如：NOW SHOWING', defaultValue: 'NOW SHOWING', maxLength: 18, description: '大字距眉题，建议 ≤18 字（仅横屏）' },
      { key: 'title', label: '主标题（可两行）', type: 'textarea', placeholder: '如：Craft / the shot.', defaultValue: 'Craft\nthe shot.', maxLength: 24, description: '换行即分行，建议 ≤24 字（仅横屏）' },
      { key: 'subline', label: '副文案（可两行）', type: 'textarea', placeholder: '如：Cinematic product videos,', defaultValue: 'Cinematic product videos,\ncrafted by your agent.', maxLength: 60, description: '建议 ≤60 字，自动逐词揭示（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },
  'opening/orbit-ring-title-open': {
    fields: [
      { key: 'line1', label: '标题上行（小字）', type: 'text', placeholder: '如：让镜头卡替你想好', defaultValue: '让镜头卡替你想好', maxLength: 12, description: '逐字升起，建议 ≤12 字（仅横屏）' },
      { key: 'line2', label: '标题下行（大字 + 荧光马克）', type: 'text', placeholder: '如：每一个动效', defaultValue: '每一个动效', maxLength: 8, description: '马克块按默认 8 字宽度铺满，建议 ≤8 字（仅横屏）' },
      { key: 'kicker', label: '底部产品代号', type: 'text', placeholder: '如：SHOT RECIPE CARDS', defaultValue: 'SHOT RECIPE CARDS', maxLength: 24, description: '等宽小字，建议 ≤24 字符（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },
  'opening/stroke-segment-build': {
    fields: [
      { key: 'subline', label: '揭晓后副题', type: 'text', placeholder: '如：ONE PROMPT, ONE FILM', defaultValue: 'ONE PROMPT, ONE FILM', maxLength: 28, description: '宽字距副题，建议 ≤28 字符（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 3. typography: blur-slide 模糊滑入
  'typography/blur-slide': {
    fields: [
      { key: 'text', label: '主标题', type: 'text', placeholder: '输入醒目大标题', defaultValue: 'Focus on what matters' },
      { key: 'subline', label: '副标题说明', type: 'text', placeholder: '输入阐述内容', defaultValue: 'Automate your creative workflow' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 4. opening: text-as-mask 文字镂空蒙版（上轴策略见 panels/shots/shot-insert-policy.ts → 默认视频轨）
  'opening/text-as-mask': {
    fields: [
      // 第一页签：【内容与文案】
      { key: 'text', label: '第一幕 · 镂空大字', type: 'text', category: 'content', placeholder: '如：未来已来 (建议2-6字)', defaultValue: 'CREATE', description: '字形作为视窗穿透透出产品画面' },
      { key: 'subline', label: '第一幕 · 正文阐述', type: 'text', category: 'content', placeholder: '补充说明文字', defaultValue: 'Next-gen video engine' },
      { key: 'innerImage', label: '第二幕 · 自定义产品全屏画面', type: 'image', category: 'content', isSlot: true, placeholder: '上传产品真实截图/图片，冲入全屏时接管', description: '留空则使用内置动态数据看板' },

      // 第二页签：【看板与图表全要素】
      { key: 'sidebarBrand', label: '侧栏品牌标语', type: 'text', category: 'dashboard', placeholder: '默认：Shotcraft', defaultValue: 'Shotcraft' },
      { key: 'navItem1', label: '侧栏导航 1', type: 'text', category: 'dashboard', placeholder: '默认：Overview', defaultValue: 'Overview' },
      { key: 'navItem2', label: '侧栏导航 2', type: 'text', category: 'dashboard', placeholder: '默认：Renders', defaultValue: 'Renders' },
      { key: 'navItem3', label: '侧栏导航 3', type: 'text', category: 'dashboard', placeholder: '默认：Shots', defaultValue: 'Shots' },
      { key: 'navItem4', label: '侧栏导航 4', type: 'text', category: 'dashboard', placeholder: '默认：Timeline', defaultValue: 'Timeline' },
      { key: 'navItem5', label: '侧栏导航 5', type: 'text', category: 'dashboard', placeholder: '默认：Gallery', defaultValue: 'Gallery' },
      { key: 'activeNavIndex', label: '侧栏激活序号 (1-5)', type: 'text', category: 'dashboard', placeholder: '1 ~ 5', defaultValue: '2' },
      { key: 'dashboardTitle', label: '大盘主标题', type: 'text', category: 'dashboard', placeholder: '如：Render throughput / 实时转化大盘', defaultValue: 'Render throughput' },
      { key: 'dashboardStatus', label: '运行状态指示', type: 'text', category: 'dashboard', placeholder: '如：Live / 实时监控', defaultValue: 'Live' },
      { key: 'kpi1Label', label: '核心指标 1 标签', type: 'text', category: 'dashboard', placeholder: '如：Frames rendered / 累计总曝光', defaultValue: 'Frames rendered' },
      { key: 'kpi1Value', label: '核心指标 1 数值', type: 'text', category: 'dashboard', placeholder: '如：2.48M / 99.8%', defaultValue: '2.48M' },
      { key: 'kpi2Label', label: '核心指标 2 标签', type: 'text', category: 'dashboard', placeholder: '如：Avg shot render / 平均转化率', defaultValue: 'Avg shot render' },
      { key: 'kpi2Value', label: '核心指标 2 数值', type: 'text', category: 'dashboard', placeholder: '如：42s -18% / +32.5%', defaultValue: '42s -18%' },
      { key: 'kpi3Label', label: '指标 3 柱状队列标签', type: 'text', category: 'dashboard', placeholder: '如：Render queue / 转化漏斗', defaultValue: 'Render queue' },
      { key: 'chartTitle', label: '折线面积图主标题', type: 'text', category: 'dashboard', placeholder: '如：Frames / sec / 实时吞吐峰值', defaultValue: 'Frames / sec' },
      { key: 'chartUnit', label: '图表单位说明', type: 'text', category: 'dashboard', placeholder: '如：fps · 1s buckets / 次每秒', defaultValue: 'fps · 1s buckets' },
      { key: 'region1Name', label: '底部指标 1 名称', type: 'text', category: 'dashboard', placeholder: '默认：opening', defaultValue: 'opening' },
      { key: 'region1Value', label: '底部指标 1 进度', type: 'text', category: 'dashboard', placeholder: '如：92% 或 0.92', defaultValue: '92%' },
      { key: 'region2Name', label: '底部指标 2 名称', type: 'text', category: 'dashboard', placeholder: '默认：camera', defaultValue: 'camera' },
      { key: 'region2Value', label: '底部指标 2 进度', type: 'text', category: 'dashboard', placeholder: '如：74% 或 0.74', defaultValue: '74%' },
      { key: 'region3Name', label: '底部指标 3 名称', type: 'text', category: 'dashboard', placeholder: '默认：transition', defaultValue: 'transition' },
      { key: 'region3Value', label: '底部指标 3 进度', type: 'text', category: 'dashboard', placeholder: '如：58% 或 0.58', defaultValue: '58%' },
      { key: 'region4Name', label: '底部指标 4 名称', type: 'text', category: 'dashboard', placeholder: '默认：outro', defaultValue: 'outro' },
      { key: 'region4Value', label: '底部指标 4 进度', type: 'text', category: 'dashboard', placeholder: '如：41% 或 0.41', defaultValue: '41%' },

      // 第三页签：【视觉配色】
      { key: 'colorTheme', label: '预设主题色盘', type: 'text', category: 'style', placeholder: 'dark-blue / neon-purple / cyber-teal / obsidian-gold / sunset-orange / porcelain-light', defaultValue: 'dark-blue' },
      { key: 'customBg', label: '背景底色', type: 'color', category: 'style', placeholder: '#0a0f1e', defaultValue: '#0a0f1e' },
      { key: 'customPrimary', label: '主发光线条色', type: 'color', category: 'style', placeholder: '#4d7cff', defaultValue: '#4d7cff' },
      { key: 'customSecondary', label: '次级高光色', type: 'color', category: 'style', placeholder: '#19d3b4', defaultValue: '#19d3b4' },
      { key: 'customPanel', label: '卡片底板色', type: 'color', category: 'style', placeholder: '#0f1730', defaultValue: '#0f1730' },
      { key: 'customInk', label: '文字墨水色', type: 'color', category: 'style', placeholder: '#eef3ff', defaultValue: '#eef3ff' },
    ],
    features: { hasText: true, hasImageSlot: true, hasData: true },
  },

  // 5. typography: split-text-stagger 错落字效
  'typography/type-assembly-moves~SplitTextStagger': {
    fields: [
      { key: 'title', label: '主标题（逐字升起）', type: 'text', placeholder: '如：FRAME MOTION.', defaultValue: 'FRAME MOTION.', maxLength: 16, description: '136px 粗体单行标题，按字符拆 span 逐字遮罩裂升；13 字符时与基线等宽铺满，建议 ≤16 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 6. typography: letterform-drift-assembly 字符漂移组装
  'typography/type-assembly-moves~LetterformDriftAssembly': {
    fields: [
      { key: 'text', label: '排版标题', type: 'text', placeholder: '输入主标文案', defaultValue: 'TYPE IN MOTION' },
      { key: 'subline', label: '底部注释', type: 'text', placeholder: '如：智能算法精准驱动', defaultValue: 'Algorithmic Typography' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 7. data: chart-live-moves~AxisRescaleShockV2 坐标震荡图表
  'data/chart-live-moves~AxisRescaleShockV2': {
    fields: [
      { key: 'metric', label: '指标名称', type: 'text', placeholder: '如：月活跃用户增长', defaultValue: 'Active Users Growth' },
      { key: 'value', label: '核心数值', type: 'text', placeholder: '如：+328%', defaultValue: '+328%' },
      { key: 'label', label: '趋势注释', type: 'text', placeholder: '如：环比提升 4.2 倍', defaultValue: 'Quarterly Peak' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: true },
  },

  // 8. data: chart-live-moves~UnitDotSwarmRegroupV2 粒子聚集数据
  'data/chart-live-moves~UnitDotSwarmRegroupV2': {
    fields: [
      { key: 'metric', label: '数据类别', type: 'text', placeholder: '如：转化率突破', defaultValue: 'Conversion Surge' },
      { key: 'value', label: '统计数字', type: 'text', placeholder: '如：89.4%', defaultValue: '89.4%' },
      { key: 'subline', label: '对比说明', type: 'text', placeholder: '如：超越行业 95% 对标', defaultValue: 'Industry Leading' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: true },
  },

  // 9. rhythm: quad-split-parallel-scenes 四分屏并行叙事
  'rhythm/quad-split-parallel-scenes': {
    fields: [
      { key: 'title1', label: '第1屏标题', type: 'text', placeholder: '场景/卖点一', defaultValue: 'SCENE 01' },
      { key: 'title2', label: '第2屏标题', type: 'text', placeholder: '场景/卖点二', defaultValue: 'SCENE 02' },
      { key: 'title3', label: '第3屏标题', type: 'text', placeholder: '场景/卖点三', defaultValue: 'SCENE 03' },
      { key: 'title4', label: '第4屏标题', type: 'text', placeholder: '场景/卖点四', defaultValue: 'SCENE 04' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 10. outro: logo-shrink-wordmark-lockup 标语Logo收束
  'outro/logo-shrink-wordmark-lockup': {
    fields: [
      { key: 'brand', label: '品牌/产品名称', type: 'text', placeholder: '如：不加班工作台', defaultValue: 'No996 Studio' },
      { key: 'slogan', label: '品牌口号/行动呼吁', type: 'text', placeholder: '如：立即开始 释放灵感', defaultValue: 'Ship Faster, Work Smarter.' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 11. opening: crane-rise-reveal 升降臂拉升揭示（阶段 2 样板：文案 + 配色）
  'opening/crane-rise-reveal': {
    fields: [
      { key: 'eyebrow', label: '眉题', type: 'text', category: 'content', placeholder: '如：LIVE · RENDER FARM', defaultValue: 'LIVE · RENDER FARM', description: '页头上方的小字标签' },
      { key: 'title', label: '页头大标题', type: 'text', category: 'content', placeholder: '如：渲染队列', defaultValue: 'Render queue' },
      { key: 'subline', label: '页头副行', type: 'text', category: 'content', placeholder: '如：实时更新 · 1080p · 30 fps', defaultValue: 'Updated live · 1080p · 30 fps · 4 render workers' },
      { key: 'brand', label: '品牌字标', type: 'text', category: 'content', placeholder: '如：不加班工作台', defaultValue: 'video-shotcraft' },
      { key: 'showBrandMark', label: '显示镜刻图标', type: 'text', category: 'content', placeholder: '1 显示 / 0 隐藏', defaultValue: '1', description: '0 = 隐藏左上角镜刻图标（品牌合规）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: true },
  },

  // 文案批次：outro/grain-dissolve
  'outro/grain-dissolve': {
    fields: [
      { key: 'title', label: '砂化整行文案（含花括号）', type: 'text', placeholder: '如：{ 镜刻. Now Live }', defaultValue: '{ . Now Live }', maxLength: 20, description: '单行 26px 居中大字，建议 ≤20 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：outro/neon-triple-marquee
  'outro/neon-triple-marquee': {
    fields: [
      { key: 'line1', label: '第一行灯牌词（冰青灯管）', type: 'text', placeholder: '如：FRAME / 取景', defaultValue: 'FRAME', maxLength: 10, description: '建议 ≤10 字，超出可能出画（仅横屏）' },
      { key: 'line2', label: '第二行灯牌词（洋红灯管）', type: 'text', placeholder: '如：CRAFT / 刻镜头', defaultValue: 'CRAFT', maxLength: 10, description: '建议 ≤10 字，超出可能出画（仅横屏）' },
      { key: 'line3', label: '第三行灯牌词（钠灯琥珀）', type: 'text', placeholder: '如：SHIP / 交片', defaultValue: 'SHIP', maxLength: 10, description: '建议 ≤10 字，这一行同时是湿地面倒影的来源（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：outro/outro-group-photo-launch
  'outro/outro-group-photo-launch': {
    fields: [
      { key: 'subline', label: '收尾标语（品牌短句）', type: 'text', placeholder: '如：Frame motion. Craft the shot.', defaultValue: 'Frame motion. Craft the shot.', maxLength: 40, description: '字标下方 32px 等宽全大写短句，建议 ≤40 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：outro/ui-strip-away-outro
  'outro/ui-strip-away-outro': {
    fields: [
      { key: 'label', label: '按钮文案', type: 'text', placeholder: '如：Publish / 立即发布', defaultValue: 'Publish', maxLength: 10, description: '按钮宽度固定 150px，建议 ≤10 字，超出可能溢出色块（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：outro/ui-to-brand-morph~IconFlipBloomLogo
  'outro/ui-to-brand-morph~IconFlipBloomLogo': {
    fields: [
      { key: 'brand', label: '品牌字标', type: 'text', placeholder: '如：不加班工作台（留空则不显示字标）', defaultValue: '', maxLength: 20, description: '逐字落位的字标（默认留空）；建议 ≤20 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：outro/ui-to-brand-morph~InputMorphsIntoLogo
  'outro/ui-to-brand-morph~InputMorphsIntoLogo': {
    fields: [
      { key: 'value', label: '输入框文案', type: 'text', placeholder: '如：Render the launch film. Ship it.', defaultValue: 'Render the launch film. Ship it.', maxLength: 36, description: '单行输入框文案（点发送后飞出），建议 ≤36 字符，超出可能顶到右侧工具图标（仅横屏）' },
      { key: 'label', label: '频道名', type: 'text', placeholder: '如：launch-film', defaultValue: 'launch-film', maxLength: 24, description: '顶部频道名（# 前缀固定），建议 ≤24 字符（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/brace-expand
  'typography/brace-expand': {
    fields: [
      { key: 'title', label: '括号内字标标题', type: 'text', placeholder: '如：your-brand（默认留空）', defaultValue: '', maxLength: 14, description: '164px 大字夹在花括号内腔，建议 ≤14 字符；字越宽越早被幕布裁切（仅横屏）' },
      { key: 'eyebrow', label: '眉题（等宽注释行）', type: 'text', placeholder: '如：// shot recipes for your agent', defaultValue: '// shot recipes for your agent', maxLength: 30, description: '等宽 32px 居中眉题，建议 ≤30 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/brand-ink-open
  'typography/brand-ink-open': {
    fields: [
      { key: 'wordmark', label: '品牌字标（逐字压印）', type: 'text', placeholder: '如：不加班工作台（默认留空，仅显示下方短句）', defaultValue: '', maxLength: 20, description: '132px 衬线字标，逐字从大压到 1，建议 ≤20 字符，超出可能出画（仅横屏）' },
      { key: 'kicker', label: '字标下方品牌短句', type: 'text', placeholder: '如：把运动，刻成镜头。', defaultValue: 'Frame motion. Craft the shot.', maxLength: 40, description: '26px 等宽全大写打字机短句，建议 ≤40 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/countdown-arc-scatter
  'typography/countdown-arc-scatter': {
    fields: [
      { key: 'eyebrow', label: '左上网格标签', type: 'text', placeholder: '如：INSTALL TIME', defaultValue: 'SETUP TIME', maxLength: 14, description: '建议 ≤14 个字符，全大写更贴合瑞士网格版面，超出可能出画（仅横屏）' },
      { key: 'line1', label: '底部安装命令行（$ 后的文字）', type: 'text', placeholder: '如：npx skills add your-org/your-skill', defaultValue: 'npx skills add Vincentwei1021/video-shotcraft', maxLength: 60, description: '建议 ≤45 个字符（默认值 45），超出会撑宽命令框并可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/flying-words
  'typography/flying-words': {
    fields: [
      { key: 'title', label: '前景标题（品牌短句）', type: 'text', placeholder: '如：Frame motion. Craft the shot.', defaultValue: 'Frame motion. Craft the shot.', maxLength: 32, description: '画面正中 112px 主标题，建议 ≤32 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/glitch-cycle
  'typography/glitch-cycle': {
    fields: [
      { key: 'title', label: '轮播短语（收尾定格那条）', type: 'text', placeholder: '如：READY TO SHIP / 交付上线', defaultValue: 'READY TO SHIP', maxLength: 17, description: '104px 等宽大写、槽位固定 17 字符，建议 ≤17 字符，超出会被截断；另外三条轮播短语沿用原常量（仅横屏）' },
      { key: 'eyebrow', label: '顶部状态行频道名', type: 'text', placeholder: '如：shotcraft/launch-film', defaultValue: 'shotcraft/launch-film', maxLength: 24, description: '状态行 30px 等宽文字，两侧的「·」与「#4127」固定不动，建议 ≤24 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/gradient-word-sweep
  'typography/gradient-word-sweep': {
    fields: [
      { key: 'word', label: '渐变扫过的充能词', type: 'text', placeholder: '如：Supercharged', defaultValue: 'Supercharged', maxLength: 20, description: '92px 斜体主词，渐变从左向右扫过并带辉光/闪电；建议 ≤20 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '主词同行尾缀', type: 'text', placeholder: '如：product films', defaultValue: 'product films', maxLength: 20, description: '紧跟主词后的白色尾缀，同一行 nowrap；建议 ≤20 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/marker-underline-title
  'typography/marker-underline-title': {
    fields: [
      { key: 'title', label: '首行标题前半句', type: 'text', placeholder: '如：Meet the', defaultValue: 'Meet the', maxLength: 24, description: '118px 粗体白底标题首行前半句，建议 ≤24 字符，超出可能出画（仅横屏）' },
      { key: 'word', label: '斜体高亮词（带马克笔下划线）', type: 'text', placeholder: '如：new', defaultValue: 'new', maxLength: 8, description: '首行结尾的斜体高亮词，马克笔下划线宽度固定为约 5 个字符宽，建议 ≤8 字符，过长下划线会显短' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/outline-word-fill
  'typography/outline-word-fill': {
    fields: [
      { key: 'word', label: '空心点亮主词', type: 'text', placeholder: '如：Faster', defaultValue: 'Faster', maxLength: 12, description: '220px 居中大字，先空心描边后硬切实心点亮，单行不换行；建议 ≤12 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '主词下方副行', type: 'text', placeholder: '如：One prompt to a finished promo.', defaultValue: 'One prompt to a finished promo.', maxLength: 60, description: '40px 居中浅色副行，圆内字下升起；建议 ≤40 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/paper-title-card
  'typography/paper-title-card': {
    fields: [
      { key: 'title', label: '压印大标题（整句）', type: 'text', placeholder: '如：Direct the film. Let the agent shoot it.', defaultValue: 'Direct the film. Let the agent shoot it.', maxLength: 42, description: '116px 衬线大字逐词压印入场（scale 大→1 + blur→0），flex 自动换行居中；建议 ≤42 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '数字后的说明小字', type: 'text', placeholder: '如：shots rendered today', defaultValue: 'shots rendered today', maxLength: 28, description: '26px 等宽全大写小字，与滚动数字同行；建议 ≤28 字符，超出可能出画（仅横屏）' },
      { key: 'value', label: '基线滚动数字', type: 'text', placeholder: '如：12', defaultValue: '12', maxLength: 4, description: 'odometer 数字滚动（每位滚动 22f 落定，整卡 47f 起淡出）；建议 ≤4 位（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/pill-chip-slot-cycle-handled
  'typography/pill-chip-slot-cycle-handled': {
    fields: [
      { key: 'prefix', label: '胶囊左侧的前置词', type: 'text', placeholder: '如：Your / 你的', defaultValue: 'Your', maxLength: 12, description: '30px 粗体，胶囊左侧的一小段文字，被胶囊自然挤开；建议 ≤12 字符，过长会把胶囊和右侧词挤出画面（仅横屏）' },
      { key: 'suffix', label: '胶囊右侧的收尾词', type: 'text', placeholder: '如：Handled / 已包办', defaultValue: 'Handled', maxLength: 16, description: '30px 粗体，胶囊右侧的收尾文字；建议 ≤16 字符，过长会把胶囊和左侧词挤出画面（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/pill-slot-cycle
  'typography/pill-slot-cycle': {
    fields: [
      { key: 'stem', label: '固定句干（结论句前半）', type: 'text', placeholder: '如：One skill to / 一门手艺', defaultValue: 'One skill to', maxLength: 16, description: '96px 粗体句干，列举期间纹丝不动，收束后才随整句居中；建议 ≤16 字符，超出可能把 pill 与句尾挤出画面（仅横屏）' },
      { key: 'tail', label: '收束句尾（do it all.）', type: 'text', placeholder: '如：do it all. / 全都搞定', defaultValue: 'do it all.', maxLength: 16, description: '96px 粗体收束句，与句干合成整句并参与居中量宽；建议 ≤16 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/text-column-converge
  'typography/text-column-converge': {
    fields: [
      { key: 'label', label: '左侧前缀词（合拢后与右侧词标拼成一句）', type: 'text', placeholder: '如：NEW / 全新', defaultValue: 'NEW', maxLength: 3, description: '42px 等宽文字，合拢终点按「前缀 3 字符 + 空格」步进计算，建议保持 3 个字符，改长或改宽会与右侧词标咬合偏移（仅横屏）' },
      { key: 'subline', label: '合拢定格的斜体小字', type: 'text', placeholder: '如：CRAFT THE SHOT.', defaultValue: 'CRAFT THE SHOT.', maxLength: 20, description: '42px 等宽斜体、与整行同左缘，建议 ≤20 字符，超出可能出画（仅横屏）；轮播特性词仍沿用原常量' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/title-demote-to-label
  'typography/title-demote-to-label': {
    fields: [
      { key: 'title', label: 'A 式海报大标题单词（降格成节标签的那个词）', type: 'text', placeholder: '如：Frame / 定格', defaultValue: 'Frame', maxLength: 10, description: '220px 单词海报标题，逐字升起并降格为左上节标签；末尾朱红句点单独绘制，不用输入。建议 ≤10 字符，过长会顶到网格右边（仅横屏）' },
      { key: 'titleB', label: 'B 式大标题单词（带朱红选区、再降格）', type: 'text', placeholder: '如：Craft / 成片', defaultValue: 'Craft', maxLength: 10, description: 'B 式同字号标题，选区宽度按字符比例扫入，末尾朱红句点同样单独绘制。建议 ≤10 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/type-assembly-moves~TextOnPath
  'typography/type-assembly-moves~TextOnPath': {
    fields: [
      { key: 'title', label: '沿曲线流入并摆正的大标题', type: 'text', placeholder: '如：UP AND TO THE RIGHT / 一路向上', defaultValue: 'UP AND TO THE RIGHT', maxLength: 20, description: '92px 全大写标题逐字沿增长曲线流入、到点后抬升摆正，字符按实测字宽排布；建议 ≤20 字符（默认 19），超出会排到曲线外并可能出画（仅横屏）' },
      { key: 'eyebrow', label: '标题上方眉题', type: 'text', placeholder: '如：FY2026 · Annual report / 2026 年报', defaultValue: 'FY2026 · Annual report', maxLength: 32, description: '26px 等宽全大写眉题，在标题上方逐词升起；建议 ≤32 字符（默认 22），超出可能出画（仅横屏）' },
      { key: 'subline', label: '标题下方副句', type: 'text', placeholder: '如：Every quarter beat the last one. / 每一季都胜过上一季', defaultValue: 'Every quarter beat the last one.', maxLength: 40, description: '40px 副句在标题下方逐词模糊浮现；建议 ≤40 字符（默认 32），超出可能顶到画面右侧（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/type-entrance-moves
  'typography/type-entrance-moves': {
    fields: [
      { key: 'word', label: '坠落堆积的字标', type: 'text', placeholder: '如：Shotcraft / 不加班', defaultValue: '', maxLength: 9, description: '176px 大字逐字砸向地面并弹跳站定（默认留空，原 BRAND.short 已被移除）；建议 ≤9 字符，中文多于此会撑出画面（仅横屏）' },
      { key: 'caption', label: '副标题（回正后浮出）', type: 'text', placeholder: '如：Every shot lands on the beat.', defaultValue: 'Every shot lands on the beat.', maxLength: 30, description: '36px 居中副标题，帧 114 起浮出；建议 ≤30 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/type-rhythm-sync~FontWeightPump
  'typography/type-rhythm-sync~FontWeightPump': {
    fields: [
      { key: 'title', label: '主字大字（随鼓点变粗弹回的词）', type: 'text', placeholder: '如：LOUDER / 更大声', defaultValue: 'LOUDER', maxLength: 10, description: '240px 单行主字，逐字在 900 字重槽位里变粗再弹回，末尾落定渐变；建议 ≤8 字符，超出可能出画（仅横屏），字数变化会改变逐字脉冲的对称中心' },
      { key: 'subline', label: 'drop 后逐词升起的副标题', type: 'text', placeholder: '如：Beat-synced cuts, right on the drop.', defaultValue: 'Beat-synced cuts, right on the drop.', maxLength: 40, description: '40px 居中副标题，drop 后按词逐个升起；建议 ≤30 字符，超出可能出画（仅横屏），词数变化会改变升起结束时间' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/type-rhythm-sync~KaraokeFillSync
  'typography/type-rhythm-sync~KaraokeFillSync': {
    fields: [
      { key: 'line1', label: '第一行标语（卡拉OK逐词填色）', type: 'text', placeholder: '如：FRAME MOTION / 定住画面', defaultValue: 'FRAME MOTION', maxLength: 16, description: '150px 粗体居中标语，按空格拆词后沿用原词级时间表逐词填亮；建议两词、≤16 字符，超出可能出画（仅横屏）' },
      { key: 'line2', label: '第二行标语（卡拉OK逐词填色）', type: 'text', placeholder: '如：CRAFT SHOTS / 拍出镜头', defaultValue: 'CRAFT SHOTS', maxLength: 16, description: '与首行同字号同间距，第二行（CRAFT/SHOTS 槽位）逐词填亮；建议两词、≤16 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/typewriter-moves
  'typography/typewriter-moves': {
    fields: [
      { key: 'line1', label: '第一遍打出的句子（随后被逐字删掉大半）', type: 'text', placeholder: '如：just a slideshow / 先凑一版', defaultValue: 'just a slideshow', maxLength: 16, description: '100px 等宽单行，逐字打出后只保留开头 5 个字符、其余逐字退格删掉；建议 ≤16 字符，超出可能出画（仅横屏），字数变化会让删除帧与后续重打轻微重叠' },
      { key: 'line2', label: '重打后的收尾宣言', type: 'text', placeholder: '如：your cinematic crew / 你的电影班底', defaultValue: 'your cinematic crew', maxLength: 19, description: '100px 等宽单行，打字 1.5f/字符，打完才铺马克笔底色；建议 ≤19 字符，超出可能出画（仅横屏），字数变化会让底色与原文落点错位' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/vertical-word-roll-blur-cycle
  'typography/vertical-word-roll-blur-cycle': {
    fields: [
      { key: 'line1', label: '引导句（Crafted for）', type: 'text', placeholder: '如：Crafted for / 为…而生', defaultValue: 'Crafted for', maxLength: 20, description: '30px 粗体、滚轮列左侧的固定引导句；建议 ≤20 字符，超出会把竖向滚轮列挤出画面（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/word-relay-filmstrip
  'typography/word-relay-filmstrip': {
    fields: [
      { key: 'word', label: '轮播动词（末格定格词）', type: 'text', placeholder: '如：ships / 交付', defaultValue: 'ships', maxLength: 10, description: '第二行 140px 斜体大词，逐字升起后金光句点收尾；遮罩宽 760px，建议 ≤10 字符，超出会被裁切（仅横屏）。前两格 frames / builds 沿用原常量' },
      { key: 'caption', label: '证据注脚（对应末格）', type: 'text', placeholder: '如：PR #482 · approved · launch film', defaultValue: 'PR #482 · approved · launch film', maxLength: 36, description: '大词下方 32px 单行注脚，随动词接力淡入；建议 ≤36 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：typography/word-relay-geometry
  'typography/word-relay-geometry': {
    fields: [
      { key: 'word', label: '接力词（第一拍 Faster）', type: 'text', placeholder: '如：Faster / 更快', defaultValue: 'Faster', maxLength: 12, description: '230px 居中大字，三拍接力词的第一拍（其余两拍与副句不变）；单行不换行，建议 ≤12 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/avatar-bracket-carousel
  'ui-entrance/avatar-bracket-carousel': {
    fields: [
      { key: 'lead', label: '句首词（Your）', type: 'text', placeholder: '如：Your / 你的', defaultValue: 'Your', maxLength: 12, description: '34px 粗体句首词，与句尾词夹住中央对焦框头像槽；建议 ≤12 字符，超出会挤压中央槽位出画（仅横屏）' },
      { key: 'tail', label: '句尾词（agent）', type: 'text', placeholder: '如：agent / 智能体', defaultValue: 'agent', maxLength: 12, description: '34px 粗体句尾词，句子读作「Your 〔头像角色〕 agent」；建议 ≤12 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/bezier-source-converge-merge
  'ui-entrance/bezier-source-converge-merge': {
    fields: [
      { key: 'caption', label: '结尾字幕', type: 'text', placeholder: '如：From screenshot to showreel', defaultValue: 'From screenshot to showreel', maxLength: 40, description: '徽标下方单行居中字幕，按空格逐词加深；宽 240px、字号 13px 不换行，建议 ≤28 字符（默认 27 字符已接近满宽），超出可能出画（仅横屏）；词数以空格分隔，逐词节奏仍按默认 4 词计算' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/card-stack
  'ui-entrance/card-stack': {
    fields: [
      { key: 'title', label: '主标题（中心卡抽出时逐词升起）', type: 'text', placeholder: '如：Start from a shot recipe. / 从一条镜头配方开始。', defaultValue: 'Start from a shot recipe.', maxLength: 26, description: '88px 居中大标题，按词逐条升起；建议 ≤26 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '副句（标题下方一行说明）', type: 'text', placeholder: '如：Nine shot recipes. Every one ready to render. / 九条镜头配方，条条可直接出片。', defaultValue: 'Nine shot recipes. Every one ready to render.', maxLength: 56, description: '34px 居中副句，单行不换行；建议 ≤56 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/carousel-3d
  'ui-entrance/carousel-3d': {
    fields: [
      { key: 'kicker', label: '左上品牌标语（跟在品牌名后）', type: 'text', placeholder: '如：shot recipes / 镜头配方', defaultValue: 'shot recipes', maxLength: 20, description: '建议 ≤20 字，与品牌名组成「video-shotcraft · 标语」，超出可能出画（仅横屏）' },
      { key: 'label', label: '右上画质角标', type: 'text', placeholder: '如：1080P · 30 FPS', defaultValue: '1080P · 30 FPS', maxLength: 20, description: '建议 ≤20 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/clipcard-looping
  'ui-entrance/clipcard-looping': {
    fields: [
      { key: 'caption', label: '左上卡片字幕（未静音循环）', type: 'text', placeholder: '如：未静音 · 循环', defaultValue: 'muted=false · loop', maxLength: 20, description: '11px 等宽字幕条，卡片宽 200px、左右各留 18px 内边距，建议 ≤18 字符（默认 18 字符已接近满宽）；字幕条高度固定，超出会换行被裁切（仅横屏）' },
      { key: 'trimCaption', label: '右上卡片字幕（startFrom 循环）', type: 'text', placeholder: '如：起始帧 12 · 循环', defaultValue: 'startFrom=12 · loop', maxLength: 20, description: '11px 等宽字幕条，卡片宽 200px、左右各留 18px 内边距，建议 ≤18 字符（默认 20 字符已达满宽）；字幕条高度固定，超出会换行被裁切（仅横屏）' },
      { key: 'shortShotCaption', label: '下方卡片字幕（短 Sequence）', type: 'text', placeholder: '如：45 帧素材 · 120 帧镜头', defaultValue: '45f clip · 120f shot', maxLength: 20, description: '11px 等宽字幕条，卡片宽 200px、左右各留 18px 内边距，建议 ≤18 字符（默认 20 字符已达满宽）；字幕条高度固定，超出会换行被裁切（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/cloner-depth-echo
  'ui-entrance/cloner-depth-echo': {
    fields: [
      { key: 'title', label: '主标题第一行', type: 'text', placeholder: '如：One prompt.', defaultValue: 'One prompt.', maxLength: 20, description: '左上大标题第一行，按空格逐词自下升起；字号 112px、不换行，右侧从 x≈140 延伸到主卡左缘（≈1130px），建议 ≤12 字符（默认 11 字符已接近满宽），超出可能出画（仅横屏）' },
      { key: 'titleB', label: '主标题第二行', type: 'text', placeholder: '如：Eight shots.', defaultValue: 'Eight shots.', maxLength: 20, description: '左上大标题第二行，比第一行晚 6f 逐词升起；第二个词会染成荧光黄绿高亮，改写后仍按第 2 个词上色，建议保留 2 个以上单词；单行不换行，建议 ≤12 字符（默认 12 字符已接近满宽），超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/deck-deal-flyin
  'ui-entrance/deck-deal-flyin': {
    fields: [
      { key: 'title', label: '主标题第一行', type: 'text', placeholder: '如：Your product, / 你的产品，', defaultValue: 'Your product,', maxLength: 20, description: '满板后左下升起的 120px 800 字重白字首行，逐词升起；建议 ≤20 字符，明显超出原句长度会横向出画（仅横屏）' },
      { key: 'subline', label: '主标题第二行', type: 'text', placeholder: '如：in motion. / 动起来。', defaultValue: 'in motion.', maxLength: 20, description: '与首行同字号、300 字重的第二行，逐词升起；建议 ≤20 字符，超出可能盖住右侧板面（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/doc-park-left-pill-deal
  'ui-entrance/doc-park-left-pill-deal': {
    fields: [
      { key: 'title', label: '首张药丸标题（发牌第一张）', type: 'text', placeholder: '如：Crash Zoom / 推镜特写', defaultValue: 'Crash Zoom', maxLength: 12, description: '12.5px 药丸标题，单行不换行；药丸固定宽 172px 且左侧有图标，建议 ≤12 字符，超出可能出画（仅横屏）' },
      { key: 'caption', label: '首张药丸字幕（逐词加深一句）', type: 'text', placeholder: '如：Zoom lands the hero number / 推镜落在主视觉数字上', defaultValue: 'Zoom lands the hero number', maxLength: 30, description: '11px 逐词字幕，按空格分词并逐词加深；单行 nowrap，建议 ≤30 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/document-typewriter-reveal
  'ui-entrance/document-typewriter-reveal': {
    fields: [
      { key: 'title', label: '收尾标语主句（白色）', type: 'text', placeholder: '如：From screenshot', defaultValue: 'From screenshot', maxLength: 20, description: '底部左侧 84px 标语前半句，逐词升起；建议 ≤20 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '收尾标语强调尾句（紫色）', type: 'text', placeholder: '如：to showreel.', defaultValue: 'to showreel.', maxLength: 20, description: '紧跟主句、强调色尾句，同行 nowrap；建议 ≤20 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/draw-svg-trace
  'ui-entrance/draw-svg-trace': {
    fields: [
      { key: 'title', label: '主标题（卡片上墨时升起）', type: 'text', placeholder: '如：Cuts on the beat / 踩在拍点上的剪辑', defaultValue: 'Cuts on the beat', maxLength: 20, description: '72px 左栏大标题，单行不换行；建议 ≤20 字符，超出可能出画（仅横屏）' },
      { key: 'value', label: '重点词（标题下方朱红下划线所指）', type: 'text', placeholder: '如：100%', defaultValue: '100%', maxLength: 5, description: '188px 超大重点词，手绘朱红下划线压在其下方；建议 ≤5 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '说明句（重点词下方一段）', type: 'text', placeholder: '如：Every cut snaps to the downbeat. / 每一刀都卡在重拍上。', defaultValue: 'Every cut snaps to the downbeat. Rendered by video-shotcraft.', maxLength: 64, description: '32px 说明段，最多两行；建议 ≤64 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/element-body-moves
  'ui-entrance/element-body-moves': {
    fields: [
      { key: 'title', label: '主标题（三张配方卡上方逐词升起）', type: 'text', placeholder: '如：Pick your shot. / 挑一条镜头配方。', defaultValue: 'Pick your shot.', maxLength: 24, description: '120px 居中大标题，按词逐条升起；建议 ≤24 字符，超出可能出画（仅横屏）' },
      { key: 'eyebrow', label: '眉题（标题上方的大字距小字）', type: 'text', placeholder: '如：SHOT RECIPES · LAUNCH FILM / 镜头配方 · 发布片', defaultValue: 'SHOT RECIPES · LAUNCH FILM', maxLength: 32, description: '24px 等宽大写居中眉题，字距 0.16em；建议 ≤32 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/integration-hub-map
  'ui-entrance/integration-hub-map': {
    fields: [
      { key: 'title', label: '翻转前旧页主标题（近景正对镜头的那一页）', type: 'text', placeholder: '如：Launch Film v3 / 发布短片 v3', defaultValue: 'Launch Film v3', maxLength: 24, description: '26px 加粗标题，同行右侧还有「Edited 2h ago」，单行不换行；建议 ≤24 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/list-reveal
  'ui-entrance/list-reveal': {
    fields: [
      { key: 'title', label: '右侧大标题（两行）', type: 'text', placeholder: '如：Every shot,\\nwithin reach.', defaultValue: 'Every shot,\nwithin reach.', maxLength: 28, description: '120px 主标题逐行升起，\\n 表示换行；单行建议 ≤13 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '大标题下副句（两行）', type: 'text', placeholder: '如：Every recipe, render and storyboard,\\none keystroke away.', defaultValue: 'Every recipe, render and storyboard,\none keystroke away.', maxLength: 60, description: '36px 副句保留原有换行（\\n），建议 ≤56 字符，超出可能出画（仅横屏）' },
      { key: 'eyebrow', label: '标题上方品牌小字', type: 'text', placeholder: '如：video-shotcraft · workbench', defaultValue: 'video-shotcraft · workbench', maxLength: 40, description: '24px 等宽大写小字，字距 0.16em；建议 ≤36 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/list-stack-press
  'ui-entrance/list-stack-press': {
    fields: [
      { key: 'label', label: '右上角栏目名（计数器上方）', type: 'text', placeholder: '如：Paper Radar / 论文雷达', defaultValue: 'Paper Radar', maxLength: 18, description: '22px 等宽大写小标题，右对齐、距右边 96px；建议 ≤18 字符，超长会向左挤压堆叠区（仅横屏）' },
      { key: 'caption', label: '计数器下方说明（今日抓取量）', type: 'text', placeholder: '如：Of 31 Fetched Today / 今日已抓取 31 篇', defaultValue: 'Of 31 Fetched Today', maxLength: 24, description: '19px 等宽大写说明行，接在 220px 分隔线下方右对齐；建议 ≤24 字符，超出会向左伸过分隔线（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/neon-frame-forerun
  'ui-entrance/neon-frame-forerun': {
    fields: [
      { key: 'title', label: '问候大标题', type: 'text', placeholder: '如：Good morning, Dana / 早上好，Dana', defaultValue: 'Good morning, Dana', maxLength: 20, description: '66px 问候主标题，与右侧日期同一行；建议 ≤20 字符，超出会挤压日期并可能出画（仅横屏）' },
      { key: 'subline', label: '问候行日期副标题', type: 'text', placeholder: '如：Tue, Oct 14 / 10月14日 周二', defaultValue: 'Tue, Oct 14', maxLength: 20, description: '30px 灰色日期副标题，跟在问候大标题右侧；建议 ≤20 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/neon-frame-orbit-drop
  'ui-entrance/neon-frame-orbit-drop': {
    fields: [
      { key: 'title', label: '主页问候语（工作台左上角大标题）', type: 'text', placeholder: '如：Good morning, Dana / 早上好，Dana', defaultValue: 'Good morning, Dana', maxLength: 26, description: '28px 加粗问候语，与右侧日期同处一行；建议 ≤26 字符，超出可能与日期挤行或出画（仅横屏）' },
      { key: 'subline', label: '问候语右侧日期副行', type: 'text', placeholder: '如：Tuesday, Oct 14 / 10 月 14 日 周二', defaultValue: 'Tuesday, Oct 14', maxLength: 20, description: '14px 浅灰日期副行，紧跟问候语右侧、基线对齐；建议 ≤20 字符，超出会把问候语挤出画（仅横屏）' },
      { key: 'searchPlaceholder', label: '搜索框占位文案', type: 'text', placeholder: '如：Search shots, recipes and renders… / 搜索镜头、配方和渲染…', defaultValue: 'Search shots, recipes and renders…', maxLength: 44, description: '15px 搜索框内占位文字，框高固定 46px、右侧有 ⌘K 键位；建议 ≤44 字符，超出会挤压 ⌘K（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/product-card-progressive-assemble
  'ui-entrance/product-card-progressive-assemble': {
    fields: [
      { key: 'title', label: '商品标题（右侧栏 112px 大字）', type: 'text', placeholder: '如：Shotcraft / 镜头配方', defaultValue: 'Shotcraft', maxLength: 12, description: '详情卡右列主标题，112px 粗体单行不换行；建议 ≤12 字符，超出可能出画（仅横屏）' },
      { key: 'eyebrow', label: '眉标（标题上方的 mono 小字）', type: 'text', placeholder: '如：VIDEO-SHOTCRAFT · AGENT SKILL', defaultValue: 'VIDEO-SHOTCRAFT · AGENT SKILL', maxLength: 36, description: '标题上方 22px 等宽眉标，随标题一起升起；建议 ≤36 字符，超出会换行挤压标题（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/research-card-stack-scroll
  'ui-entrance/research-card-stack-scroll': {
    fields: [
      { key: 'title', label: '首张论文卡标题（t=0 的主卡）', type: 'text', placeholder: '如：Sparse Attention Mechanisms for Long-Context Reasoning / 长上下文推理的稀疏注意力机制', defaultValue: 'Sparse Attention Mechanisms for Long-Context Reasoning', maxLength: 52, description: '卡片顶部标题条 264px 宽、650 9.5px/1.35，最多约两行（y=40 起是作者行与摘要骨架，再长会被卡片裁切）；建议 ≤52 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/value-stagger-gradient
  'ui-entrance/value-stagger-gradient': {
    fields: [
      { key: 'line1', label: '代码条第一句（语法着色代码示例）', type: 'text', placeholder: '如：scale: stagger([1, 0.4])   hue: stagger([240, 340])', defaultValue: 'scale: stagger([1, 0.35])   hue: stagger([200, 320])', maxLength: 52, description: '代码条首句（设计坐标 480×270，字号 9.5px、条宽 316px）。未改动时按原 16 段 token 保留多色语法着色；改写后整行改为单色渲染。默认 52 字符已接近满宽，建议 ≤52 字符，超出可能出画（仅横屏）。' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：ui-entrance/wall-reveal-moves~BentoLightUp
  'ui-entrance/wall-reveal-moves~BentoLightUp': {
    fields: [
      { key: 'title', label: '主标题', type: 'text', placeholder: '如：Every shot, tuned in one place.', defaultValue: 'Every shot, tuned in one place.', maxLength: 20, description: 'bento 墙上方眉标下的 56px 主标题，随首格点亮提亮；建议 ≤20 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：data/before-after-slider-scrub
  'data/before-after-slider-scrub': {
    fields: [
      { key: 'beforeLabel', label: '分割线左侧角标（处理前）', type: 'text', placeholder: '如：Before', defaultValue: 'Before', maxLength: 12, description: '20px 半粗角标，白底胶囊高度固定 42px、单行不换行，左侧固定 x=1372；建议 ≤10 字符，过长会向右侧顶到时段切换区（仅横屏）' },
      { key: 'afterLabel', label: '分割线右侧角标（处理后）', type: 'text', placeholder: '如：After', defaultValue: 'After', maxLength: 12, description: '20px 半粗角标，深底胶囊跟着分割线一起被裁切，左侧固定 x=646；建议 ≤10 字符，过长会压到面包屑（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：data/chart-live-moves~OscilloscopeStreamV2
  'data/chart-live-moves~OscilloscopeStreamV2': {
    fields: [
      { key: 'eyebrow', label: '左上眉题', type: 'text', placeholder: '如：render-farm · prod · fps', defaultValue: 'render-farm · prod · fps', maxLength: 32, description: '标志旁的小字眉题，建议 ≤32 字符，超出可能挤到 LIVE 状态灯（仅横屏）' },
      { key: 'eventLabel', label: '尖峰事件标签', type: 'text', placeholder: '如：Burst', defaultValue: 'Burst', maxLength: 12, description: '峰顶事件标签，建议 ≤12 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：data/gauge-readout-moves~NeedleSweepSelftest
  'data/gauge-readout-moves~NeedleSweepSelftest': {
    fields: [
      { key: 'title', label: '卡头标题', type: 'text', placeholder: '如：Render node health', defaultValue: 'Render node health', maxLength: 20, description: '卡头 32px 半粗单行标题，与品牌标志、自检状态胶囊同排；建议 ≤20 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：data/gauge-readout-moves~TapeScrollFixedPointer
  'data/gauge-readout-moves~TapeScrollFixedPointer': {
    fields: [
      { key: 'title', label: '主标题（第一行）', type: 'text', placeholder: '如：Throughput', defaultValue: 'Throughput', maxLength: 14, description: '左侧 124px 粗体主标题，2f 起逐词升起；容器宽 760px，默认 10 字符约 640px，建议 ≤14 字符，超出可能换行或出画（仅横屏）' },
      { key: 'subline', label: '结论行（第二行）', type: 'text', placeholder: '如：tripled.', defaultValue: 'tripled.', maxLength: 12, description: '主标题下方 124px 钴蓝结论行，98f 起逐字符升起，行高固定 130px；建议 ≤12 字符，超出可能换行或出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：data/scroll-brake-moves~BrakeReticleLock
  'data/scroll-brake-moves~BrakeReticleLock': {
    fields: [
      { key: 'title', label: '停点条目标题', type: 'text', placeholder: '如：Motion workbench', defaultValue: 'Motion workbench', maxLength: 28, description: '急刹锁定的第 30 行 36px 粗体标题，占中间剩余宽度、单行不换行；建议 ≤20 字符，过长会挤压右侧版本号与日期列（仅横屏）' },
      { key: 'subline', label: '停点条目副标题', type: 'text', placeholder: '如：Every shot, tuned in one place.', defaultValue: 'Every shot, tuned in one place.', maxLength: 44, description: '停点条目标题下方 24px 说明行，单行不换行；建议 ≤36 字符，过长会压到右侧版本号列（仅横屏）' },
      { key: 'label', label: '右侧弹出发布标签', type: 'text', placeholder: '如：Just shipped', defaultValue: 'Just shipped', maxLength: 18, description: '急刹后从停点条目右侧弹出的深色胶囊文字，高度固定 56px、单行不换行；建议 ≤14 字符，过长会顶出画面右边缘（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：data/scroll-brake-moves~ChangelogScrollBrake
  'data/scroll-brake-moves~ChangelogScrollBrake': {
    fields: [
      { key: 'title', label: '页眉大标题', type: 'text', placeholder: '如：Changelog', defaultValue: 'Changelog', maxLength: 14, description: '顶部固定页眉的 52px 粗标题，与左侧镜刻标志、右侧品牌名同排（整列宽 1000px）；建议 ≤14 字，超出会挤到品牌名或出画（仅横屏）' },
      { key: 'targetTitle', label: '目标行标题（抬升高亮行）', type: 'text', placeholder: '如：Motion workbench', defaultValue: 'Motion workbench', maxLength: 18, description: '急刹停位后被抬升 + NEW 徽标的 36px 加粗标题，单行不换行；左侧固定版本号位 82px、右侧日期位 92px，中间可用约 600px；建议 ≤18 字，过长会顶出版本类型胶囊或日期（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：data/timeline-travel
  'data/timeline-travel': {
    fields: [
      { key: 'eyebrow', label: '页眉小标题（镜刻标志右侧）', type: 'text', placeholder: '如：Release history', defaultValue: 'Release history', maxLength: 18, description: '固定页眉第一行，30px 全大写，紧挨左侧镜刻标志、与主标题同列；整行从 x=120 起排、右侧留白充足；建议 ≤18 字，超出可能出画（仅横屏）' },
      { key: 'title', label: '页眉主标题', type: 'text', placeholder: '如：Shipping every month', defaultValue: 'Shipping every month', maxLength: 22, description: '固定页眉 56px 粗标题（带字距），位于小标题下方，与世界层横移无关、全程静止；建议 ≤22 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/autolayout-gap-dial
  'interaction/autolayout-gap-dial': {
    fields: [
      { key: 'eyebrow', label: '读数眉题', type: 'text', placeholder: '如：Auto layout · Gap', defaultValue: 'Auto layout · Gap', maxLength: 20, description: '22px 全大写眉题 + 0.28em 字距，居中排在超大读数上方，左侧带一个自动布局图标；建议 ≤20 字符，过长会向两侧顶到画布边缘（仅横屏）' },
      { key: 'layerName', label: '框选图层名', type: 'text', placeholder: '如：Nav links / 导航链接', defaultValue: 'Nav links', maxLength: 16, description: '26px 近白图层名，位于框选框左上角，后面紧跟「宽 × 高」尺寸文本；建议 ≤12 字符，过长会盖住尺寸读数或越出画布左侧（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/canvas-materialize-moves~DiagramCascadeBuild
  'interaction/canvas-materialize-moves~DiagramCascadeBuild': {
    fields: [
      { key: 'prompt', label: '顶部 prompt 命令条文案', type: 'text', placeholder: '如：Map the data model for Shotcraft', defaultValue: 'Map the data model for Shotcraft', maxLength: 40, description: '36px 单行命令条，逐字打出后生成下方结构图；建议 ≤33 字符（约等于默认文案），过长会顶到右侧提交键（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/canvas-materialize-moves~PanelToCanvasMaterialize
  'interaction/canvas-materialize-moves~PanelToCanvasMaterialize': {
    fields: [
      { key: 'title', label: '分镜板大标题', type: 'text', placeholder: '如：Launch film', defaultValue: 'Launch film', maxLength: 18, description: '板头 84px 衬线大标题，4f 起逐词升起，右侧紧跟「3 shots pinned」计数；标题区可用宽约 780px，建议 ≤18 字符，超出会向右顶到计数与右侧面板（仅横屏）' },
      { key: 'panelTitle', label: '右侧面板标题', type: 'text', placeholder: '如：Shot recipes', defaultValue: 'Shot recipes', maxLength: 16, description: '右侧面板 44px 粗体标题，同行右侧是「5 suggested」；面板内可用宽约 592px，建议 ≤16 字符，超出会挤压右侧计数（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/chip-grid-single-select-blackout
  'interaction/chip-grid-single-select-blackout': {
    fields: [
      { key: 'title', label: '主问句（84px 大字）', type: 'text', placeholder: '如：How would you like to pay?', defaultValue: 'How would you like to pay?', maxLength: 26, description: '眉题下方 84px 粗问句，逐词升起入场，收束段上移淡出；居中单行宽约 1600px，建议 ≤26 字符，过长会换行或出画（仅横屏）' },
      { key: 'eyebrow', label: '眉题标签（caps 小字）', type: 'text', placeholder: '如：· Billing cycle', defaultValue: '· Billing cycle', maxLength: 14, description: '眉题行右侧 22px 全大写强调色标签（入画时字距收拢），与镜刻标志、品牌名同排居中；建议 ≤14 字符，超出会挤开标志或出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/collab-cursor-moves
  'interaction/collab-cursor-moves': {
    fields: [
      { key: 'title', label: '中央简报卡标题（Rita 逐字打出）', type: 'text', placeholder: '如：Ship a launch film by Friday. / 周五前交付发布片。', defaultValue: 'Ship a launch film by Friday.', maxLength: 34, description: '88px 粗体标题，卡片内宽 944px（英文约 21 字符一行）并预留两行高度；建议 ≤34 字符（默认 29 字符已是两行），超出会压到底部负责人行（仅横屏）。逐字打字节奏按实际字数重排，空格处略停。' },
      { key: 'boardName', label: '左上角白板名（标志右侧）', type: 'text', placeholder: '如：Launch Film Kickoff / 发布片开工', defaultValue: 'Launch Film Kickoff', maxLength: 24, description: '32px 粗体白板名，紧跟在左上角镜刻标志右侧、后面接品牌名；建议 ≤24 字符，超出可能向右挤压品牌名（仅横屏）。' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/glass-pill-dictation-typing
  'interaction/glass-pill-dictation-typing': {
    fields: [
      { key: 'text', label: '听写文案', type: 'text', placeholder: '如：Cut a launch film for my app', defaultValue: 'Cut a launch film for my app', maxLength: 32, description: '56px 深墨色单行听写文字，光标先行、2 帧/字匀速打出；默认 28 字符正好在 8–64f 打满，建议 ≤28 字符，更长会拖过光退、并把字挤到右侧声波按钮上（仅横屏）' },
      { key: 'caption', label: '品牌小标后缀', type: 'text', placeholder: '如：speak or type / 说话或打字', defaultValue: 'speak or type', maxLength: 24, description: '底部 30px 浅灰小标，排在「品牌名 · 」之后，与中间的品牌小标同一行居中；建议 ≤16 字符，过长会把整行往两侧撑开（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/hashtag-to-pill-materialize
  'interaction/hashtag-to-pill-materialize': {
    fields: [
      { key: 'title', label: '成品页主标题', type: 'text', placeholder: '如：My favorite shots', defaultValue: 'My favorite shots', maxLength: 22, description: '揭示后成品笔记页的 122px 墨绿大标题，左起 160px、右侧留 160px 安全边；默认 17 字符约 1150px，建议 ≤20 字符，再长会向右顶出画布（仅横屏）' },
      { key: 'pillLabel', label: '胶囊话题词', type: 'text', placeholder: '如：shots', defaultValue: 'shots', maxLength: 7, description: '灰胶囊与揭示后鼠尾草绿胶囊共用的 132px 话题词（# 位已换成场记板图标）；胶囊宽固定 740px，默认 5 字符约占 340px，建议 ≤6 字符，7 字符已贴近内宽、再多会溢出胶囊右缘（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/picker-carousel-feature-cycle
  'interaction/picker-carousel-feature-cycle': {
    fields: [
      { key: 'title', label: '首项功能名（焦点药丸里的第一行）', type: 'text', placeholder: '如：Shot recipe cards / 镜头配方卡', defaultValue: 'Shot recipe cards', maxLength: 26, description: '选择器第一项功能名，t=0 起就停在中心焦点药丸里（17px 半粗，左侧跟 13px 线性图标、gap 8），其余 6 项仍用固定功能名；视口宽仅 300px、文字与图标居中且超出会被上下渐隐遮罩裁切，建议 ≤26 字符（中文 ≤12 字），超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/segmented-thumb-hero
  'interaction/segmented-thumb-hero': {
    fields: [
      { key: 'promptLabel', label: '左段标签（旧身份）', type: 'text', placeholder: '如：Prompt / 提示词', defaultValue: 'Prompt', maxLength: 12, description: '72px 粗体段标签，左段宽 524px，左侧固定挂着 78px 对话气泡图标，thumb 滑走后变灰；建议 ≤8 字符，过长会挤到右段或越出胶囊（仅横屏）' },
      { key: 'filmLabel', label: '右段标签（新身份）', type: 'text', placeholder: '如：Film / 成片', defaultValue: 'Film', maxLength: 12, description: '72px 粗体段标签，右段宽 524px，左侧固定挂着 78px 场记板图标，白色 thumb 滑到位后此处变墨色；建议 ≤8 字符，过长会顶出胶囊右缘（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/theme-switch-moves~PaletteThemeRipple
  'interaction/theme-switch-moves~PaletteThemeRipple': {
    fields: [
      { key: 'title', label: '样片库大标题', type: 'text', placeholder: '如：Gallery / 样片库', defaultValue: 'Gallery', maxLength: 14, description: '112px 超粗大标题，位于主区左上角，浅深两版主题共用；建议 ≤14 字符，过长会向右顶出画布（仅横屏）' },
      { key: 'nowPlaying', label: '底部播放条曲名', type: 'text', placeholder: '如：Launch Film / 发布短片', defaultValue: 'Launch Film', maxLength: 16, description: '28px 曲名，在底部播放条左侧、副行「Preview · Shot 04」上方，文本区宽 330px；建议 ≤14 字，过长会换行挤高播放条或压到副行（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/theme-switch-moves~ThemeSweepToggle
  'interaction/theme-switch-moves~ThemeSweepToggle': {
    fields: [
      { key: 'title', label: '周标题', type: 'text', placeholder: '如：September 14 – 18', defaultValue: 'September 14 – 18', maxLength: 20, description: '日历窗口标题行的 64px 粗体周标题（日期跨度），位于顶栏下方左对齐；可用宽约 720px，建议 ≤20 字符，超出会向右顶到「WEEK 38」眉题（仅横屏）' },
      { key: 'eyebrow', label: '周序眉题', type: 'text', placeholder: '如：WEEK 38', defaultValue: 'WEEK 38', maxLength: 12, description: '紧跟周标题右侧的 26px 全大写眉题（第几周），带 0.08em 字距并下沉 8px；建议 ≤12 字符，过长会挤压右侧「Launch film · ships Friday」（仅横屏）' },
      { key: 'subline', label: '右侧备注', type: 'text', placeholder: '如：Launch film · ships Friday', defaultValue: 'Launch film · ships Friday', maxLength: 28, description: '标题行最右侧的 26px 灰色备注（本周主题 / 交付节奏），右对齐贴住窗口内边距；建议 ≤28 字符，超出会向左压到周序眉题（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/type-and-filter
  'interaction/type-and-filter': {
    fields: [
      { key: 'query', label: '搜索框输入文案', type: 'text', placeholder: '如：nano-lab / 渲染队列', defaultValue: 'nano-lab', maxLength: 12, description: '搜索框里逐字键入的关键词，也是触发过滤动画的文案；15px 无衬线字、3 帧/字符匀速打字，位于相机贴近的搜索输入框内；建议 ≤8 字符（与原句等长），过长会延续到相机拉远与点击之后（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：interaction/voice-waveform-live
  'interaction/voice-waveform-live': {
    fields: [
      { key: 'hint', label: '开口提示语', type: 'text', placeholder: '如：Describe your next shot…', defaultValue: 'Describe your next shot…', maxLength: 28, description: '开场上半屏 92px 居中提示语，首词落下前淡出；默认 24 字符，建议 ≤24 字符，过长会向两侧出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：rhythm/beat-cut-moves
  'rhythm/beat-cut-moves': {
    fields: [
      { key: 'eyebrow', label: '奖牌卡眉题（桂冠旁）', type: 'text', placeholder: '如：Best in Motion · 2026', defaultValue: 'Best in Motion · 2026', maxLength: 30, description: '22px 全大写香槟金小字，位于月桂徽记右侧（卡内 x≈163、y=56），卡宽 700px、可用约 490px；样式带 text-transform，输入小写也会显示为大写；建议 ≤30 字符，过长会顶到卡片右缘（仅横屏）' },
      { key: 'title', label: '奖牌卡主标题', type: 'text', placeholder: '如：Shot of the Year', defaultValue: 'Shot of the Year', maxLength: 18, description: '72px 粗标题，卡面左上（left=58、top=136）、字距 -0.035em，可用宽度约 580px；第三闪会放大到 2.8 倍特写，建议 ≤18 字符（西文约 16 字符），超出会溢出卡片右缘（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：rhythm/beat-step-list-theme-cycle
  'rhythm/beat-step-list-theme-cycle': {
    fields: [
      { key: 'title', label: '左侧主标题（Make it）', type: 'text', placeholder: '如：Make it', defaultValue: 'Make it', maxLength: 24, description: '132px 细体单行不换行，右对齐贴着中央胶囊，左侧只留 470px 占位宽；建议 ≤12 字符，超出可能被胶囊压住或挤出画面（仅横屏）' },
      { key: 'label', label: '右上主题计数标签', type: 'text', placeholder: '如：THEME', defaultValue: 'THEME', maxLength: 12, description: '24px 加字距的计数标签，位于右上「/ 05」左侧、整体右贴安全边距；建议 ≤10 字符，过长会向左挤压计数（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：rhythm/panel-grid-moves
  'rhythm/panel-grid-moves': {
    fields: [
      { key: 'title', label: '结尾海报主标题', type: 'text', placeholder: '如：Craft\\nthe shot.', defaultValue: 'Craft\nthe shot.', maxLength: 20, description: '镜头吃屏成海报后左上的 150px 粗体大标题，逐行升起；用换行符 \\n 分行，每行独立升起，建议 2 行、每行 ≤10 字，总长 ≤20 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '海报副标题', type: 'text', placeholder: '如：Three angles, cut on the beat.', defaultValue: 'Three angles, cut on the beat.', maxLength: 28, description: '大标题下方的 38px 次级说明，按词逐字模糊入画，最大宽度 640px 自动折行；建议 ≤28 字，超出可能叠层或出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：rhythm/sakuga-timing-shift
  'rhythm/sakuga-timing-shift': {
    fields: [
      { key: 'subline', label: '赛璐珞卡副标题（every frame, crafted）', type: 'text', placeholder: '如：every frame, crafted / 每一帧都手作', defaultValue: 'every frame, crafted', maxLength: 20, description: '38px 单行，位于 600×360 赛璐珞卡内、160px「30fps」大字下方；卡内可用宽约 520px（左右各 40px 内边距）、overflow 裁切且不换行，建议 ≤14 字符（中文 ≤12），超出会被卡片裁掉（仅横屏）' },
      { key: 'eyebrow', label: '右上摄影表抬头（SC 012 · CUT 04）', type: 'text', placeholder: '如：SC 012 · CUT 04', defaultValue: 'SC 012 · CUT 04', maxLength: 20, description: '26px 等宽字 +0.12em 字距、右对齐贴右边距 150px，与左上「ON 3s」角标同高；建议 ≤16 字符，过长会向左压到角标（仅横屏）' },
      { key: 'caption', label: '摄影表左下标题（Exposure sheet）', type: 'text', placeholder: '如：Exposure sheet / 摄影表', defaultValue: 'Exposure sheet', maxLength: 20, description: '32px 单行，与右侧等宽小字「1 sec · 30 frames」在 1494px 宽的摄影表下用 space-between 首尾对齐；建议 ≤16 字符，过长会挤到右标签（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：rhythm/speed-ramp-freeze
  'rhythm/speed-ramp-freeze': {
    fields: [
      { key: 'caption', label: '定格批注主句', type: 'text', placeholder: '如：Ship this first.', defaultValue: 'Ship this first.', maxLength: 18, description: '定格后右上角升起的 68px 粗体钴蓝批注（left=1318、top=112，按词逐词升起、不换行）；手绘下划线固定画到 x≈1728、宽约 410px，建议 ≤16 字符（含空格），超出可能出画（仅横屏）' },
      { key: 'byline', label: '批注署名', type: 'text', placeholder: '如：Marco · design review', defaultValue: 'Marco · design review', maxLength: 30, description: '批注下方 30px 署名一行，左侧是 34px 圆形头像「M」，left=1322、top=240；可用宽度约 450px，建议 ≤30 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：rhythm/trailer-grammar-moves
  'rhythm/trailer-grammar-moves': {
    fields: [
      { key: 'eyebrow', label: '开场眉题', type: 'text', placeholder: '如：INTRODUCING', defaultValue: 'INTRODUCING', maxLength: 24, description: '标题字卡最上方的琥珀色小字（34px、全大写、0.18em 字距），位于主标题上方 30px；建议 ≤24 字，超出可能出画（仅横屏）' },
      { key: 'subline', label: '开场副题', type: 'text', placeholder: '如：Cinematic product videos, crafted by your agent.', defaultValue: 'Cinematic product videos, crafted by your agent.', maxLength: 44, description: '主标题下方的品牌副题（40px 灰色、带字距），晚眉题 6 帧跟进淡入；建议 ≤44 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/assemble-then-type-flyin
  'effects/assemble-then-type-flyin': {
    fields: [
      { key: 'title', label: '主标题首行（112px 衬线大字）', type: 'text', placeholder: '如：Frame motion.', defaultValue: 'Frame motion.', maxLength: 16, description: '112px 衬线单行不换行，从 x=120 起排、右侧让出 640px 调色台卡；第二行「Craft the shot.」带金色分段、沿用原稿不改。建议 ≤16 字符，超出可能出画（仅横屏）' },
      { key: 'kicker', label: '眉标小字（金色等宽）', type: 'text', placeholder: '如：AGENT SKILL · BUILT ON REMOTION', defaultValue: 'AGENT SKILL · BUILT ON REMOTION', maxLength: 36, description: '24px 等宽金色眉标（0.12em 字距），排在 112px 主标题上方、字号恒定不变；建议 ≤36 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '主标题下的说明句', type: 'text', placeholder: '如：Cinematic product videos, crafted by your agent.', defaultValue: 'Cinematic product videos, crafted by your agent.', maxLength: 54, description: '36px 浅色说明句，单行不换行，排在分隔线上方、右侧让出调色台卡与色轮；建议 ≤54 字符（汉字更宽，约 ≤26 字），超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/aurora-bloom-bg-flip
  'effects/aurora-bloom-bg-flip': {
    fields: [
      { key: 'title', label: '开场句（极光升起时逐词模糊退场的文案）', type: 'text', placeholder: '如：Promos took weeks', defaultValue: 'Promos took weeks', maxLength: 24, description: '26px 居中文案，先于底色反转逐词 blur-out；改写后仍按空格分词逐词退场，词数变多会拖长退场节奏。建议 ≤22 字符、2–3 词，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/brand-frame-snap
  'effects/brand-frame-snap': {
    fields: [
      { key: 'value', label: '卡面定价主数值（124px 大字）', type: 'text', placeholder: '如：$0', defaultValue: '$0', maxLength: 4, description: '推广卡上最大的字，右侧紧跟固定小字 “/ forever”；建议 ≤4 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '定价下方的价值主张', type: 'text', placeholder: '如：Your product, in motion.', defaultValue: 'Your product, in motion.', maxLength: 40, description: '22px 中性小字，卡片内宽 404px 自动换行；建议 ≤36 字符（仅横屏）' },
      { key: 'eyebrow', label: '卡右上角标签胶囊', type: 'text', placeholder: '如：Open source', defaultValue: 'Open source', maxLength: 18, description: '18px 灰底胶囊，与左侧品牌标志同一行；建议 ≤16 字符，超出可能挤出卡外（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/fui-hud-moves
  'effects/fui-hud-moves': {
    fields: [
      { key: 'title', label: '锁定标签主文案', type: 'text', placeholder: '如：Top pages', defaultValue: 'Top pages', maxLength: 20, description: '咬合后弹出胶囊里的卡名主文案，建议 ≤20 字符，超出可能顶到右侧锁定编号（仅横屏）' },
      { key: 'lockLabel', label: '锁定编号', type: 'text', placeholder: '如：LOCK 02', defaultValue: 'LOCK 02', maxLength: 12, description: '胶囊右侧等宽小字编号，建议 ≤12 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/glow-flyline-moves~GlowOrbAmbient
  'effects/glow-flyline-moves~GlowOrbAmbient': {
    fields: [
      { key: 'title', label: '卡面主标题（160px 大字）', type: 'text', placeholder: '如：Launch film', defaultValue: 'Launch film', maxLength: 12, description: '磨砂玻璃卡左侧最大的一行标题，逐字 blur 揭示；建议 ≤12 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '标题下方卖点说明', type: 'text', placeholder: '如：Beat-synced cuts · film-grade SFX', defaultValue: 'Beat-synced cuts · film-grade SFX', maxLength: 44, description: '36px 单行说明，按词揭示，不与标题同行；建议 ≤44 字符，超出可能出画（仅横屏）' },
      { key: 'label', label: '顶栏右侧状态胶囊', type: 'text', placeholder: '如：Now playing', defaultValue: 'Now playing', maxLength: 16, description: '顶栏绿点后面的胶囊文字，胶囊宽度随文字变化；建议 ≤16 字符，超出可能挤出卡外（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/glow-flyline-moves~OrbFlylineRelay
  'effects/glow-flyline-moves~OrbFlylineRelay': {
    fields: [
      { key: 'title', label: '收束标题（72px 逐词升起）', type: 'text', placeholder: '如：Say it once. Your agent does the rest.', defaultValue: 'Say it once.  does the rest.', maxLength: 30, description: '画面下缘 top=862 的单行标题，92f 起逐词升起；原句中间的品牌名已移除（BRAND.name 为空），故默认值该处留一个空档。第 4 个词固定用青色强调，改写时如需保留高亮，把要强调的词放在第 4 位。建议 ≤30 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/icon-performance-moves
  'effects/icon-performance-moves': {
    fields: [
      { key: 'title', label: '功能面板主标题（68px 大字）', type: 'text', placeholder: '如：Every shot, tuned.', defaultValue: 'Every shot, tuned.', maxLength: 20, description: '落定后从图标右上角弹簧展开的面板上最大的一行标题（面板宽 860、内边距 46，单行不换行）；建议 ≤20 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/impact-feedback/HitCounter
  'effects/impact-feedback/HitCounter': {
    fields: [
      { key: 'title', label: '收尾收益句（60px 逐词升起）', type: 'text', placeholder: '如：Up to a week back on every promo.', defaultValue: 'Up to a week back on every promo.', maxLength: 44, description: '画面底部居中、60px 单行文案，三击打完后逐词 rise 入场；街机黄高亮固定落在第 3、4 个词上（原为 a week），改写后位置不变。建议 ≤40 字符（约 ≤18 汉字），超出可能出画（仅横屏）' },
      { key: 'eyebrow', label: '左上角眉标（品牌名右侧小字）', type: 'text', placeholder: '如：What’s new', defaultValue: 'What’s new', maxLength: 20, description: '24px 等宽大写眉标（0.24em 字距），紧跟左上角品牌标识，字号与位置恒定；建议 ≤16 字符（约 ≤8 汉字），超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/light-play-moves~SheenSweepRetry
  'effects/light-play-moves~SheenSweepRetry': {
    fields: [
      { key: 'title', label: '左栏编辑式主标题（两行）', type: 'text', placeholder: '如：Cinematic,\nby default.', defaultValue: 'Cinematic,\nby default.', maxLength: 24, description: '118px 特大标题，按行逐行升起；用换行符分隔两行，左栏宽 640px，建议每行 ≤12 字符、共 ≤24 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '标题下方两行正文', type: 'text', placeholder: '如：Shot recipe cards for your agent.\nFrom screenshot to showreel.', defaultValue: 'Shot recipe cards for your agent.\nFrom screenshot to showreel.', maxLength: 60, description: '34px 正文，换行符处断行（最多两行最稳）；建议每行 ≤32 字符、共 ≤60 字符，超出可能出画（仅横屏）' },
      { key: 'cta', label: '底部胶囊按钮文案', type: 'text', placeholder: '如：Make your first film', defaultValue: 'Make your first film', maxLength: 24, description: '30px 黑底胶囊内文字，右侧固定跟随 ➜ 箭头，胶囊宽度随文字变化；建议 ≤24 字符，超出可能挤出卡片区（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/light-play-moves~SpotlightSweepReveal
  'effects/light-play-moves~SpotlightSweepReveal': {
    fields: [
      { key: 'title', label: '追光扫亮的主标题', type: 'text', placeholder: '如：Craft the shot.', defaultValue: 'Craft the shot.', maxLength: 16, description: '220px 衬线单行大字，被追光扫到才亮（最后一个空格后的词自动转斜体强调，默认「shot.」）；建议 ≤16 字符，超出可能出画（仅横屏）' },
      { key: 'eyebrow', label: '标题上方的金色眉题', type: 'text', placeholder: '如：Tonight · World premiere', defaultValue: 'Tonight · World premiere', maxLength: 34, description: '标题上方 24px 金色全大写小字，两侧细线随入场收拢；建议 ≤34 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '标题下方的副标题', type: 'text', placeholder: '如：Cinematic product videos, crafted by your agent.', defaultValue: 'Cinematic product videos, crafted by your agent.', maxLength: 64, description: '标题下方 44px 浅色副行（品牌字标之上），全亮后上浮淡入；建议 ≤56 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/radial-ripple-phone-chips
  'effects/radial-ripple-phone-chips': {
    fields: [
      { key: 'title', label: '手机屏内 feed 大标题', type: 'text', placeholder: '如：Shot library / 镜头库', defaultValue: 'Shot library', maxLength: 16, description: '手机屏内 44px 粗体 feed 标题，可用宽度约 356px；建议 ≤14 字符，超出会换行并顶开下方精选卡（仅横屏）' },
      { key: 'subline', label: '收尾品牌字标下的一句标语', type: 'text', placeholder: '如：Every shot, tuned in one place. / 每个镜头，都在这里调好。', defaultValue: 'Every shot, tuned in one place.', maxLength: 44, description: '左下角 32px 标语，逐词模糊升起，单行不换行；建议 ≤40 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/riso-print-hits
  'effects/riso-print-hits': {
    fields: [
      { key: 'title', label: '撞停大字标题第一行（300px 特粗）', type: 'text', placeholder: '如：CRAFT IT', defaultValue: 'CRAFT IT', maxLength: 12, description: '300px 黑体首行，左起 120px、画面宽 1920px；建议 ≤8 字符，超出会压住右侧半调太阳或出画（仅横屏）' },
      { key: 'subline', label: '撞停大字标题第二行（收束口号）', type: 'text', placeholder: '如：LOUD.', defaultValue: 'LOUD.', maxLength: 12, description: '与第一行同为 300px 大字，行高 0.84；建议 ≤8 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/scan-bracket-sweep
  'effects/scan-bracket-sweep': {
    fields: [
      { key: 'title', label: '文档页眉主标题', type: 'text', placeholder: '如：Launch Film — Shot List', defaultValue: 'Launch Film — Shot List', maxLength: 28, description: '文档页眉 8.6px 半粗标题，从左侧图标旁排到右上角页数 chip 前，单行不换行；建议 ≤28 字符，超出可能撞到 chip（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/scanline-annotate-focus
  'effects/scanline-annotate-focus': {
    fields: [
      { key: 'title', label: '官网 H1 首行（120px 粗黑大字）', type: 'text', placeholder: '如：Your product, / 你的产品，', defaultValue: 'Your product,', maxLength: 20, description: '被扫描的品牌页 H1 第一行，850 字重、120px、单行不换行，左起 x=60；第二行「in motion.」沿用原稿、其中 motion. 为赤陶色强调不改。建议 ≤20 字符，明显超出原句会横向出画（仅横屏）' },
      { key: 'subline', label: 'H1 下方正文说明句', type: 'text', placeholder: '如：Cinematic product videos, crafted by your agent. / 由你的 agent 打造的院线级产品片。', defaultValue: 'Cinematic product videos, crafted by your agent. From screenshot to showreel.', maxLength: 90, description: 'H1 与 CTA 之间的 34px 灰色正文，宽 700px 自动换行；此处余量只容约两行，建议 ≤90 字符（约 ≤45 个汉字），再长会压到下方按钮（仅横屏）' },
      { key: 'label', label: '赤陶色 CTA 按钮文案', type: 'text', placeholder: '如：Render a launch film / 渲染发布片', defaultValue: 'Render a launch film', maxLength: 24, description: '按钮内的 30px 文案，右箭头「→」不在可编辑范围内；按钮宽度随文字增长，建议 ≤24 字符，过长会盖住右侧产品图卡（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/scanline-assemble-flyin
  'effects/scanline-assemble-flyin': {
    fields: [
      { key: 'title', label: '主标题首行（120px 粗体大字）', type: 'text', placeholder: '如：Shoot the', defaultValue: 'Shoot the', maxLength: 14, description: '120px 粗体主标题第一行，槽位宽 820px 且不换行；第二行「launch film.」带蓝色渐变、沿用独立字段。建议 ≤11 字符（汉字更宽，约 ≤6 字），超出可能出画（仅横屏）' },
      { key: 'subline', label: '主标题第二行（渐变强调词）', type: 'text', placeholder: '如：launch film.', defaultValue: 'launch film.', maxLength: 14, description: '120px 主标题第二行，电光蓝→青渐变填充，固定在 <br/> 之后的同一行内；建议 ≤11 字符（汉字约 ≤6 字），超出可能出画（仅横屏）' },
      { key: 'cta', label: '主按钮文案', type: 'text', placeholder: '如：Start shooting', defaultValue: 'Start shooting', maxLength: 16, description: '30px 渐变胶囊主按钮文案，胶囊宽度随文字自适应、只有一个按钮，过长会挤压右侧「Watch the film」；建议 ≤15 字符（汉字约 ≤8 字），超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/slam-entrance-moves~ImpactBurstKit
  'effects/slam-entrance-moves~ImpactBurstKit': {
    fields: [
      { key: 'title', label: '页面主标题', type: 'text', placeholder: '如：One prompt to a finished promo.', defaultValue: 'One prompt to a finished promo.', maxLength: 36, description: '规格页顶部 76px 粗体大标题，位于眉题标志行下方；建议 ≤30 字符，超出可能超出页面右边距（仅横屏）' },
      { key: 'label', label: '主卡顶部弹出的签', type: 'text', placeholder: '如：DIRECTOR\'S CUT', defaultValue: 'DIRECTOR\'S CUT', maxLength: 16, description: '落定后从主卡顶缘弹出的钴蓝胶囊标签（22px 等宽字、0.12em 字距，胶囊随内容自适应）；建议 ≤16 字符，过长会横向出卡（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/slam-entrance-moves~KanadaPerspectiveSnap
  'effects/slam-entrance-moves~KanadaPerspectiveSnap': {
    fields: [
      { key: 'title', label: '片名首行（92px 大字）', type: 'text', placeholder: '如：Launch', defaultValue: 'Launch', maxLength: 12, description: '卡面 92px 片名第一行，位于 360px 宽信息栏内且不换行；建议 ≤8 字符（汉字约 ≤4 字），超出可能出画（仅横屏）' },
      { key: 'titleB', label: '片名第二行（92px 大字）', type: 'text', placeholder: '如：Film', defaultValue: 'Film', maxLength: 10, description: '92px 片名第二行，固定在 <br/> 之后并与首行同字号；建议 ≤6 字符（汉字约 ≤2 字），超出可能出画（仅横屏）' },
      { key: 'cta', label: '主按钮文案', type: 'text', placeholder: '如：Watch now', defaultValue: 'Watch now', maxLength: 16, description: '白色胶囊主按钮文案，与左侧播放图标同排、宽度随文字自适应；建议 ≤11 字符（汉字约 ≤5 字），超出可能挤压右侧圆形按钮（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/slam-entrance-moves~ScoreSlam
  'effects/slam-entrance-moves~ScoreSlam': {
    fields: [
      { key: 'title', label: '比分卡下方主标题（84px 逐词升起）', type: 'text', placeholder: '如：Shotcraft lifts the Cup.', defaultValue: 'Shotcraft lifts the Cup.', maxLength: 34, description: '画面下缘 top=792 的 84px 单行标题，36f 起逐词升起；按最后一个空格切分，末词固定用香槟金强调（原为 Cup.），改写时把要强调的词放在最后。建议 ≤26 字符（约 ≤13 汉字），超出可能出画（仅横屏）' },
      { key: 'kicker', label: '比分卡顶部金色标签', type: 'text', placeholder: '如：FULL TIME · 90+4′', defaultValue: 'FULL TIME · 90+4′', maxLength: 20, description: '砸落落定后从卡顶滑出的金色胶囊徽标（24px 等宽大写、0.12em 字距），宽度随文案自适应、居中；建议 ≤16 字符，超出可能挤出卡片（仅横屏）' },
      { key: 'subline', label: '主标题下的副句', type: 'text', placeholder: '如：Camera moves I would have keyframed for a week.', defaultValue: 'Camera moves I would have keyframed for a week.', maxLength: 54, description: '84px 主标题下方 36px 中性小字，52f 起淡入并上移落位，单行不换行；建议 ≤46 字符（约 ≤23 汉字），超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：effects/spotlight-sweep-moves~CornerSpotlightReveal
  'effects/spotlight-sweep-moves~CornerSpotlightReveal': {
    fields: [
      { key: 'title', label: '镜头库页主标题', type: 'text', placeholder: '如：Shots', defaultValue: 'Shots', maxLength: 20, description: '自绘镜头库界面左上角的 118px 粗体页标题，聚光扫到时最先被点亮；建议 ≤20 个字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/basic-3d-scene
  'camera/basic-3d-scene': {
    fields: [
      { key: 'title', label: '落版主标题', type: 'text', placeholder: '如：Craft the shot.', defaultValue: 'Craft the shot.', maxLength: 20, description: '总览落版 150px 衬线大字，按词从线下逐词升起；建议 ≤20 字符，超出可能出画（仅横屏）' },
      { key: 'eyebrow', label: '落版眉题', type: 'text', placeholder: '如：· Three chapters, one film', defaultValue: '· Three chapters, one film', maxLength: 32, description: '字标右侧 24px 金色全大写小字，字距随入场收拢；建议 ≤32 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '落版副句', type: 'text', placeholder: '如：Shot recipes for cinematic product films.', defaultValue: 'Shot recipes for cinematic product films.', maxLength: 48, description: '主标题下方 38px 浅色副句，淡入并上浮 14px；建议 ≤48 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/crash-zoom-punch~CrashImpactReal
  'camera/crash-zoom-punch~CrashImpactReal': {
    fields: [
      { key: 'value', label: '右栏荧光主数值（250px 大字）', type: 'text', placeholder: '如：P0', defaultValue: 'P0', maxLength: 4, description: '画面里最大的字，240px 荧光等宽；右栏可用宽度仅 400px，建议 ≤2 字符，超出会挤出画面（仅横屏）' },
      { key: 'headline', label: '主数值下方的说明句', type: 'text', placeholder: '如：7 open questions', defaultValue: '7 open questions', maxLength: 28, description: '40px 说明句，位于主数值与细线下方；右栏 400px 内自动换行，建议 ≤16 字符，过长可能压到下一行说明（仅横屏）' },
      { key: 'caption', label: '底部次级说明', type: 'text', placeholder: '如：Routing ships first.', defaultValue: 'Routing ships first.', maxLength: 32, description: '32px 次要说明，垫在说明句下方；建议 ≤22 字符，超出可能在右栏折行（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/crash-zoom-punch~CrashZoomReal
  'camera/crash-zoom-punch~CrashZoomReal': {
    fields: [
      { key: 'value', label: '右栏超大读数（232px 逐字升起）', type: 'text', placeholder: '如：−41%', defaultValue: '−41%', maxLength: 8, description: '跟随左移后右栏出现的 232px 粗体主读数，71f 起逐字符从线下升起（clipPath 只裁下沿）；建议 ≤6 字符（约 ≤3 汉字），超出可能出画（仅横屏）' },
      { key: 'label', label: '读数下方的说明词（52px）', type: 'text', placeholder: '如：inference cost', defaultValue: 'inference cost', maxLength: 24, description: '232px 数字下方 52px 说明词，79f 起逐词模糊升起，单行不换行；建议 ≤20 字符（约 ≤10 汉字），超出可能出画（仅横屏）' },
      { key: 'subline', label: '右栏底部限定句（40px）', type: 'text', placeholder: '如：at equal accuracy, routed per query', defaultValue: 'at equal accuracy, routed per query', maxLength: 56, description: '40px 灰色补充说明，83f 起逐词模糊升起，可自动折行；建议 ≤40 字符（约 ≤20 汉字），超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/cursor-flyover
  'camera/cursor-flyover': {
    fields: [
      { key: 'title', label: '首站模块标题', type: 'text', placeholder: '如：Frames rendered', defaultValue: 'Frames rendered', maxLength: 20, description: '第一站特写模块左上角 34px 标题，相机贴近到 1.3 倍时约 44px；建议 ≤20 字符，超出可能出画（仅横屏）' },
      { key: 'value', label: '首站大数字读数（点击后）', type: 'text', placeholder: '如：7.31M', defaultValue: '7.31M', maxLength: 8, description: '点击 90D 后从线下升起的 150px 大数字（替换旧值 2.48M），停留与拉回俯瞰时保持；建议 ≤8 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/depth-layer-moves
  'camera/depth-layer-moves': {
    fields: [
      { key: 'eyebrow', label: '左上眉题（品牌名后的小字）', type: 'text', placeholder: '如：2.5D camera moves', defaultValue: '2.5D camera moves', maxLength: 20, description: '固定在左上角的那行 22px 大写眉题，排在品牌名与短横线之后，4f 起字距由 0.5em 收拢到 0.18em 同时淡入，单行不换行；建议 ≤20 字符（约 ≤10 汉字），超出可能出画（仅横屏）' },
      { key: 'title', label: '主标题（120px 逐词升起）', type: 'text', placeholder: '如：Your page, in depth.', defaultValue: 'Your page, in depth.', maxLength: 24, description: '画框左侧 120px 大标题，8f 起逐词从线下升起（每个词之间错峰 20f）；这一层不随镜头移动，是视差里唯一的静止参照，建议 ≤24 字符（约 ≤12 汉字），超出可能出画（仅横屏）' },
      { key: 'subline', label: '主标题下副句（34px）', type: 'text', placeholder: '如：Screenshots, split into layers and flown in 2.5D.', defaultValue: 'Screenshots, split into layers and flown in 2.5D.', maxLength: 56, description: '画框右侧 34px 右对齐副句，26f 起上浮淡入，容器宽 520px 可自动折行；建议 ≤40 字符（约 ≤20 汉字），超出可能压到主标题或出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/graze-face-tour
  'camera/graze-face-tour': {
    fields: [
      { key: 'title', label: '右区页面主标题（128px 大字）', type: 'text', placeholder: '如：Home', defaultValue: 'Home', maxLength: 20, description: '第二段镜头贴着顶部 tab 条推进后落点的 128px 特大标题，在面包屑 “Home” 下面一块白色搜索框上方；单行不换行，建议 ≤12 字符（约 ≤6 汉字），超出可能挤出画框（仅横屏）' },
      { key: 'cardTitle', label: 'Recent 卡片标题（50px 粗体）', type: 'text', placeholder: '如：Launch film', defaultValue: 'Launch film', maxLength: 24, description: '第一段侧栏树右侧第一张白色 Recent 卡的标题，前有文档图标、下方跟着固定的 “Storyboard v3 · Edited 2h ago”；卡宽 880px 单行不换行，建议 ≤20 字符（约 ≤10 汉字），超出可能撑出卡片（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/overhead-camera-moves~OverheadTabletopDrop
  'camera/overhead-camera-moves~OverheadTabletopDrop': {
    fields: [
      { key: 'title', label: '首页海报主标题首行（148px 大字）', type: 'text', placeholder: '如：Frame motion.', defaultValue: 'Frame motion.', maxLength: 16, description: '落版满屏那张首页的 148px 粗体首行，单行不换行；右侧是分镜板产品图（x=1080 起），建议 ≤16 字符，超出会压到产品图或换行挤掉下一行（仅横屏）' },
      { key: 'titleAccent', label: '主标题第二行（衬线斜体）', type: 'text', placeholder: '如：Craft the shot.', defaultValue: 'Craft the shot.', maxLength: 18, description: '紧跟首行的第二行衬线斜体强调句，字号与首行同为 148px、单行不换行；建议 ≤18 字符，超出可能出画或盖住右侧分镜板（仅横屏）' },
      { key: 'subline', label: '主标题下的说明句', type: 'text', placeholder: '如：Cinematic product videos, crafted by your agent. From screenshot to showreel.', defaultValue: 'Cinematic product videos, crafted by your agent. From screenshot to showreel.', maxLength: 84, description: '34px 浅色说明句，栏宽固定 860px、自动换行（原稿两行）；建议 ≤77 字符（汉字约 ≤38 字），再多一行会把下方两个按钮顶下去（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/overhead-camera-moves~TiltReveal
  'camera/overhead-camera-moves~TiltReveal': {
    fields: [
      { key: 'eyebrow', label: '看板眉题', type: 'text', placeholder: '如：Render studio · Q3 Overview', defaultValue: 'Render studio · Q3 Overview', maxLength: 40, description: '120px 主标题上方的 26px 电光蓝全大写眉题（自动转大写并加 0.2em 字距），建议 ≤40 字符，超出可能出画（仅横屏）' },
      { key: 'title', label: '看板主标题', type: 'text', placeholder: '如：Renders are up', defaultValue: 'Renders are up', maxLength: 20, description: '页面 120px 粗体主标题正文，末尾另有强调数值（见“主标题强调数值”），建议 ≤20 字符，超出可能出画（仅横屏）' },
      { key: 'value', label: '主标题强调数值', type: 'text', placeholder: '如：38%', defaultValue: '38%', maxLength: 8, description: '主标题末尾的电光蓝强调数值（带发光），与主标题同行渲染，建议 ≤8 字符，超出会把整行推出画面（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/space-camera-moves~ExplodedView
  'camera/space-camera-moves~ExplodedView': {
    fields: [
      { key: 'title', label: '收尾主标题（96px 逐词升起）', type: 'text', placeholder: '如：Built in layers.', defaultValue: 'Built in layers.', maxLength: 20, description: '落版左下角的 96px 粗体主标题，144f 起逐词从线下升起（每词错峰 18f），单行不换行；左栏自 x=120 起，右侧是爆炸分解的主板（合体后机位右移让位），建议 ≤20 字符（约 ≤10 汉字），超出可能压到主板或出画（仅横屏）' },
      { key: 'subline', label: '主标题下副句（36px）', type: 'text', placeholder: '如：Every shot, tuned in one place.', defaultValue: 'Every shot, tuned in one place.', maxLength: 34, description: '96px 主标题下方 22px 处的 36px 常规字重副句，156f 起上浮淡入，单行不换行；与主标题同一条左对齐基线，建议 ≤34 字符（约 ≤17 汉字），超出可能延伸到主板之上或出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/steep-tilt-glide
  'camera/steep-tilt-glide': {
    fields: [
      { key: 'title', label: '右侧白页大标题（150px）', type: 'text', placeholder: '如：Launch film shots', defaultValue: 'Launch film shots', maxLength: 24, description: '尾程滑入的满幅白页左上 150px 粗体标题，单行不换行；右侧内容区宽约 2420px，建议 ≤24 字符，超出可能压到下方 List/Board 标签行或出画（仅横屏）' },
      { key: 'appName', label: '顶栏左侧产品名（66px）', type: 'text', placeholder: '如：Shot recipes', defaultValue: 'Shot recipes', maxLength: 16, description: '顶栏最左侧、四宫格图标之后的 66px 产品名，与右侧品牌字标同处一行；建议 ≤16 字符，再长会把品牌标志向右挤（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/tension-camera-moves~BulletTimeFreezeOrbit
  'camera/tension-camera-moves~BulletTimeFreezeOrbit': {
    fields: [
      { key: 'eyebrow', label: '面板眉题', type: 'text', placeholder: '如：Render farm · promo', defaultValue: 'Render farm · promo', maxLength: 40, description: '玻璃数据面板左上角、主标题上方的 26px 电光蓝全大写眉题（自动转大写并加 0.2em 字距），建议 ≤40 字符，超出可能出画（仅横屏）' },
      { key: 'title', label: '面板主标题', type: 'text', placeholder: '如：Frames rendered', defaultValue: 'Frames rendered', maxLength: 20, description: '面板左上角 52px 粗体主标题（与眉题同一组，右侧是滚轮计数器），建议 ≤20 字符，超出可能压到右侧计数器或出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/tension-camera-moves~PullBackIsolation
  'camera/tension-camera-moves~PullBackIsolation': {
    fields: [
      { key: 'value', label: '主卡大数字', type: 'text', placeholder: '如：99.9', defaultValue: '99.9', maxLength: 20, description: '主卡中央 128px 特大数字（默认 99.9，后接小号 % 与 90 天绿条带，开场即特写怼在此处）；建议 ≤20 字符，超出可能把 % 挤出行外或出画（仅横屏）' },
      { key: 'label', label: '主卡状态标签', type: 'text', placeholder: '如：Render success', defaultValue: 'Render success', maxLength: 20, description: '主卡左上角 17px 粗体标签（与绿色状态点同行，右侧是 90 days 徽标）；建议 ≤20 字符，超出可能压到右侧徽标或折行（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：camera/terminal-3d
  'camera/terminal-3d': {
    fields: [
      { key: 'readyLabel', label: '成片就绪徽标', type: 'text', placeholder: '如：READY', defaultValue: 'READY', maxLength: 12, description: '第三个终端里弹出成片名前的荧光胶囊标签，30px 全大写宽字距（全片唯一泛光处）；建议 ≤12 字符，超出可能撑出窗口（仅横屏）' },
      { key: 'filmName', label: '成片文件名', type: 'text', placeholder: '如：launch-film.mp4', defaultValue: 'launch-film.mp4', maxLength: 28, description: '收尾海报帧最显眼的 52px 荧光文件名，跟在 READY 胶囊右侧带泛光弹出；建议 ≤28 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/bottom-push-stack-wipe
  'transition/bottom-push-stack-wipe': {
    fields: [
      { key: 'title', label: '开场主标题（第 0 章 · 168px 巨标题）', type: 'text', placeholder: '如：Meet Frame Chisel.', defaultValue: 'Meet\n.', maxLength: 20, description: '近黑开场章的 168px 两行大字，用 \\n 换行；默认值取原字面量 Meet\\n${BRAND.name}.（品牌名当前为空）。建议 ≤20 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/card-flip-reveal
  'transition/card-flip-reveal': {
    fields: [
      { key: 'title', label: '左上主标题', type: 'text', placeholder: '如：Three features. Three outcomes.', defaultValue: 'Three features. Three outcomes.', maxLength: 32, description: '左上 84px 粗标题，位于金色眉题下方、三张翻面卡之上，逐词升起；整行不换行，建议 ≤30 字符，超出会从画面右侧出画（仅横屏）' },
      { key: 'eyebrow', label: '主标题上方的金色眉题', type: 'text', placeholder: '如：Launch results', defaultValue: 'Launch results', maxLength: 24, description: '26px 金色全大写、字距 0.18em，渲染在品牌名之后（品牌名 · 眉题），位于主标题上方同一列；建议 ≤22 字符，超出会从画面右侧出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/card-flock-tumble
  'transition/card-flock-tumble': {
    fields: [
      { key: 'title', label: '巨字主标题', type: 'text', placeholder: '如：CINEMATIC', defaultValue: 'CINEMATIC', maxLength: 12, description: '画面中央 282px 实心巨字主标题（斜体 + 渐变填充），建议 ≤12 字符，超出可能出画（仅横屏）' },
      { key: 'subline', label: '巨字下方品牌短句', type: 'text', placeholder: '如：Frame motion. Craft the shot.', defaultValue: 'Frame motion. Craft the shot.', maxLength: 40, description: '巨字下方 44px 品牌短句（逐词升起），建议 ≤40 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/circle-match-iris
  'transition/circle-match-iris': {
    fields: [
      { key: 'title', label: '右侧主标题', type: 'text', placeholder: '如：Almost there.', defaultValue: 'Almost there.', maxLength: 16, description: '景 B 圆环右侧 120px 粗标题，逐词升起（按空格分词），位于横向 1010–1830 的 820px 栏内；建议 ≤16 字，超出可能出画（仅横屏）' },
      { key: 'subline', label: '主标题下副句', type: 'text', placeholder: '如：7 shots left — one more render.', defaultValue: '7 shots left — one more render.', maxLength: 34, description: '主标题下方的 40px 说明句，同栏单行左对齐，86 帧后随淡入上浮出现；建议 ≤34 字，超出可能出画（仅横屏）' },
      { key: 'eyebrow', label: '上方眉题小字', type: 'text', placeholder: '如：Your week · Mara K.', defaultValue: 'Your week · Mara K.', maxLength: 26, description: '主标题上方的 22px 荧光色眉题（全大写、字距 0.22em），72 帧淡入；建议 ≤26 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/gradient-transition
  'transition/gradient-transition': {
    fields: [
      { key: 'title', label: 'linear 段大标题', type: 'text', placeholder: '如：Bend light.', defaultValue: 'Bend light.', maxLength: 24, description: '180px 大字（display），左侧 160px 处，linear 段 6–26f 逐词由虚到实升起、52f 起上飘退场；建议 ≤16 字符，超出可能从画面右侧出画（仅横屏）' },
      { key: 'focusLine', label: 'radial 段大标题', type: 'text', placeholder: '如：Focus it.', defaultValue: 'Focus it.', maxLength: 24, description: '与 linear 段大标题同位置同字号，66–86f 逐词升起、114f 起退场；建议 ≤16 字符，超出可能从画面右侧出画（仅横屏）' },
      { key: 'eyebrow', label: '品牌字标上方的眉题', type: 'text', placeholder: '如：Introducing', defaultValue: 'Introducing', maxLength: 20, description: '22px 全大写、字距 0.3em，位于 video-shotcraft 字标上方，124f 起淡入；输入内置大写显示，建议 ≤14 字符，超出会挤到字标左侧出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/line-carry-transition
  'transition/line-carry-transition': {
    fields: [
      { key: 'title', label: '展签大标题（右侧 B 场景 120px 粗体）', type: 'text', placeholder: '如：Launch film. / 发布短片', defaultValue: 'Launch film.', maxLength: 16, description: '线围出画框后左侧展签上的 120px、820 字重标题，按空格拆成逐行升起的两行（原稿 Launch / film.）；单行宽 720px 约容 6–7 个字符，不分空格则整句压成一行，建议 ≤16 字符，超出可能出画（仅横屏）' },
      { key: 'label', label: '导出卡文件名（A 场景卡内 38px）', type: 'text', placeholder: '如：launch-film.mp4 / 发布片.mp4', defaultValue: 'launch-film.mp4', maxLength: 22, description: '横向进度卡左上、海报缩略图右侧的 38px 文件名，紧贴下方「1920×1080 · 30 fps · h264」规格行；可用宽度约 500px，建议 ≤22 字符，再长会顶到卡片右缘（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/mosaic-reframe
  'transition/mosaic-reframe': {
    fields: [
      { key: 'title', label: '末帧海报大标题首行', type: 'text', placeholder: '如：Every shot,', defaultValue: 'Every shot,', maxLength: 20, description: 'C 态左下留白处的 124px 衬线大标题首行，逐词升起；建议 ≤20 字，超出可能出画（仅横屏）' },
      { key: 'subline', label: '海报大标题次行', type: 'text', placeholder: '如：in sequence.', defaultValue: 'in sequence.', maxLength: 20, description: '紧随首行的第二行大标题，赤陶色斜体逐词升起；建议 ≤20 字，超出可能出画（仅横屏）' },
      { key: 'label', label: '主图图注标题', type: 'text', placeholder: '如：Golden Hour', defaultValue: 'Golden Hour', maxLength: 20, description: 'Mosaic 态首图上的 84px 衬线图注标题，逐词升起、切换 Cascade 时退场；建议 ≤20 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/page-turn-transitions
  'transition/page-turn-transitions': {
    fields: [
      { key: 'title', label: '旧页字标', type: 'text', placeholder: '如：Shotcraft 3', defaultValue: 'Shotcraft 3', maxLength: 14, description: '两扇门裂开前占满画面的 220px 粗字标（冷灰、字距 -0.055em），0–40 帧可见；建议 ≤14 字（中文更少），超出可能出画（仅横屏）' },
      { key: 'brand', label: '新页字标主体词', type: 'text', placeholder: '如：Shotcraft', defaultValue: 'Shotcraft', maxLength: 12, description: '门开后 220px 发布字标的前半段文字；末尾的版本号「4」保留余烬橙渐变强调，两段之间自动留一个空格；建议 ≤12 字，超出可能出画（仅横屏）' },
      { key: 'subline', label: '新页副题', type: 'text', placeholder: '如：One prompt to a finished promo.', defaultValue: 'One prompt to a finished promo.', maxLength: 34, description: '字标下方 48px 副句，第 64 帧起逐词升起（按空格分词）；建议 ≤34 字，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/print-texture-transitions
  'transition/print-texture-transitions': {
    fields: [
      { key: 'title', label: '扉页大标题首行', type: 'text', placeholder: '如：Frame motion.', defaultValue: 'Frame motion.', maxLength: 24, description: '旧景扉页的 112px 衬线大字首行，居中印刷在纸面上，下方接斜体次行；建议 ≤24 字符，超出会从画面两侧出画（仅横屏）' },
      { key: 'titleB', label: '扉页大标题次行（斜体）', type: 'text', placeholder: '如：Craft the shot.', defaultValue: 'Craft the shot.', maxLength: 24, description: '大标题第二行，同为 112px 衬线但为斜体强调；建议 ≤24 字符，超出会从画面两侧出画（仅横屏）' },
      { key: 'subline', label: '扉页副题', type: 'text', placeholder: '如：Every shot, tuned in one place.', defaultValue: 'Every shot, tuned in one place.', maxLength: 48, description: '细线分隔条下方的 34px 衬线副题，居中单行；建议 ≤48 字符，超出会从画面两侧出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/shot-transitions~PortalWipeV2
  'transition/shot-transitions~PortalWipeV2': {
    fields: [
      { key: 'title', label: '问候主标题（Workspace 主页 96px）', type: 'text', placeholder: '如：Good morning, Mara. / 早上好，Mara。', defaultValue: 'Good morning, Mara.', maxLength: 20, description: '96px 大标题，单行不换行；建议 ≤20 字，超出可能出画（仅横屏）' },
      { key: 'subline', label: '项目统计副句（右上角一行）', type: 'text', placeholder: '如：6 projects · 2 rendered today / 6 个项目 · 今日已渲染 2 个', defaultValue: '6 projects · 2 rendered today', maxLength: 30, description: '36px 右上角单行副句；建议 ≤30 字，超出会向左侧压到标题（仅横屏）' },
      { key: 'eyebrow', label: '眉题（字标右侧小字）', type: 'text', placeholder: '如：WORKSPACE / 工作台', defaultValue: 'WORKSPACE', maxLength: 14, description: '30px 全大写等宽小字，字距 0.18em；建议 ≤14 字且保持大写，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/shot-transitions~WhipBrakeReal
  'transition/shot-transitions~WhipBrakeReal': {
    fields: [
      { key: 'label', label: '落定分区名（播放头下方）', type: 'text', placeholder: '如：Efficient Models / 精选模型', defaultValue: 'Efficient Models', maxLength: 24, description: '播放头下方浮出的 32px 全大写字距 0.16em 分区名，位于长廊刻度尺之下、水平居中；默认值与原字面量一致，建议 ≤24 字，超出会向两侧出画（仅横屏）' },
      { key: 'eyebrow', label: '索引眉题（左上角圆点后）', type: 'text', placeholder: '如：Project index / 项目索引', defaultValue: 'Project index', maxLength: 24, description: '左上角 30px 全大写小字眉题，前接 12px 朱红圆点，与右上 Nº 计数器同一水平带；建议 ≤24 字，过长会向右侧压到计数器（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/tear-streak-transitions
  'transition/tear-streak-transitions': {
    fields: [
      { key: 'title', label: '两态共用的大标题品牌词（A 态第二行 / B 态首行）', type: 'text', placeholder: '如：Shotcraft / 镜刻', defaultValue: 'Shotcraft', maxLength: 14, description: '132px 特粗两行大标题里的品牌主词，A 态在第二行、B 态在第一行；B 态同行的「is live.」保持原稿（live. 为青绿强调，不可编辑）。画面左起约 x=114，右侧需让给进度/p95 大数字；建议 ≤10 字符，超出可能出画（仅横屏）' },
      { key: 'kicker', label: 'A 态大标题首行动作短语（部署中）', type: 'text', placeholder: '如：Rolling out / 正在上线', defaultValue: 'Rolling out', maxLength: 14, description: 'A 态（DEPLOYING）132px 大标题首行，与第二行品牌词同字号同基线；硬切到 B 态后整句替换为品牌词 + is live.。左起约 x=114，建议 ≤12 字符，超出会顶到右侧 99% 大数字（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/transition-hidden-cut~InvisibleCut
  'transition/transition-hidden-cut~InvisibleCut': {
    fields: [
      { key: 'eyebrow', label: 'A 页眉题', type: 'text', placeholder: '如：Launch film · Final cut', defaultValue: 'Launch film · Final cut', maxLength: 24, description: 'A 页右侧衬线大标题上方的 28px 眉题，全大写 + 0.14em 字距由样式固定；建议 ≤24 字符，超出会从画面右侧出画（仅横屏）' },
      { key: 'title', label: 'B 页大标题首行', type: 'text', placeholder: '如：That’s a', defaultValue: 'That’s a', maxLength: 20, description: 'B 页 168px 衬线大标题的首行，换行前的文字；容器宽 900px，建议 ≤14 字符，超出会从画面右侧出画（仅横屏）' },
      { key: 'titleB', label: 'B 页大标题第二行', type: 'text', placeholder: '如：wrap.', defaultValue: 'wrap.', maxLength: 20, description: '首行换行之后、赤陶斜体的第二行大标题；建议 ≤14 字符，超出会从画面右侧出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/transition-hidden-cut~LightLeakBurn
  'transition/transition-hidden-cut~LightLeakBurn': {
    fields: [
      { key: 'title', label: '夜景句主标题（140px · 光峰前）', type: 'text', placeholder: '如：Frame motion.', defaultValue: 'Frame motion.', maxLength: 20, description: '漏光光峰前的夜景画面主标题，140px 特粗字，逐词从线下升起，起点固定在 x=156、top=596；建议 ≤13 字符（汉字约 ≤8 字），过长会向右压到取景框（仅横屏）' },
      { key: 'titleB', label: '黄昏句主标题（140px · 光峰后）', type: 'text', placeholder: '如：Craft the shot.', defaultValue: 'Craft the shot.', maxLength: 20, description: '光峰硬切后的黄昏画面主标题，与上半句同一位置、同字号，在漏光余温里逐词升起；建议 ≤13 字符（汉字约 ≤8 字），过长会出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/transition-hidden-cut~VersusSlam
  'transition/transition-hidden-cut~VersusSlam': {
    fields: [
      { key: 'title', label: '建立段设问主标题', type: 'text', placeholder: '如：What does a promo take?', defaultValue: 'What does a promo take?', maxLength: 26, description: '建立段（0–18f）居中 124px 墨黑设问，按空格逐词升起（start=1、每词 +14f），18f 对冲时被两半屏吞掉；单行居中，建议 ≤26 字符 / ≤5 词，超出可能出画（仅横屏）' },
      { key: 'eyebrow', label: '设问上方朱红眉题', type: 'text', placeholder: '如：Product launch film', defaultValue: 'Product launch film', maxLength: 24, description: '设问上方 30px 朱红全大写眉题（0.2em 字距、居中单行），随建立段整体退场；建议 ≤24 字符，超出可能出画（仅横屏）' },
      { key: 'caption', label: '撞击后底部结论条', type: 'text', placeholder: '如：Direct the film. Let the agent shoot it.', defaultValue: 'Direct the film. Let the agent shoot it.', maxLength: 52, description: '撞击后（54–70f 起）从下升起的纸白胶囊结论条文案，38px 粗体单行 nowrap，宽度随文案自适应，长度约超过 52 字符会顶到画幅两侧（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/transition-travel
  'transition/transition-travel': {
    fields: [
      { key: 'title', label: '主标题第一行', type: 'text', placeholder: '如：Every shot.', defaultValue: 'Every shot.', maxLength: 18, description: '140px 超粗主标题的上排（下排由 subline 控制），左对齐块宽 860px；建议 ≤18 字符，超出会折行可能出画（仅横屏）' },
      { key: 'subline', label: '主标题第二行', type: 'text', placeholder: '如：One prompt.', defaultValue: 'One prompt.', maxLength: 18, description: '紧接主标题第一行换行显示的同字号第二行，左对齐块宽 860px；建议 ≤18 字符，超出会折行可能出画（仅横屏）' },
      { key: 'kicker', label: '字卡顶部章节眉题', type: 'text', placeholder: '如：Chapter 02', defaultValue: 'Chapter 02', maxLength: 16, description: '暖黑字卡顶部居中的 30px 强调色眉题，入场时字距自动收拢、按大写渲染；建议 ≤16 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/white-flash-logo-simplify-cut
  'transition/white-flash-logo-simplify-cut': {
    fields: [
      { key: 'subline', label: '定妆段品牌短句', type: 'text', placeholder: '如：Frame motion. Craft the shot.', defaultValue: 'Frame motion. Craft the shot.', maxLength: 40, description: '白闪定妆后字标下方 46px 品牌短句（逐词升起），建议 ≤40 字符，超出可能出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },

  // 文案批次：transition/wipe-transitions
  'transition/wipe-transitions': {
    fields: [
      { key: 'title', label: 'A 页巨字（400px · 百叶窗前）', type: 'text', placeholder: '如：Frame', defaultValue: 'Frame', maxLength: 20, description: '翻页前 A 页左下 400px 特粗巨字，朱红句点由版面自动补上（无需输入句点）；从 x=84 起排，建议 ≤6 个字母（汉字约 ≤4 字），过长会向右出画（仅横屏）' },
      { key: 'titleB', label: 'B 页巨字（400px · 百叶窗后）', type: 'text', placeholder: '如：Craft', defaultValue: 'Craft', maxLength: 20, description: '百叶窗翻满后 B 页（朱红整版）左下 400px 特粗巨字，句点同样由版面补上；与 A 页同一位置、同字号，建议 ≤6 个字母（汉字约 ≤4 字），过长会向右出画（仅横屏）' },
    ],
    features: { hasText: true, hasImageSlot: false, hasData: false },
  },
}

/**
 * 按分类推导的字段**只是中文标签与控件文案的来源**，不代表镜头真的消费这些键。
 * 是否生效由注册表 `editableKeys`（生成脚本从组件源码机械提取的 useShotProp 调用）裁决：
 * 标签 ∩ 真实消费键 才会返回给检查器——假控件在这里被物理拦截。
 */
function deriveCategorySchema(shotId: string): Partial<ShotSchema> {
  const [category] = shotId.split('/')

  switch (category) {
    case 'typography':
    case 'opening':
      return {
        fields: [
          { key: 'text', label: '主标题文案', type: 'text', placeholder: '输入主体文字', defaultValue: 'Key Title' },
          { key: 'highlightWord', label: '高亮词', type: 'text', placeholder: '画面着重突出的词' },
          { key: 'subline', label: '副标题/说明', type: 'textarea', placeholder: '输入补充阐释' },
        ],
        features: { hasText: true, hasImageSlot: false, hasData: false },
      }

    case 'data':
      return {
        fields: [
          { key: 'metric', label: '指标名称', type: 'text', placeholder: '如：核心增长指标', defaultValue: 'Key Metric' },
          { key: 'value', label: '核心数值', type: 'text', placeholder: '如：99.9%', defaultValue: '100%' },
          { key: 'subline', label: '对比或注释', type: 'text', placeholder: '补充数据背景' },
        ],
        features: { hasText: true, hasImageSlot: false, hasData: true },
      }

    case 'ui-entrance':
    case 'interaction':
      return {
        fields: [
          { key: 'title', label: '卡片/模块标题', type: 'text', placeholder: '核心模块名', defaultValue: 'Feature Module' },
          { key: 'subline', label: '描述说明', type: 'textarea', placeholder: '详细说明文字' },
          { key: 'cardImage', label: '插图/截图槽位', type: 'image', isSlot: true, placeholder: '替换模块截图' },
        ],
        features: { hasText: true, hasImageSlot: true, hasData: false },
      }

    case 'outro':
      return {
        fields: [
          { key: 'brand', label: '品牌/主体名', type: 'text', placeholder: '输入品牌名', defaultValue: 'Brand Name' },
          { key: 'slogan', label: '行动呼吁 (CTA)', type: 'text', placeholder: '如：立即关注 / 免费体验' },
        ],
        features: { hasText: true, hasImageSlot: false, hasData: false },
      }

    default:
      // 通用回退
      return {
        fields: [
          { key: 'text', label: '镜头文字', type: 'text', placeholder: '输入镜头叠显文案' },
          { key: 'subline', label: '副标题', type: 'text', placeholder: '输入副标' },
        ],
        features: { hasText: true, hasImageSlot: false, hasData: false },
      }
  }
}

/** 标准配色字段模板：与 ShotInspectorSection「视觉配色」页签的键名/控件约定一致 */
function buildStyleField(key: string): ShotParamField {
  switch (key) {
    case 'colorTheme':
      return { key, label: '预设主题色盘', type: 'text', category: 'style', placeholder: 'dark-blue / neon-purple / cyber-teal / obsidian-gold / sunset-orange / porcelain-light', defaultValue: 'dark-blue' }
    case 'customBg':
      return { key, label: '背景底色', type: 'color', category: 'style', placeholder: '#0a0f1e', defaultValue: '#0a0f1e' }
    case 'customPrimary':
      return { key, label: '主发光线条色', type: 'color', category: 'style', placeholder: '#4d7cff', defaultValue: '#4d7cff' }
    case 'customSecondary':
      return { key, label: '次级高光色', type: 'color', category: 'style', placeholder: '#19d3b4', defaultValue: '#19d3b4' }
    case 'customPanel':
      return { key, label: '卡片底板色', type: 'color', category: 'style', placeholder: '#0f1730', defaultValue: '#0f1730' }
    default:
      return { key, label: '文字墨水色', type: 'color', category: 'style', placeholder: '#eef3ff', defaultValue: '#eef3ff' }
  }
}

/** 标准配色键（与 LOOK_COLOR_KEYS 排序一致），供有配色的镜头按序追加到字段组末尾 */
const STYLE_FIELD_ORDER = [
  'colorTheme',
  'customBg',
  'customInk',
  'customPanel',
  'customPrimary',
  'customSecondary',
] as const

/**
 * 获取指定 shotId 的参数契约。
 *
 * 字段 = （精确登记表或分类标签推导）∩ 注册表 editableKeys，
 * 之后**追加**该镜头真实消费的标准配色键（editableKeys ∩ STYLE_FIELD_ORDER，
 * 由 useLook 扫描口径写入，2026-10-23 阶段 1 全量接入）——不依赖 0.2 的文本交集，
 * 配色走 editableKeys 独立通道（§6 1.6）。
 * editableKeys 由 scripts/generate-shot-registry.mjs 从组件源码提取真实的 useShotProp('key') 调用，
 * 因此返回的每个字段都保证写入 overrides 后会被渲染消费；镜头没有任何参数入口时返回空 fields。
 */
export function getShotSchema(shotId: string): ShotSchema {
  const editableKeys = new Set(findShot(shotId)?.editableKeys ?? [])
  const source = SPECIFIC_SHOT_SCHEMAS[shotId] ?? deriveCategorySchema(shotId)
  const contentFields = (source.fields ?? []).filter((field) => editableKeys.has(field.key))
  const styleKeys = STYLE_FIELD_ORDER.filter((key) => editableKeys.has(key) && !contentFields.some((field) => field.key === key))
  const fields = [...contentFields, ...styleKeys.map(buildStyleField)]

  if (!fields.length) {
    return {
      shotId,
      displayName: source.displayName,
      fields: [],
      features: { hasText: false, hasImageSlot: false, hasData: false },
    }
  }

  return {
    shotId,
    displayName: source.displayName,
    fields,
    features: {
      hasText: contentFields.some((field) => !field.isSlot && (field.type === 'text' || field.type === 'textarea')),
      hasImageSlot: contentFields.some((field) => field.isSlot || field.type === 'image'),
      hasData: source.features?.hasData ?? false,
    },
  }
}
