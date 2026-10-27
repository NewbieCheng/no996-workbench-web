/**
 * 微信公众号文章业务板块开发调试专享数据（Dev Fixtures）
 *
 * 仅供本地开发调试（import.meta.env.DEV）快速填充复杂长字段与一键模拟完整微信排版生成结果，
 * 生产构建（npm run build）由 Vite tree-shaking 彻底剔除，不泄露到线上环境。
 */
import type { SocialStudioBrief } from '../../social-studio/creative/social-studio-brief-types'
import type { SocialStudioRewriteSession } from '../../social-studio/rewrite/social-studio-rewrite-types'
import type { WizardGeneratedResult } from '../../social-studio/wizard/types'
import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'

/** 生成带有公众号专业头条视觉的 16:9 或 4:3 比例 SVG DataURL，离线秒开且高清 */
function createWechatCoverSvg(
  width: number,
  height: number,
  bgFrom: string,
  bgTo: string,
  category: string,
  title: string,
  sub: string,
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="wechatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgFrom}" />
        <stop offset="100%" stop-color="${bgTo}" />
      </linearGradient>
      <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#000" flood-opacity="0.25" />
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#wechatGrad)" />
    
    <!-- 科技网格点阵底纹 -->
    <g opacity="0.06" stroke="#ffffff" stroke-width="1">
      <line x1="0" y1="${height * 0.25}" x2="${width}" y2="${height * 0.25}" />
      <line x1="0" y1="${height * 0.5}" x2="${width}" y2="${height * 0.5}" />
      <line x1="0" y1="${height * 0.75}" x2="${width}" y2="${height * 0.75}" />
      <line x1="${width * 0.2}" y1="0" x2="${width * 0.2}" y2="${height}" />
      <line x1="${width * 0.5}" y1="0" x2="${width * 0.5}" y2="${height}" />
      <line x1="${width * 0.8}" y1="0" x2="${width * 0.8}" y2="${height}" />
    </g>

    <!-- 顶部栏目徽章 -->
    <g transform="translate(60, 50)">
      <rect width="140" height="36" rx="8" fill="#ffffff" fill-opacity="0.15" />
      <text x="70" y="24" fill="#38bdf8" font-size="16" font-weight="700" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${category}</text>
    </g>

    <!-- 核心文字区 -->
    <g transform="translate(60, ${height * 0.45})">
      <text x="0" y="0" fill="#ffffff" font-size="36" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" letter-spacing="1">${title}</text>
      <text x="0" y="48" fill="#94a3b8" font-size="20" font-weight="500" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${sub}</text>
    </g>

    <!-- 底部品牌与排版标记 -->
    <g transform="translate(60, ${height - 50})">
      <circle cx="10" cy="0" r="4" fill="#38bdf8" />
      <text x="24" y="5" fill="#64748b" font-size="14" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">不加班智能团 · 深度洞察特刊</text>
    </g>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** 微信公众号头条封面大图（16:9 比例 900x383）与正文插图（4:3 比例 800x600） */
export const DEV_WECHAT_MOCK_IMAGES: string[] = [
  createWechatCoverSvg(
    900,
    383,
    '#0f172a',
    '#1e293b',
    '深度研报',
    'AI时代的技能重塑与生存法则',
    '当基础技能被算法平替，普通人如何构筑不可替代的护城河？',
  ),
  createWechatCoverSvg(
    800,
    600,
    '#0c4a6e',
    '#075985',
    '架构模型',
    '职场竞争力金字塔跃迁',
    '从执行层（代码/撰稿）向决策层与系统编排层快速迁移',
  ),
]

/** 微信公众号长文 Brief 示例（含上千字详尽调研参考资料） */
export const DEV_WECHAT_ARTICLE_BRIEF: Partial<SocialStudioBrief> = {
  topic: 'DeepSeek 颠覆 AI 之后，普通职场人如何避免被下一轮浪潮淘汰？',
  expressionStyle: 'dry_goods',
  length: 'long',
  audience: '互联网从业者、知识工作者、企业中层、对 AI 普及感到本领恐慌的打工人',
  imageCount: 2,
  voiceTone: 'professional',
  emojiLevel: 1,
  referenceText: `【参考背景与一线调研事实】
1. 行业动态：以 DeepSeek R1 为代表的推理模型开源普及，使得高质量逻辑推理与垂直领域分析成本暴跌 90% 以上。不仅初级程序员、文案策划受冲击，财务、法务、初级投研也进入被替代倒计时。
2. 痛点调研：大量职场人陷入“工具疲劳”——学会了写提示词、用了几十个插件，但日常工作效率并未产生质的飞跃，反而每天疲于应付被 AI 放大的产出要求。
3. 专家核心论点：
- 第一阶段：技能平替（机械性、模板化产出贬值）。
- 第二阶段：范式重塑（能把复杂问题拆解为多智能体工作流的人，生产力放大 100 倍）。
- 破局关键：从“手艺人（单点技能）”转变为“项目总监与系统编排者（掌控意图、把控质量、负责结果）”。
4. 行动抓手：建立自己的私域工作流知识库；坚持在真实业务场景落地微型自动化闭环；强化跨学科审美与同理心。`,
  creativeRequirements: '观点鲜明犀利，逻辑层层递进，采用经典公众号深度商业复盘结构，包含大标题、前言金句引用、三级分析、落地应对策略及读者思考互动。',
  summary: '深度复盘 AI 新浪潮对职场能力模型的重构与应对指南。',
  themeKey: 'default',
  articleTemplate: 'clean',
  autoTags: true,
  hardCheck: true,
  authorized: true,
}

/** 微信公众号图文小报 Brief 示例 */
export const DEV_WECHAT_IMAGE_TEXT_BRIEF: Partial<SocialStudioBrief> = {
  topic: '打工人必备！2026 最新 AI 效率工具早报（5分钟速览）',
  expressionStyle: 'seeding',
  length: 'short',
  audience: '忙碌的都市打工人、追求效率的办公族',
  imageCount: 1,
  voiceTone: 'professional',
  emojiLevel: 2,
  referenceText: '今日要闻速览：三大办公大模型升级、开源轻量工具精选、一键生成精美周报技巧。',
  creativeRequirements: '清爽便当盒简讯风格，卡片化排版，便于碎片化阅读。',
  summary: '5分钟速览最新 AI 办公提效神器与实操技巧。',
  themeKey: 'green',
  articleTemplate: 'clean',
  autoTags: true,
  hardCheck: true,
  authorized: true,
}

/** 微信公众号深度长文排版生成成稿 Mock（格式丰富，支持微信主题、引用、加粗、清单、分割线） */
export const DEV_WECHAT_ARTICLE_RESULT = {
  title: '深度复盘：当 AI 取代了初级技能，我们到底还凭什么拿高薪？',
  content: `# 深度复盘：当 AI 取代了初级技能，我们到底还凭什么拿高薪？

> “过去五十年，人类的教育体系在拼命把人训练成精密、稳定但昂贵的机器；而今天，世界上最廉价、最高速的恰恰就是机器。”

过去三个月，从硅谷的深夜代码重构，到国内各行各业的“降本增效”，一种前所未有的本领恐慌正在知识工作者群体中蔓延。

如果写周报、做 PPT、跑数据清洗甚至编写业务接口都只需要几秒钟，那么，我们每天朝九晚六出卖的脑力劳动，其核心溢价到底还剩多少？

---

## 一、大变局：技能通胀时代的残酷现实

很多人还没有意识到，“技能通胀”的速度比货币贬值残酷十倍。

在过去，熟练掌握 Python 数据分析、掌握 Photoshop 精修图片、或者能写出流畅的英文商务邮件，足以成为一个人在职场安身立命的核心壁垒。

但今天，这些**可标准化、可量化复现的初级技能，边际成本已经趋近于零**。

### 1. 经验不再是不可动摇的护城河
在传统职场晋升路径中，一个新人积累了 5 年行业规则才掌握的“潜经验”，模型可以在几毫秒内检索完毕并完成跨行业融合。

### 2. 单点技能的贬值与系统编排的暴利
单纯会“画图”或“写字”的人举步维艰，但一个既懂用户心理、又懂数据逻辑，能**指挥 5 个专项 Agent 协同跑通业务闭环**的人，却成了市场上最抢手的“一人公司（One-person Unicorn）”。

---

## 二、重构个人的核心能力金字塔

面对不可逆的算力浪潮，与其陷入盲目的工具焦虑，不如重新校准自己的稀缺性锚点：

| 能力维度 | 工业化旧范式 | AI 时代新范式 | 稀缺性等级 |
| :--- | :--- | :--- | :--- |
| **执行层** | 码代码、写文案、做报表 | 编写精准约束、评审结果可用性 | ⭐ 极速贬值 |
| **逻辑层** | 记忆繁琐规则与流程 | 拆解复杂模糊问题为工作流 | ⭐⭐⭐ 高度稀缺 |
| **判断层** | 盲目跟风、按指令交差 | 商业终局判断、风险把控、审美裁决 | ⭐⭐⭐⭐⭐ 终极护城河 |

### 核心跃迁：从“答题者”转变为“提问者与裁判员”
- **提出高阶命题的能力**：永远是好问题比好答案昂贵。机器可以提供 100 种解法，但决定“哪一个问题值得被解决”的，只能是人。
- **跨域审美与真实共情**：算法擅长取最大公约数，产出看似工整实则平庸的“温吞水”；只有人类真实的痛苦、热爱与独特审美，才能击穿算法的信息茧房。

---

## 三、下周一就能启动的三个微习惯

不要等到风暴彻底降临才开始修屋顶。从明天开始，尝试在日常工作中推进这三项转变：

1. **强迫自己退后一步，先做架构思考**：拿到需求不要立刻动手，先在白纸上画出输入、处理、校验与交付链路。
2. **沉淀自己的个人私域 SOP**：把你每次成功的经验固化为 Prompt 模板与评估清单，让工具替你沉淀资产。
3. **把时间投掷在需要人类真实见证的场域**：面对面的深度访谈、跨部门的利益平衡、线下复杂环境的落地推进——这些都是光缆另一端无法抵达的实体世界。

---

> **写在最后：**
> 浪潮退去之后，裸泳的从来不是技术，而是拒绝走出舒适区的心态。愿我们都能成为驾驭浪潮的冲浪者，而非被海啸裹挟的沙砾。

欢迎在评论区聊聊：过去这半年里，AI 真正改变了你的哪一项日常工作？`,
  summary: '深度复盘 AI 时代职场能力模型的重构，探讨从执行层到编排层的跃迁路径。',
  imageUrls: DEV_WECHAT_MOCK_IMAGES,
}

/** 微信公众号图文小报生成成稿 Mock */
export const DEV_WECHAT_IMAGE_TEXT_RESULT = {
  title: '打工人必备！2026 最新 AI 效率工具早报（5分钟速览）',
  content: `# 打工人必备！2026 最新 AI 效率工具早报 ☕

大家早安！这里是今天的【5分钟效率速递】，为你精选今日最值得体验的提效工具与实操技巧：

📌 **要闻速递**
- 办公自动化再升级：复杂长表格数据透视已支持自然语言一键出图。
- 视频切片工具上新：长视频一键提炼金句短视频，自动配字幕与转场。
- 本地轻量化模型突破：无需高端显卡，普通笔记本也能秒开端侧智能体。

💡 **今日提效小贴士**
开早会前，把昨日会议纪要丢给模型，输入提示词：“请用三句话提取未完成事项与责任人”，效率直接翻倍！

祝大家今天不加班，下班准时冲！🚀`,
  summary: '精选最新办公提效工具与实操小贴士，5分钟快速掌握。',
  imageUrls: [DEV_WECHAT_MOCK_IMAGES[1]],
}

/** 微信公众号智能改写对照 Session Mock（包含5组 10w+ 备选标题） */
export const DEV_WECHAT_REWRITE_SESSION: SocialStudioRewriteSession = {
  pass1Body: DEV_WECHAT_ARTICLE_RESULT.content,
  pass2Payload: {
    titles: [
      '深度复盘：当 AI 取代了初级技能，我们到底还凭什么拿高薪？（深度痛点型）',
      '大厂裁员背后的残酷真相：你的“核心竞争力”，在模型眼里可能一文不值（危机警示型）',
      '颠覆认知！为什么越努力的打工人，越容易成为这轮 AI 浪潮的牺牲品？（认知反常识）',
      '建议收藏：给知识工作者的生存指南，如何在三年内重构个人护城河（实操干货型）',
      '对话十位技术总监：2026 之后，什么样的复合型人才无可替代？（权威访谈型）',
    ],
    body: DEV_WECHAT_ARTICLE_RESULT.content,
  },
  selectedTitleIndex: 0,
  secondPassSkipped: false,
}

/** 微信公众号对标向导采集母本 Mock（10w+ 深度爆款） */
export const DEV_WECHAT_WIZARD_BENCHMARK: WorkbenchBridgeCollectedItem = {
  url: 'https://mp.weixin.qq.com/s/dev-mock-wechat-sample',
  platformId: 'weixin',
  workId: 'wechat-benchmark-sample-01',
  title: '时代变了：为什么那些只懂执行的“老实人”，正在被悄悄淘汰？',
  content: `过去我们赞美踏实听话的执行者，但在智能时代，单点任务的机械执行是最廉价的商品。
真正的高手早已完成了角色跃迁，他们站在系统的顶层，把控目标、编排工具、审视结果。`,
  author: '商业洞察实验室',
  publishTime: Date.now(),
  collectedAt: Date.now(),
  coverUrl: DEV_WECHAT_MOCK_IMAGES[0],
}

/** 微信公众号对标向导最终完成产物 Mock */
export const DEV_WECHAT_WIZARD_RESULT: WizardGeneratedResult = {
  title: '深度复盘：当 AI 取代了初级技能，我们到底还凭什么拿高薪？',
  content: DEV_WECHAT_ARTICLE_RESULT.content,
  summary: '拆解公众号 10w+ 深度行业分析母本，重构职场能力模型与行动清单。',
  imageUrls: DEV_WECHAT_MOCK_IMAGES,
}
