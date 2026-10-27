/**
 * 小红书业务板块开发调试专享数据（Dev Fixtures）
 *
 * 仅供本地开发调试（import.meta.env.DEV）快速填充复杂长字段与一键模拟完整生成结果，
 * 生产构建（npm run build）由 Vite tree-shaking 彻底剔除，不泄露到线上环境。
 */
import type { SocialStudioBrief } from '../../social-studio/creative/social-studio-brief-types'
import type { SocialStudioRewriteSession } from '../../social-studio/rewrite/social-studio-rewrite-types'
import type { WizardGeneratedResult } from '../../social-studio/wizard/types'
import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'

/** 生成带有文字与柔和配色的 3:4 比例 SVG DataURL，用于模拟真实小红书卡片配图，离线秒开 */
function createXhsCardSvg(
  bgFrom: string,
  bgTo: string,
  badge: string,
  mainTitle: string,
  subTitle: string,
  tag: string,
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgFrom}" />
        <stop offset="100%" stop-color="${bgTo}" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.12" />
      </filter>
    </defs>
    <rect width="600" height="800" fill="url(#grad)" rx="0" />
    <circle cx="520" cy="80" r="140" fill="#ffffff" opacity="0.08" />
    <circle cx="80" cy="720" r="180" fill="#ffffff" opacity="0.06" />

    <!-- 顶部小红书风格徽章 -->
    <g transform="translate(48, 56)">
      <rect width="130" height="36" rx="18" fill="#ffffff" opacity="0.9" />
      <text x="65" y="24" fill="#ff2442" font-size="16" font-weight="700" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${badge}</text>
    </g>

    <!-- 中间视觉内容卡片 -->
    <g transform="translate(48, 120)" filter="url(#shadow)">
      <rect width="504" height="520" rx="24" fill="#ffffff" fill-opacity="0.95" />
      <rect x="24" y="24" width="456" height="300" rx="16" fill="${bgFrom}" fill-opacity="0.25" />
      
      <!-- 装饰图形插画 -->
      <circle cx="252" cy="174" r="70" fill="${bgTo}" fill-opacity="0.4" />
      <path d="M210 180 L240 140 L270 170 L294 138 L320 180 Z" fill="${bgFrom}" fill-opacity="0.8" />
      
      <text x="252" y="380" fill="#1e293b" font-size="34" font-weight="800" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${mainTitle}</text>
      <text x="252" y="425" fill="#64748b" font-size="20" font-weight="500" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${subTitle}</text>
      
      <line x1="60" y1="465" x2="444" y2="465" stroke="#f1f5f9" stroke-width="2" />
      
      <g transform="translate(60, 480)">
        <rect width="100" height="28" rx="14" fill="#f8fafc" />
        <text x="50" y="19" fill="#0284c7" font-size="13" font-weight="600" text-anchor="middle">干货分享</text>
      </g>
      <g transform="translate(170, 480)">
        <rect width="100" height="28" rx="14" fill="#f8fafc" />
        <text x="50" y="19" fill="#059669" font-size="13" font-weight="600" text-anchor="middle">超值避坑</text>
      </g>
      <g transform="translate(280, 480)">
        <rect width="100" height="28" rx="14" fill="#f8fafc" />
        <text x="50" y="19" fill="#d97706" font-size="13" font-weight="600" text-anchor="middle">亲测推荐</text>
      </g>
    </g>

    <!-- 底部小红书专属标签 -->
    <text x="52" y="700" fill="#ffffff" font-size="20" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${tag}</text>
    <text x="52" y="730" fill="#ffffff" opacity="0.85" font-size="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">点击卡片可查看高清大图与原木软装清单</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** 4 张高质量无需网络的小红书示例配图（覆盖封面大图、改造前后对比、清单罗列、氛围细节） */
export const DEV_XHS_MOCK_IMAGES: string[] = [
  createXhsCardSvg(
    '#ff6b6b',
    '#feca57',
    '爆款精选 01',
    '100元出租屋逆袭！',
    '花小钱打造治愈系原木风小角落',
    '#我的租房日常 · 独居生活美学',
  ),
  createXhsCardSvg(
    '#48dbfb',
    '#1dd1a1',
    '对比实录 02',
    '改造前后反差惊呆了',
    '告别老干部出租屋，一秒变温馨',
    '#出租屋改造 · 软装轻改造攻略',
  ),
  createXhsCardSvg(
    '#a29bfe',
    '#6c5ce7',
    '清单整理 03',
    '超平价好物采购清单',
    '均价不过30元，学生党闭眼入',
    '#高性价比好物 · 极简生活指南',
  ),
  createXhsCardSvg(
    '#fd79a8',
    '#e84393',
    '沉浸细节 04',
    '夜晚开灯后的治愈时刻',
    '温暖的微光就是回家的意义',
    '#独居女孩的房间 · 沉浸式回家',
  ),
]

