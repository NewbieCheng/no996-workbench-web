# 不加班工作台网页端

独立的 React 18 + TypeScript + Vite + Tailwind v4 网页项目。公共组件快照保存在本项目 `packages/ui`，安装、构建和运行都不读取桌面仓库或其他项目。

页面交互固定为 **表单 → 生成 → 展示/编辑/复制/下载**，不含聊天输入框、会话列表、续聊或通用任务过程舞台（唯一例外见下节）。真正的 AI/音视频能力经本项目代理调用既有 Go 后端，不另起服务或数据库。

线上演示站点：<https://agent.no996ai.cn/>（发布细节见本机 `DEPLOYMENT.md`；该文件含服务器信息，不入库）。

## 快速开始

```powershell
npm install
# 先启动 Go 后端（默认 :8080），或直接把 VITE_API_PROXY_TARGET 指向远端环境
npm run dev
```

开发地址 `http://127.0.0.1:8897`（`strictPort`，端口被占用会直接失败）。Vite 将 `/api`、`/v1`、`/media` 代理到 `VITE_API_PROXY_TARGET`。登录后访问 `/workbench`。

构建（含 TypeScript 检查）：`npm run build`；仅类型检查：`npm run typecheck`。产物 `dist/` 需要静态服务器做单页回退；部署子目录时先设 `VITE_BASE_PATH`（须以 `/` 开头结尾），路由 basename 与品牌资源会同步。

纯函数回归测试（无需浏览器与后端）：`npm run test:agent`（agent 内核与两条生成流程的判定逻辑）、`npm run test:voice-tts`（任务队列、播放地址与 IndexedDB 健康判定）。

端到端流程校验（本机 Node，用 esbuild 打包后直跑，不连后端）：`npm run test:flows` —— 覆盖阶段注册、标题候选与 Pareto 一致性、脚本时间码与留存曲线、提词器 HTML 自包含、人设注入开关的开/关两条路径等 82 项不变量。

### 环境变量