/** 小红书图文模式 Brief 示例（家居改造爆款） */
export const DEV_XHS_IMAGE_TEXT_BRIEF: Partial<SocialStudioBrief> = {
  topic: '租房改造！100元打造治愈系原木风小角落',
  expressionStyle: 'seeding',
  length: 'standard',
  audience: '一线城市合租青年、独居女孩、预算有限但热爱生活的年轻人',
  imageCount: 4,
  voiceTone: 'bestie',
  emojiLevel: 2,
  referenceText: '租房生活预算有限，房东旧家具难看，想通过落地灯、桌布、小置物架和绿植低成本提升幸福感。',
  creativeRequirements: '突出花小钱办大事，前后反差明显，手把手清单分享，语气亲切像闺蜜安利，必须带小红书特色话题标签。',
  summary: '100元出租屋软装逆袭，低成本打造高颜值治愈小角落。',
  themeKey: 'green',
  articleTemplate: 'clean',
  autoTags: true,
  hardCheck: true,
  authorized: true,
}

/** 小红书长文/专栏干货模式 Brief 示例 */
export const DEV_XHS_ARTICLE_BRIEF: Partial<SocialStudioBrief> = {
  topic: '副业做自媒体半年，我总结出的这5个血泪教训（新手必看）',
  expressionStyle: 'dry_goods',
  length: 'long',
  audience: '想开启副业的职场人、自媒体新手小白、个人内容创作者',
  imageCount: 1,
  voiceTone: 'professional',
  emojiLevel: 1,
  referenceText: '自媒体新人常踩误区：自嗨式选题、忽视排版节奏、不敢变现、盲目追热点导致断更。',
  creativeRequirements: '真实踩坑经历，条理清晰，结构分明，给出可直接落地的避坑实操动作。',
  summary: '自媒体新手半年避坑指南与底层核心认知。',
  themeKey: 'green',
  articleTemplate: 'clean',
  autoTags: true,
  hardCheck: true,
  authorized: true,
}

/** 小红书图文模式生成成稿 Mock */
export const DEV_XHS_IMAGE_TEXT_RESULT = {
  title: '租房改造！花100块把出租屋变成梦中情房✨闺蜜都以为我搬家了！',
  content: `终于把房东留下的老干部风出租屋改造成我想要的日落原木风小角落了！🌿

下班推开门的那一刻，暖黄色的灯光洒在原木桌面上，疲惫瞬间被治愈～最惊喜的是整套软装算下来居然只要两位数！学生党和打工人直接闭眼抄作业！👇

🏷️【我的百元逆袭清单】
1. 暖光落日小台灯 💡（💰29.9）：氛围感神级单品，关掉大灯瞬间温馨！
2. 垂感棉麻格纹桌布 🪵（💰16.8）：一秒遮住老旧掉漆的桌面，拍照巨出片。
3. 桌面原木阶梯置物架 🪴（💰32.0）：收纳香薰、手账和绿植，空间立马立体起来。
4. 仿真尤加利叶小绿植 🌿（💰12.5）：给小房间注入满满生机～

💡【给租房女孩的避坑小Tips】
• 千万别买大件家具！搬家时扔了心疼带走费劲，轻量软装才是王道。
• 统一色调（原木色+米白+暖黄），视觉上房间瞬间大一倍！
• 善用局部光源，温馨感立刻拉满。

生活是租来的，但每天的心情是自己的呀✨
有想看的清单链接评论区告诉我，下期继续分享超实用的独居好物！

#我的租房日常 #出租屋改造 #治愈系小角落 #花小钱提升幸福感 #独居女孩的生活碎片 #小红书家居灵感`,
  summary: '百元低成本出租屋软装改造，打造温馨原木治愈角落。',
  imageUrls: DEV_XHS_MOCK_IMAGES,
}

/** 小红书深度干货长文生成成稿 Mock */
export const DEV_XHS_ARTICLE_RESULT = {
  title: '副业做自媒体半年，我总结出的这5个血泪教训（新手必看）',
  content: `# 副业做自媒体半年，我总结出的这5个血泪教训（新手必看）

从去年裸辞兼职做自媒体到现在，从前3个月阅读量个位数，到如今多篇万赞、开始稳定接商单变现。回头看看走过的弯路，如果有人早点告诉我这5点，我至少能省下三个月的无用功。

---

### 一、不要自嗨式创作，先搞清楚读者想看什么
新手最容易犯的错误就是“把账号当个人朋友圈”。
- ❌ 错误示范：发长篇大论抒发个人心情，感叹生活不易。
- ✅ 正确姿势：站在受众痛点提解决方案。读者划过屏幕只有2秒钟，他们只关心“这篇笔记对我有什么用”。

### 二、视觉第一眼决定了80%的点击率
在小红书，封面和前三行文案就是生死线。
- 封面大字要突出矛盾或核心利益点。
- 配色切忌花哨，统一主色系和排版模板，建立个人视觉识别度。

### 三、持续输出的秘密：建立自己的选题素材库
很多新手坚持不到两周就觉得“被掏空”，核心是没有素材输入机制。
1. 日常拆解同赛道点赞过千的爆款封面与结构。
2. 记录身边朋友高频提问的问题。
3. 养成随手记录灵感的便签习惯。

### 四、不要追求完美主义，先完成再完美
第一篇笔记往往是最差的一篇。不要反复修改半个月不敢发，算法反馈才是最好的导师，在快速迭代中寻找网感。

### 五、及早设计变现闭环
纯靠流量收益很难走远，早期就要明确：你的能力模型能为读者交付什么价值？是资料包、咨询还是定制服务？

---

> 种一棵树最好的时间是十年前，其次是现在。共勉！

#自媒体运营 #副业赚钱 #自媒体新手 #个人成长 #认知提升`,
  summary: '总结半年自媒体副业从0到1的5大血泪经验与避坑清单。',
  imageUrls: [DEV_XHS_MOCK_IMAGES[0]],
}

/** 小红书智能改写对照 Session Mock（包含5组不同切入点候选标题与精修正文） */
export const DEV_XHS_REWRITE_SESSION: SocialStudioRewriteSession = {
  pass1Body: DEV_XHS_IMAGE_TEXT_RESULT.content,
  pass2Payload: {
    titles: [
      '租房改造！花100块把出租屋变成梦中情房✨闺蜜以为我搬家了（痛点直击型）',
      '房东看了都想涨租！我用100块把破旧出租屋爆改成日落原木风（反常识好奇型）',
      '建议收藏！百元搞定出租屋软装改造，附完整好物避坑清单（保姆级清单型）',
      '独居女孩的自愈时刻：每天推开门，这个百元小角落都在治愈我（情绪共鸣型）',
      '100元预算挑战！4件平价好物打造治愈系原木风角落实测（数据证据型）',
    ],
    body: `终于把房东留下的老干部风出租屋，改造成我心心念念的治愈系原木风小角落了！🌿

下班推开门的那一刻，落日台灯的暖黄色柔光洒在原木桌面上，一整天的疲惫瞬间被融化～最让人激动的是，整套软装算下来居然只有两位数！

🏷️【我的百元高颜值软装清单】
1. 暖光落日小台灯 💡（💰29.9）：氛围感神级单品，关掉日光灯的一瞬间，整个房间都温暖了起来。
2. 垂感棉麻格纹桌布 🪵（💰16.8）：拯救老旧掉漆桌面的法宝，自然垂落的褶皱超有质感。
3. 桌面原木阶梯置物架 🪴（💰32.0）：错落有致，收纳香薰、手账和迷你绿植，视觉层次感拉满。
4. 仿真尤加利叶小绿植 🌿（💰12.5）：免打理不惹虫，给狭小房间注入生机活力。

💡【租房女孩的省心避坑心得】
• 轻量软装才是终极答案！避免笨重大家具，搬家轻松带走不心疼。
• 全屋严格控制3种色系内（原木+奶白+暖黄），空间立刻视觉显大。
• 舍弃惨白主灯，用小台灯营造多点光源，出租屋也能住出五星级度假感。

房子是租来的，但每天的生活是自己的呀✨
清单好物大家可以评论区留言，下期继续给姐妹们深扒平价宝藏！

#我的租房日常 #出租屋改造 #治愈系小角落 #花小钱提升幸福感 #独居女孩的生活碎片 #小红书家居灵感`,
  },
  selectedTitleIndex: 0,
  secondPassSkipped: false,
}

/** 小红书对标向导采集母本 Mock（12.8w 赞） */
export const DEV_XHS_WIZARD_BENCHMARK: WorkbenchBridgeCollectedItem = {
  url: 'https://www.xiaohongshu.com/explore/dev-mock-sample-01',
  platformId: 'xiaohongshu',
  workId: 'xhs-benchmark-sample-01',
  title: '普通人怎么低成本改造出租屋？花100块住进原木梦中情房',
  content: `很多刚毕业的姐妹以为出租屋改造要花大几千，其实只要抓住核心视觉锚点，100块就能彻底改头换面！
重点是不要换大件，只做软装和氛围灯光。用棉麻桌布遮丑，用暖光灯营造温馨，再配上原木小架子收纳，拍照直接原图直出！`,
  author: '独居小鹿酱',
  publishTime: Date.now(),
  collectedAt: Date.now(),
  coverUrl: DEV_XHS_MOCK_IMAGES[0],
}

/** 小红书对标向导最终完成产物 Mock */
export const DEV_XHS_WIZARD_RESULT: WizardGeneratedResult = {
  title: '后悔没早点这样改！花100元打造治愈系原木风出租屋✨',
  content: DEV_XHS_IMAGE_TEXT_RESULT.content,
  summary: '拆解小红书10w+家居改造爆款母本，重构原木风软装清单。',
  imageUrls: DEV_XHS_MOCK_IMAGES,
}