| 变量 | 默认 | 用途 |
|---|---|---|
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8080` | 开发/预览代理目标（`/api`、`/v1`、`/media`） |
| `VITE_BASE_PATH` | `/` | 部署子目录前缀 |
| `VITE_CHAT_MODEL` | 未设 | 可选；仅用于默认模型接口诊断，不随生成请求发送 |
| `VITE_WORKBENCH_AI_MODE` | `remote` | 设 `demo` 时全站走本地样例/mock（见「接入状态」） |
| `VITE_PERSONA_USE_REMOTE` | 未设（即 remote） | 设 `0` 强制人设 mock |

本地联调样例见 `.env.development.example`；`.env.development.local` 为个人配置且不入库（`.gitignore` 忽略 `*.local`）。

## 路由与页面

`src/app/navigation.ts` 是**唯一导航定义**，也是首页入口的来源；`src/App.tsx` 注册路由与登录守卫。未登录访问 `/workbench/*` 一律重定向 `/login`。

| 路径 | 页面 | 数据来源 |
|---|---|---|
| `/login` | 登录 / 注册 | 真实后端认证 |
| `/workbench` | 首页 | 静态内容 + 导航 |
| `/workbench/persona` | 人设定位 | 真实（后台任务 `persona_generate`，执行器内跑前端 agent loop） |
| `/workbench/titles` | 爆款标题 | 真实（后台任务 `titles_generate`，执行器内跑前端 agent loop） |
| `/workbench/video-script` | 视频脚本 | 真实（后台任务 `script_generate`，执行器内跑前端 agent loop） |
| `/workbench/live-script` | 直播脚本 | 真实（后台任务 `script_generate`，执行器内跑前端 agent loop） |
| `/workbench/xiaohongshu` | 小红书图文 | 页内 `social-compose` 流式生成 + 手机壳预览与发布面板（`source_create` 只读历史） |
| `/workbench/wechat-article` | 公众号图文 | 页内 `social-compose` 流式生成 + 预览 / 排版 / 导出（`source_create` 只读历史） |
| `/workbench/moments` | 朋友圈 | 演示模式页内 mock；远程模式通过 `moments_plan` / `moments_copy` 后台任务生成和改写 |
| `/workbench/voice` | 声音克隆 / TTS | 真实（`/v1/audio/voices`、`/api/v1/ai/audio/speech`；合成入队 `voice_tts`） |
| `/workbench/ip-video` | IP 口播视频 | 六步创作流水线（内容 / 画面 / 配音 / 生成 / 微调 / 封面与合成）+ AI 方向与画面统筹（`ip_video_create`）+ 确认后配音 + 独立 1:1 封面 + 本机导出；工程和素材与视频工厂分库隔离 |
| `/workbench/video-factory` | 视频工厂 | 本机视频项目与模板编辑、导出工作流；能力细节与接入状态以页面和 `docs/video-assembly.md` 为准 |
| `/workbench/digital-human` | 数字人 | 真实换口型（`digital_human_retalk`）+ 本机项目/段落仓储；真实收费与下载验收未完成 |
| `/workbench/extension` | 插件 / 采集与素材 | 插件桥 + 本机素材库 |
| `/workbench/account` | 账号与资产 | 真实（余额 / 流水） |
| `/workbench/membership` | 会员 | **纯展示**，无支付接口 |

旧地址由 `legacyRoutes` 统一跳转，不使用两套页面逻辑。侧栏另有「桌面端专属」分组，只作入口说明，不可导航。

生成流程按业务页面实现：人设、标题、脚本、图文、配音、IP 视频、视频工厂与朋友圈等流程都在 `src/features/agent-flows.ts` 汇总注册。注册只表示流程代码已接入，不代表供应商接口、收费或成片已完成真实环境验收。部分流程页内运行，另一些通过后台任务执行；以页面提交逻辑和对应 executor 为准。

## 创作页 UI 约定

视频脚本 / 直播脚本 / 爆款标题三页在本次改动中重做，共同约定：

- **纵向单列**：输入在上、结果在下。原先的 `SplitPane` 可拖拽分栏与 `.split-pane__handle` 拖拽条已整体删除（`src/components/SplitPane.tsx`）。
- **首屏只留必填**：一个主输入框 + 少量胶囊选项（时长 / 目标 / 平台）即可提交；补充资料、结构预览、更多设置全部收进折叠区，`更多设置` 会显示「已改 N 项」。行内示例与「重置」在同一行，不再额外占按钮位。
- **人设开关在标题行右上角**：`PersonaInjectionToggle` 经 `Page` 的 `actions` 插槽渲染（`titleExtra` 是标题左侧，不是右上角）。默认开启；关闭则该页完全不注入人设。
- **过程面板只给「进度 + 流式正文」**：不渲染提示词、无复制提示词入口；流式正文经 `createDisplayDelta` 过滤，见上方 Agent 内核一节。
- **结果区三种版式（刻意做出差异）**：
  - 视频脚本：`网格 290px + 1fr` —— 左侧粘性手机预览（`264×528`、7px 边框、40px 圆角）播放节奏，右侧分镜列表。
  - 直播脚本：`网格 220px / 1fr / 270px` —— 左侧时间线、中间提词器、右侧控场清单；`[data-mode='live']` 整体深色导播台，**故意不跟随全局明暗主题**。
  - 爆款标题：上一段输入是「一句式创作台」（把主题与受众嵌进一句话里），结果区为 `网格 360px + 1fr` —— **左侧「接力过程」（步骤 + 每一步产出摘要），右侧「标题进化图」+ 候选列表**，与参考稿 `爆款标题 · 接力进化版.html` 的 `.ws/.pl/.rs` 一致。两栏共用选中态，点圆点或点列表互相联动。
- **两页共用一个引擎**：`/workbench/video-script` 与 `/workbench/live-script` 是同一个 `script-lab` 的两套主题（`[data-mode='video']` 浅色橙、`[data-mode='live']` 深色导播台），不是两套页面逻辑。

## 接入状态

**已接真实后端**：登录 / 注册 / 验证码 / 刷新 / 登出、账号余额与流水、`chat/completions`（人设、标题、脚本、小红书、公众号）、`/v1/tools/web_search`、TTS 与声音复刻。失败时直出后端错误，**不回退到成功样例**。

**仍是演示 / 占位**：会员价格展示（不创建支付）、首页静态内容。图文复刻的图片请求已接后端图片生成接口；图生图能力、供应商配置、费用与发布链路仍需真实环境验收。数字人已接真实换口型但**未通过真实收费与浏览器播放/下载验收**。

`VITE_WORKBENCH_AI_MODE=demo`（或 `VITE_PERSONA_USE_REMOTE=0`）会把标题、人设、视频脚本、直播脚本、小红书、公众号与发布面板统一切回本地确定性样例，用于离线预览；此时生成结果必须标注「演示」。

## Agent 内核（生成能力统一底座）

业务生成能力按页面流程复用 `src/agent/`，并在 `src/features/agent-flows.ts` 汇总注册；页面运行方式以各自实现为准。分层与硬约束见 `AGENTS.md`「Agent 内核」一节。

- **展示格式按响应类型处理**：结构化 JSON 流用 `src/agent/stream-filter.ts` 的 `createDisplayDelta` 提取页面正文键；纯文本流不套用 JSON 字段过滤。流程画布输出经 `stage-output-preview.ts` 处理并确保不显示提示词。
- **过程面板不展示提示词**：`StageRunner` 仍把 `actualPrompt` 记进快照供本机排障，界面一律不渲染、也不给复制入口；只显示「进行到哪一步」与流式正文。
- **人设注入开关**：消费方三页（视频脚本 / 直播脚本 / 爆款标题）默认开启；关闭时传 `personaContent: undefined`，模板渲染为「表达参考人设：无」。标签只写在提示词模板里，flow 只传正文，避免双标题。

其余要点：合规判定统一走 `runHardCheck`；脚本可导出 Markdown 与自包含提词器 HTML；收敛轮次上限 3、留存曲线单调不增且起点 100；视频/直播脚本的输入向导可整块收起；`import.meta.env.DEV` 专属的 dev-fixtures 按钮在生产构建中物理剔除。

## IP 口播创作页

维护文档：[架构调用图、设计思路与提示词调整指南](docs/ip-talk-architecture.md)，包含页面、后台任务、AI 分支、模板、配音与浏览器导出调用链。

页面只有一条六步流水线：**内容 → 画面 → 配音 → 生成 → 微调 → 封面与合成**。作品切换、保存状态、撤销和导出合并到页顶同一工具栏；底部引导、右侧入口面板和「高级编辑」开关已移除，步骤栏承担导航，生成偏好统一收进「高级设置」二级弹窗。

- 第 5 步是「对象栏 + 画布 + 属性检查器」：点画布里的字幕或人物会同步选中，右侧改细节；画布与左右列可拖拽调宽，时间轴按需展开。所有步骤共用同一工程和撤销栈。
- 第 6 步的封面是独立的 1080×1080 PNG，不再把 9:16 画布压成方图；视频画幅只保留竖屏 / 横屏 / 1:1，旧工程的 3:4 仍可读取。封面标题、照片和铺满 / 完整显示可单独调整。
- 「我的模板」保存实际字幕样式和背景，可选保存画幅、静态主人物构图；按账号隔离，仅保存在当前浏览器。模板不含文稿、音频、私有素材或任务绑定，不是完整内容工程模板。应用为一条可撤销命令，人工字幕时间、逐句覆盖、声音、镜头和关键帧保持原样；覆盖保护分组前确认。
- 完整文稿默认原文使用，已有原声优先；人工修改的字幕、人物构图和镜头分组可保护。方向建议只填入草稿并进入第 2 步，不会立刻发起付费生成；局部调整与重新编排整片是明确分开的动作。
- 可选的 AI 画面生成复用既有 `src/api/images.ts` 接口：用户写清提示词和尺寸后才调用，成功后作为素材加入当前画面，失败显示真实接口错误；不预选模型、不虚构价格。

- 正式 AI 走 `ip_video_create` 本机后台任务，流程在 `src/features/ip-video/agent/`，严格限制为静态能力的纯数据输出，经本机校验后以单命令应用；不会执行 AI 生成代码。
- 现有 10 款本地字体、12 套字幕组合；6 个内容版镜头接入当前口播，原 151 个镜头中的其余 145 项未适配，不作为可用能力宣传。音效/BGM 未取得逐项分发证据时不开放。
- 收费配音在用户检查文稿、默认音色并明确确认后单独提交，不因改字体/画面/镜头自动调用。没有语音转写接口，已有音视频需要原稿或 SRT 才能安排字幕。
- 作品和任务仅本机浏览器保存，后台执行需保持浏览器运行；导出需保持标签页打开。方案完成时工程已改则保留当前版本，可另存方案副本。实际播放、音画同步、字体和导出效果仍由用户页面验收。

## 后台任务

适用方式以各页面当前实现为准：后台任务用于需要可恢复执行和统一历史的流程；小红书/公众号 `social-compose` 保持页内生成。不要仅因生成耗时就把现有页内流程迁入任务队列，新增能力沿用同类页面模式并确认任务体验需求。

- 存储：IndexedDB `no996-workbench-tasks`（版本号以 `src/services/workbench-tasks/idb-store-health.ts` 的 `WORKBENCH_TASKS_DB_VERSION` 为唯一来源），store `jobs` / `payloads` / `blobs`；任务元数据、载荷与音频等二进制都在本机浏览器，**不上传服务端**。
- kind 唯一事实来源是 `src/services/workbench-tasks/types.ts`；当前任务执行器见 `src/services/workbench-tasks/executors/`。保留早期记录兼容类型不代表当前页面仍会创建该类任务。
- 执行：登录态下 `WorkbenchTaskRunner` 串行执行，登出即暂停；首次取得本账号队列锁时，将遗留的普通 `running` 任务立即重置为 `queued`（数字人远端任务另行恢复）。重新排队不等于断点续跑；口播创作有防自动重复调用标记，普通配音中断后重进仍可能再次请求，详见 [IP 口播恢复边界](docs/ip-talk-architecture.md#113-关闭浏览器后的恢复与重复请求边界)。
- 入口：顶栏「后台任务」抽屉（`src/features/tasks`）为全站统一入口；各功能页用 `useWorkbenchTasks({ kind })` 展示同源历史。
- 清理：成功 80 条 / 失败 20 条且 7 天 / blob 150MB；单条可删除或取消。演示模式不入队。

新增左侧功能时：在 `WorkbenchTaskKind` 登记 kind → `executors/` 实现 → `WorkbenchTaskProvider` 暴露 `enqueue*` → 页面提交时入队并提示到任务中心查看。

## 浏览器本地数据

| 用途 | 位置 | 键名 / 库名 |
|---|---|---|
| 访问 / 刷新令牌、记住登录 | localStorage 或 sessionStorage | `no996_wb_access`、`no996_wb_refresh`、`no996_wb_remember` |
| 登录页输入记忆 | localStorage | `no996_last_credential`、`no996_remember_password`、`no996_last_login_intent` |
| 登录页邮箱回填 | sessionStorage | `no996_wb_email` |
| 验证码发送冷却 | sessionStorage | `no996_verification_cooldown_<purpose>:<target>`（60 秒） |
| 界面语言 | localStorage | `no996_wb_lang`（zh-CN / en-US） |
| 主题模式 | localStorage | `no996-web-theme` |
| 侧栏宽度 / 模式 | localStorage | `no996.wb.sidebar.width`、`no996.wb.sidebar.mode` |
| 历史卡片 / 列表视图偏好 | localStorage | `no996_history_view_mode` |
| 后台任务、载荷、音频 | IndexedDB | `no996-workbench-tasks`（store `jobs` / `blobs` / `payloads`） |
| 人设草稿 | IndexedDB | `no996-workbench-persona`（store `personas`） |
| 采集素材 | IndexedDB | `no996-workbench-materials`（store `materials`，按 `ownerUserId` 隔离） |
| IP 口播风格模板 | IndexedDB | `no996-ip-talk-style-templates`（store `styles`，按账号 `scope` 隔离；与作品、媒体和任务分库） |
| IndexedDB 一次性修复标记 | localStorage | `no996_wb_idb_repair_v2` |

爆款标题历史已并入后台任务队列（`titles_generate`），不再单独使用 localStorage；旧的 `no996_viral_titles_history_v1` 已无引用。

旧库 `no996-workbench-voice-tts` 仅作为迁移源存在，数据会并入 `no996-workbench-tasks` 后被清理。播放中的 blob URL 只缓存在内存（`playback-cache.ts`），不持久化。

素材处理按功能区分：部分文件仅作本机预览；数字人、声音等指定流程会在用户操作后按接口契约上传。临时 URL 在替换、删除和卸载时释放。浏览器草稿不是云端账号存储，不宣传跨设备保存。

## 收费展示

`/workbench/membership` 是**纯静态展示**：三档为新人体验 0 元、专业月度会员 29 元（按年 23 元/月）、企业年度会员 299 元（按年 239 元），按钮 `href: '#'`，点击只弹「咨询客服」提示，**没有任何支付接口**；首页另有「3 天体验」文案。声音克隆的扣费由后端 `meta.points_per_clone` 裁决（前端仅在缺省时回退 9900 点数显示）。

积分赠送、充值档位与有效期未确认，**不编造余额、额度、订单或支付成功**。正式余额与订单由服务端裁决。

## 验收现状

本次 IP 口播 V2 仅完成源码与文档整合，模板针对性断言已补但未运行；未运行测试、类型检查、构建、浏览器或真实模型调用。以下既有验收记录不代表 V2 已通过运行验收。

**历史已通过**：`npm run build`、`npm run typecheck`；`npm run test:agent`、`test:voice-tts`、`test:flows`、`test:docs`、`test:video-assembly` 全绿；公网 HTTP 检查（首页、登录、当前导航功能、旧短路径、构建产物、品牌资源 200，缺失资源 404，HTTP→HTTPS 301）与 `/api/v1/auth/captcha` 反代 200。脚本：`scripts/verify-deployment.cjs`。

**可复用资产清单**由 `npm run test:docs` 核对文档中明确登记的路径与标识是否存在；检查不判断清单是否完整，也不验证文档描述是否与运行行为一致。

**流程级联调**（`npm run test:flows`，不连后端）校验当前注册流程及其核心产物不变量，包括标题候选与排序、脚本时间与留存、提词器 HTML、流式展示过滤、人设开关等；具体断言以 `scripts/agent-flow-check/` 为准。

**浏览器已核**：登录页加载、进入工作台、侧栏收缩、深层路由直达、390×844 无横向溢出、公众号输入 HTML 显示为文本不执行；三页改版（视频脚本亮橙手机预览 + 分镜卡、直播脚本深色导播台三栏、爆款标题接力过程 + 进化图）、过程面板 DOM 中搜不到 `actualPrompt`、人设开关开/关、1180px 与 860px 断点无横向溢出。

**尚未实测**：深色模式完整视觉回归、全控件键盘操作、各工具取消/重置/失败恢复的字段组合、剪贴板内容、导出文件实际落盘、公众号富文本粘贴兼容、真实文件选择与播放、无来源目录的新机器重装构建、中英文全量切换、提词器全屏与 HTML 落盘、真实成片与音画同步。

构建与自动化断言**不替代**产品验收。

## 视频编辑器与预制组件组装

现状见 `docs/video-assembly.md`：公共包 `@no996/video-editor` 的工程/命令/渲染/面板，以及 `core/assembly/` 的静态组件目录（32 组件 / 18 动效 / 8 布局 / 6 风格 / 4 配方）、v1 计划校验与单条撤销提交均已实现。IP 口播页已接入受限导演计划、同工程编译与本机风格模板界面；通用组装模板与旧 `TemplateProject` 不作为口播模板使用，也不提供完整内容工程套版。图表未接 D3、Lottie 未接入。外部来源与许可见 `MIGRATION_PROVENANCE.md`。

构建成功与自动化断言**不替代**产品验收：真实成片、音画同步和浏览器兼容仍待用户人工核验。

## 已知问题

- `/workbench/membership` 未登记进 `src/app/workbench-surface.ts` 的样式映射，该页不套用 fluid 布局修饰类。
- `GET /api/v1/auth/permissions` 已封装（`src/auth/permissions.ts`）但全仓无调用点；目前没有角色级路由守卫。
- `scripts/local-api-smoke.mjs` 与 `scripts/set-prod-voice-clone-points.cjs` 含跨仓绝对路径（指向后端 `.env`），与「独立项目」约束冲突；属运维脚本，不影响安装与构建。
- `src/services/voice-tts/` 为 `@deprecated` 兼容层，已无页面直接引用，仅服务旧库迁移，可后续移除。
- 页面文案通过 i18next 与少量遗留的 `src/i18n/panel-copy.tsx` 并存；新增文案优先使用 i18next，历史文案迁移按页面分批完成。
- 主 bundle 与字体资源仍有进一步按需拆分的空间；体积结论应以当前构建统计为准。
- 测试覆盖以 `package.json` 当前脚本为准，不在文档硬编码测试文件数量；新增测试应加入对应测试入口。
- 后台任务本地库健康检查（`idb-health.ts`）与写入方（`idb-repository.ts`）共用 `idb-store-health.ts` 里的 `WORKBENCH_TASKS_DB_VERSION`；**改版本号必须只改这一处**，否则健康检查会以旧版本 `open` 触发 `VersionError`。
- `scripts/agent-flow-check/` 为本机端到端校验，依赖已安装的 esbuild；它不参与构建产物。
- `src/services/workbench-tasks/executors/source-create.ts` 仍保留 `text_sections` / `source_create` 分支，只为兼容早期任务记录。
- 爆款标题一轮完整生成约 6 次模型调用（拆解 / 写作 / ≤3 轮评审 / ≤2 次改写），耗时明显高于早期单次调用版本；分阶段进度与默认折叠的过程面板用于解释这段耗时。

## 项目结构

- `src/app/`：导航、工作台壳层、主题、语言菜单。
- `src/agent/`：**统一 agent 内核**（流程注册、阶段执行、提示词、硬校验、流式过滤 `stream-filter.ts`、mock/远端客户端、sink）。
- `src/features/`：按领域拆分的页面（人设、标题、脚本实验室、图文、声音、数字人、插件、账号、会员、任务）；`agent-flows.ts` 汇总注册各流程。
- `src/services/`：后台任务、人设仓储、素材库、插件桥、发布编排、浏览器复制/下载。
- `src/api/`：后端薄封装（`client`、`chat`、`tools`、`tts`、`voice-clone`、`errors`）。
- `src/components/`：`WorkbenchUI.tsx` 页面装配、`agent/` 共享过程组件（`AgentProgress`、`AgentStageDetail`、`PersonaInjection`、`PersonaBinding` 等）。
- `src/prompts/`：领域字段与提示词模板。
- `src/styles/`：主题、组件与页面样式；`agent-ui.css` 为 agent 共享组件样式（步骤进度条的样式已随组件移入 `packages/ui/src/stage-progress.css`），品牌主题令牌以本地 CSS 为准。
- `packages/ui/`：桌面公共组件的自包含快照（含本地新增的通用件，如 `stage-progress.tsx`），经 `@no996/ui/*` 别名导入。
- `scripts/`：构建包装、部署、校验与联调脚本。
- `deploy/`：目标服务器发布与 Nginx 配置。

## 文档

| 文件 | 内容 |
|---|---|
| `AGENTS.md` | AI 开发约束与实现契约（动手前先读） |
| `docs/reusable-assets.md` | **可复用资产清单**（Agent 内核 / 组件 / 服务层的公开面与用法，新功能先查这里；`npm run test:docs` 机械核对） |
| `docs/video-assembly.md` | 视频编辑器与预制组件组装的现状、已实现边界与未接通项 |
| `API_CONTRACTS.md` | 后端接口、鉴权、默认模型、扩展桥接协议与**接入状态 / 待提供资料** |
| `DEPLOYMENT.md` | 线上站点、发布与回滚流程（含服务器信息，仅存本机，不入库） |
| `MIGRATION_PROVENANCE.md` | 外部来源、UI 快照与视频渲染选型登记 |
