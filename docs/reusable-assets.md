# 可复用资产清单（Reusable Assets）

> **这是新功能开发的第一个入口。**
> 要加一个 AI 生成能力、要接一个后台任务、要做进度/历史/人设/素材/导出？
> **先在本文件里搜一遍**。这里登记项目已有的共享能力与入口；使用前仍应核对当前页面接线、组件导出和适用范围。是否有自动化测试或浏览器验收以各资产条目及实际测试为准。
>
> 维护约定：新增可复用件（内核模块、公共组件、服务层接口）时顺手登记到本文件。
> 注意 `npm run test:docs` 只核对**已经写进来**的路径与标识名是否存在，不检查有没有漏登记 —— 漏了不会被拦住，但下一个功能就翻不到它。
> 只给「功能页内部用」的私有件不必写进来 —— 本文件只收「下一个功能大概率还要用」的东西。
>
> 最后核对时间：2026-10-12（核对手法见文末「怎么保证这份清单没写错」）。
> 2026-10-12 起，创作三页的步骤进度条已抽成通用件（§3.4 `StageProgress`），不再只服务这一处。

---

## 0. 先看这个：我该用什么？

| 你要做的事 | 用这个 | 位置 |
| --- | --- | --- |
| 加一个全新的 AI 生成功能（多步骤、要进度、要流式） | **Agent 内核** + 复制一份现成 flow 当骨架 | §2 |
| 只想在页内跑一次 agent（不落后台任务） | `useAgentRun()` | §2.7 |
| 要让耗时生成走后台队列 + 历史回填 | 任务队列 + `enqueue*` | §4 |
| 要展示「进行到哪一步」（**任何多步骤流程**，自备步骤数据） | `<StageProgress>` | §3.4 |
| 同上，但步骤数据来自 Agent 内核算快照 | `<AgentProgress>`（`<StageProgress>` 的 agent 适配层） | §3.1 |
| 要展示合规结果 / 关键指标 | `<AgentMetrics>` | §3.2 |
| 要展示「每一步做了什么」 | `<AgentStageDetail>` | §3.3 |
| 要展示「生成中」的过程大卡片（默认折叠） | `<WorkflowRunCard>` | §3.5 |
| 要让用户自己点开看「几位专家、几个环节、怎么跑」 | `<AgentFlowExplain>`（`<FlowExplain>` 的 agent 适配层） | §3.12 |
| 要把一屏参数拆成分步填写 | `<InputWizard>` | §3.6 |
| 要挂「本机人设」开关 | `usePersonaInjection()` + `<PersonaInjectionToggle>` | §3.7 |
| 要给结果做 Markdown / HTML 导出 | 导出工具 | §5 |
| 要判合规（违禁词、字数、医疗承诺…） | `runHardCheck`（**唯一入口**） | §2.5 |
| 要过滤模型流式增量，别把 JSON 漏给用户 | `createDisplayDelta` | §2.6 |
| 要调模型 / 检索 / TTS / 媒体 | 传输层封装（**别自己 fetch**） | §6 |
| 要定超时 / 重试次数 / token 上限 | `resolveBudgets()` + `StageRunner.budgets` | §2.14 |
| 要把人设 + 定位卡片当**背景上下文**注入 | `createStageRunner({ background })` | §2.14 |
| 要判断某个错误该不该重试 | `isRetryableError()` | §2.12 |
| 要新增一个可重试的错误判定（如截断） | `withRetry(fn, retry, signal, shouldRetry)` | §2.12 |

**四个最容易犯的错**（都踩过）：

1. **另写一套循环**。内核已经处理了：阶段状态、耗时、提示词记录、流式累加、超时、重试、取消、快照落库。自己写一遍必然漏掉其中几项。
2. **把原始 JSON 流直接给界面**。必须过 `createDisplayDelta`，否则用户会看到 `{"segments":[{"id":"1","spoken":"…`。
3. **把提示词渲染出来**。`actualPrompt` 只进快照供本机排障，**一律不展示、不给复制入口**。
4. **把降级当成功**。模型失败后回退到代码兜底常量、却仍然向用户声称「AI 已补全 / 已生成」，就是假成功。任何兜底都必须在数据里留痕（如 `fromFallback` + `fallback`）并在界面上如实说明。详见 §2.14。

---

## 公共控件补充：工作台按钮与视图页签

公共按钮位于 `packages/ui/src/button.tsx`，页签位于 `packages/ui/src/tabs.tsx`；统一样式为 `packages/ui/src/workbench-controls.css`，已由 `src/index.css` 全局加载。

- `Button variant="toolbar"`：32px 工具栏中性按钮，人设页「新建人设」已接入。使用默认尺寸，不依赖页头祖先选择器。
- `Button variant="generate" size="action"`：44px 实色主要操作，爆款标题「开始生成」已接入。生成状态仍由页面提供 `disabled`、`aria-busy` 和文案；需要统一任务交互时复用既有 `AITaskButton`，不另建生成循环。
- `Tabs` + `TabsList variant="toolbar"` + `TabsTrigger`：36px 分段视图切换，内部选项30px；受控 `value` / `onValueChange`，键盘交互由 Base UI 提供。`WorkbenchPageViewTabs` 仅适配工作台文案、历史数量与既有面板 id。
- `GlassPanel` / `GlassButton` / `GlassBadge`：使用 `packages/ui/src/glass-components.css` 和 `packages/ui/src/glass-tokens.css`。属于 Web 毛玻璃近似，不是 Apple 官方 Liquid Glass。常规工作台工具栏不必使用 3D 玻璃效果。
- **墨囊 Toast**：`src/components/InkCapsuleToaster.tsx` + `src/styles/toast-inkcapsule.css`（全局 Sonner 皮肤）；业务侧优先 `src/lib/toast.ts` 的 `toastSuccess` / `toastError` / `toastWarning` / `toastInfo`，时长见 `src/lib/toast-durations.ts`。
- **扩展素材导入**：`src/features/extension/materials/ExtensionMaterialImport.tsx` 通过 `materials.list` 分页预览，确认后通过 `materials.read` 读取所选正文并导入，使用 `materialRepository` 按用户隔离保存；插件能力仍需联调。
- **扩展素材远程图**：`src/features/extension/materials/WorkbenchMediaImage.tsx`（B站 CDN 保留 Referer，其余 `no-referrer`；失败走 `extensionClient.fetchAsset` → blob URL）；公网正文图 `material-public-media.ts`（`getMaterialPublicImageUrls` / `getMaterialDisplaySrc`）；可选本机模糊兜底 `src/services/materials/material-asset-hydration.ts`（`hydrateMaterialFallbacks`，受 `material-settings` 开关控制）；预览式详情 `ExtensionMaterialDetailStage` + `MaterialMediaFrame` / `MaterialAttachmentStrip`；样式 `src/styles/extension-materials.css`（`wb-material-*` 卡片网格）。小红书标题/作者展示与入库规范化：`xhs-material-display.ts`（`resolveXiaohongshuDisplayTitle` / `normalizeXiaohongshuCollectedItem`，`material-media.ts` 与 `material-repository.ts` 消费）。
- **视频封装随机写入**：`packages/video-editor/src/media/byte-store.ts` 的 `BoundedByteStore` 按位置处理数据块和回写，供快速导出、逐帧导出与 IP 视频编码复用；成片上限为 250 MiB。
- **`Card`（`@no996/ui/card`）= `GlassPanel` 的结构化外壳**：`Card` / `CardHeader` / `CardContent` / `CardFooter` 负责分区与间距；面板级描边、模糊与 inset 高光一律由 `.glass-panel` 提供（默认 `glow={false}`，圆角 `--glass-panel-radius: 16px`）。业务页**禁止**再写 `border` / `box-shadow: var(--shadow-card)` / `bg-card/85` 等第二套「卡片皮」；无分区需求时可直接 `GlassPanel` 或 `GlassCard`。
- **`WorkbenchUI.Panel`**：仍是 `Card` + 标题区，勿在 feature CSS 里用 `.wb-panel` 覆盖背景/圆角/阴影。
- **脚本预览轨**：外层 `GlassPanel` 按视频橙色、直播青绿色提供无描边玻璃底色，内层 `.sl-wiz-rail__surface` 透明，避免双层背景形成色带。
- **`ResizableSeparator`（`@no996/ui/resizable-separator`）**：`packages/ui/src/resizable-separator.tsx` 是垂直分隔条的共享指针/键盘行为；通过 `direction` 适配拖动方向，通过 `onResize(delta)` 接回调型布局，支持边界 Home/End、取消指针捕获与双击复位。`ColumnDivider` 继续作为基于 CSS 变量和父 Grid 测量的布局适配器使用同一行为。社媒配置栏、声音设置栏和图文图片/正文栏用轻量领域包装保留各自文案及 CSS 外观；视频工厂分隔操作、工作台导航宽度和可缩放手机预览属于不同布局契约，逐步评估后再决定是否复用，不要直接替换。当前 `ColumnDivider` 调用点：脚本向导、人设、数字人；详见 `src/features/`。
- **社交工作室**：根节点 `GlassPanel` + `.social-studio` 网格布局 class，外框勿再单独写 `border-radius` 壳。

组件目录中的按钮展示与实际页面使用上述同一套实现；局部浅/深预览补齐文字、边界与底色令牌。所有导入只指向本项目 `@no996/ui`。

## 1. 分层与依赖方向（先记住，不然容易写歪）

```
业务页面 (features/<name>/*Page.tsx)
   ↓  只调 flow 与组件
业务 flow (features/<name>/agent/<name>-flow.ts)   ← 每个功能自己写这一层
   ↓  只用内核 API
Agent 内核 (src/agent/)                            ← 复用，不修改
   ↓  只用传输层
传输层 (src/api/)                                  ← 复用，按需加薄封装
```

**硬约束**（有测试或 lint 兜着，别绕）：

- `src/agent/` **不得** import `src/features/`。内核不认识任何业务。
- flow **不得** import `services/workbench-tasks`。落库一律走 `AgentSink` 抽象（§2.9）。
- 页面**不得**直接 fetch 模型接口，一律经 `createAgentClients()`。

---

## 2. Agent 编排内核 · `src/agent/`

统一出口：`import { … } from '@/agent'`（对应 `src/agent/index.ts`，`export *` 了下面全部模块）。

一句话定位：**「多步骤 AI 生成」的通用骨架**。阶段声明、按序执行、状态与耗时记录、提示词记录、流式累加、超时重试、取消、快照，都由它提供；业务只需要写「提示词 + 每步做什么」。

### 2.1 类型 · `@/agent`（原 `src/agent/types.ts`）

最常用到的：

```ts
type AgentStageKind = 'model' | 'algo' | 'tool'          // 阶段类型，驱动 UI 标签
type ModelProfileId = 'extract' | 'plan' | 'draft' | 'review' | 'autofill'
type AgentStageStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped'
type AgentRunStatus = 'idle' | 'running' | 'done' | 'failed' | 'cancelled'

type AgentStageDef = {          // 声明一步（写在 features/<name>/agent/stages.ts）
  id: string
  order: number                 // 展示序号，从 1 开始
  roleName: string              // 「策划员」「结构师」「定稿」
  roleTag: string               // 标签文案，由 kind 推导，UI 可覆盖
  kind: AgentStageKind          // ⚠️ 必须诚实：纯算法步骤不得标成 AI
  principle: string             // 折叠区一句话原理
  headline: string              // 运行中文案，只在 status==='running' 时展示
  profile?: ModelProfileId
}

type AgentStageState = {        // 运行时状态（由 StageRunner 自动维护）
  id: string
  status: AgentStageStatus
  round?: number
  headline?: string
  actualPrompt?: string         // ⚠️ 只进快照，禁止渲染
  output?: unknown
  error?: string
  streamingContent?: string     // 流式增量累加
  searchAttempts?: AgentSearchAttempt[] // 搜索目的、关键词与成功/失败；不含原始搜索返回
  startedAt?: number
  finishedAt?: number
}

type AgentSearchAttempt = {
  query: string; purpose?: string
  status: 'running' | 'succeeded' | 'failed' | 'rejected' | 'cancelled'
  error?: string; resultCount?: number; startedAt: number; finishedAt?: number
}

type AgentRunSnapshot = { flowId: string; stages: AgentStageState[]; round: number; status: AgentRunStatus; error?: string; fallback?: boolean }

type AgentClients = { chat: AgentChatClient; search?: AgentSearchClient; isMock: boolean }
type AgentSink = { publish(snapshot: AgentRunSnapshot): void | Promise<void> }
```

### 2.2 模型画像 · `MODEL_PROFILES` / `resolveProfile()`

给每一步挑「用哪个档位的模型」，而不是到处硬编码模型名。

```ts
const MODEL_PROFILES: Record<ModelProfileId, ModelProfile>
const DEFAULT_PROFILE_ID: ModelProfileId = 'plan'
function resolveProfile(id?: ModelProfileId): ModelProfile
```

### 2.3 提示词模板 · `@/agent`（原 `prompt.ts`）

```ts
const COMMON_RULES: string[]                       // 通用约束，用 withCommonRules 追加
const JSON_ONLY_INSTRUCTION = '只输出 JSON，不要 markdown 代码块，不要解释。'

function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
  options?: { mark?: boolean; empty?: string },     // 默认 { mark:false, empty:'无' }
): string
```

- 占位符语法：`«key»`（西文双角括号，注意不是 `{{}}`）。
- **缺失变量渲染成 `empty`（默认 `无`），不留占位符**。
- `mark: true` 时输出 `«值»` 形式，用于调试/高亮。
- 还有：`stripVarMarks(text)`、`listOrNone(items, empty='无')`、`withCommonRules(body)`。

> 踩过的坑：如果字段标签写在提示词模板里（如 `表达参考人设：«persona»`），flow 就**只传正文**。两处都加前缀会拼出双标题。

### 2.4 解析 · `@/agent`（原 `parse.ts`）

```ts
function extractJsonObject(text: string): string          // 从模型输出里抠出 JSON 对象
function parseStrictJson<T>(text: string, label = '模型返回'): T   // 严格解析，失败抛错
function extractFencedMarkdown(text: string, fence: string): string  // 取 ```fence ... ```
function hasFence(text: string, fence: string): boolean
```

### 2.5 硬校验 · `runHardCheck`（**唯一合规判定入口**）

```ts
function runHardCheck(input: HardCheckInput): HardCheckResult
function hardCheckSummary(result: HardCheckResult): string
const BUILTIN_BANNED_WORDS: readonly string[]
```

覆盖：内置违禁词、用户禁用词、必含词、医疗/收益承诺、虚假紧迫感（仅直播）、无来源数字、分段字数。

- 分段字数默认 **1.3 倍容差**；有硬上限的场景（如标题）传 `segmentCharTolerance: 1`。
- `segmentId` 用**显示序号**，评审与必改清单才能定位到具体那一条。
- **不要在业务里另写一套「能不能过」的判断**，否则两处口径会漂移。

### 2.6 流式过滤 · `createDisplayDelta`（**必须用**）

```ts
type TextStreamFilterOptions = { keys?: string[]; separator?: string }   // keys 默认 ['spoken']
function createTextStreamFilter(options?: TextStreamFilterOptions): TextStreamFilter
function createDisplayDelta(
  onDelta: ((chunk: string) => void) | undefined,
  keys: string[],
  separator?: string,
): ((chunk: string) => void) | undefined
```

- 模型返回的是 JSON，`flow` 的 `onDelta` 入参是**原始 JSON 增量**。
- 本过滤器按字符状态机只抽取指定字段（脚本 `spoken`、标题 `title`），并解码 `\n` `\"` `\\` `\uXXXX`。
- **不变量**：输出与分块边界无关；绝不吐出 `{ } [ ] "`；绝不抛异常。已有 9 项测试守着。

### 2.7 执行器 · `StageRunner` / `createStageRunner`

```ts
type StageRunnerInput = {
  flowId: string
  stages: AgentStageDef[]
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  background?: string            // 背景上下文（人设 + 定位卡片），本流程每步自动带上
}

class StageRunner {
  readonly budgets: AgentBudgets             // 按 clients.isMock 解析出的超时/重试/token 预算
  async runModel<T = string>(stageId: string, req: RunModelRequest<T>): Promise<T>
  async runModelWithTools<T>(stageId: string, req: RunModelWithToolsRequest<T>): Promise<T>
  async runSearch(stageId: string, query: string, purpose?: string): Promise<AgentSearchResult>
  async runTool<T>(stageId: string, fn: () => Promise<T>): Promise<T>
  async runAlgo<T>(stageId: string, fn: () => T): Promise<T>
  async failStage(stageId: string, e: unknown): Promise<void>
  async skip(stageId: string): Promise<void>   // 会清掉上一轮同一步的计时/提示词
  async finish(status?: AgentRunSnapshot['status']): Promise<void>
  markFallback(used: boolean): void
  snapshot(): AgentRunSnapshot
}

type RunModelRequest<T> = {
  userTemplate?: string; vars?: TemplateVars      // 二选一：模板
  user?: string                                    // 直接给最终 user 文本
  system?: string
  profile?: ModelProfileId
  tools?: Array<{ name: string; description: string }>
  parse?: (raw: string) => T                       // 不传则返回正文文本；**在重试闭包内执行**
  onDelta?: (chunk: string) => void                // ⚠️ 原始增量，务必过 createDisplayDelta
  retry?: number
  timeoutMs?: number                               // 默认 this.budgets.stepMs（别写死）
  maxTokens?: number                               // 覆盖画像默认值；重试时按 retryMaxTokens 抬升
  responseFormat?: { type: 'json_object' | 'text' }// 结构化输出；流式步骤不要开
  background?: string                              // 覆盖 runner 级背景
  round?: number
}

type RunModelWithToolsRequest<T> = { messages: …; tools?; profile?; parse?; onDelta?; retry?; timeoutMs?; maxTokens?; responseFormat?; background?; maxTurns? /* 默认 6 */; round? }
```

它自动帮你做：阶段状态流转、耗时、`actualPrompt` 记录、`streamingContent` 累加、超时、重试、取消、快照落库（有 sink 时）。六条容易忽略的行为：

- **`parse` 抛错也会重试**（在重试闭包内），因为解析失败是真机最常见的失败模式。
- **重试前会清空 `streamingContent`**，避免重试把同一段正文叠加两遍给用户。
- **截断（`finish_reason === 'length'`）会被识别为可重试并抬高 `maxTokens`**，否则必然重复截断。
- **`timeoutMs` / `retry` 不传就取 `this.budgets`**，不要自己写常量。
- **联网搜索目的与关键词会写入运行快照**，供功能页解释本次查询；原始搜索返回仍不直接展示。
- **联网搜索失败不必终止模型流程**：`runSearch()` 记录失败并返回空结果，`runModelWithTools()` 将失败反馈给模型，关闭后续工具调用后继续纯模型回答；流程画布可以据快照显示成功/失败分支。
- **`skip()` 会清掉上一轮同一步的计时与提示词**。收敛环里同一 stageId 每轮重跑，只改 `status` 的话，快照会留下「已跳过，却耗时 49.9 秒、还带着上一轮提示词」的记录 —— 面板据此渲染出**一个从来没发生过的耗时**（真机复测实测到）。跳过 = 没跑，所以 `startedAt` / `finishedAt` / `actualPrompt` / `output` / `streamingContent` 全部清空，`round` 记为**发生跳过的那一轮**。
- **`finish()` 必须调用，且会把残余的 `idle` 统一补成 `skipped`**。收敛环提前 `break` 时，后面的步骤根本没执行到，但也不该永远停在 `idle` —— `idle` 对用户意味着「还在排队」，而整轮其实已经结束了。收录理由很实际：三个 flow 里已经有一个（`titles-flow`）漏了这事，真机复测抓到「整轮 `done`、编辑仍显示『待执行』」。让每个 flow 自己记得调 `skip()` 是**静默失效**的（只是状态不好看，不会报错），所以这个兜底放在内核里。

> ⚠️ `headline`（「正在拆解…」）是**运行中文案**，只在 `status === 'running'` 时有意义。UI 侧 `<AgentProgress>` 已按此处理，自己写渲染时别无条件展示。

### 2.8 流程注册 · `defineFlow` / `getFlow` / `listFlows`

```ts
function defineFlow(id: string, stages: AgentStageDef[]): AgentFlowDefinition
function getFlow(id: string): AgentFlowDefinition | undefined
function listFlows(): AgentFlowDefinition[]
function roleTagFor(kind: AgentStageDef['kind'], override?: string): string
```

**必须在 `src/features/agent-flows.ts` 里统一 import 一次**（`main.tsx` 已引入该文件）。否则「声明」不会生效，流程会从注册表里静默消失 —— 这是踩过的坑：注册靠 import 副作用，页面不再引用自己的 `features/<name>/agent/stages.ts` 时就丢了。

### 2.9 落库抽象 · `createMemorySink` / `createTaskSink`

```ts
function createMemorySink(flowId: string): MemorySinkHandle   // { sink, subscribe(listener) }
type TaskSinkPort = { patchMeta(meta: Record<string,string>): Promise<unknown>; patchSnapshot(s: AgentRunSnapshot): Promise<unknown> }
function createTaskSink(port: TaskSinkPort): AgentSink
function snapshotToMeta(snapshot: AgentRunSnapshot): Record<string, string>
function snapshotProgressSignature(snapshot: AgentRunSnapshot): string
```

`createTaskSink` 是「内核 → 后台任务」的适配缝：flow 只认 `AgentSink`，**不知道** IndexedDB 的存在。`snapshotProgressSignature` 必须把 `streamingContent` / `streamingReasoningContent` 长度写进签名，否则真 SSE 增量不会写回任务 payload。

### 2.9.1 SSE 解析 · `src/api/chat-stream-parse.ts`

`applyChatCompletionStreamPayload`：从单条 `data:` JSON 分发 `delta.content` 与 `delta.reasoning_content`（供 `chat.ts` 与 `chat-stream-parse.test.mjs`）。网关真流式验收：`npm run verify:chat-stream`。

### 2.10 客户端 · `createAgentClients` / `createMockAgentClients`

```ts
function createAgentClients(options?: AgentClientOptions): AgentClients   // 按 demo/远端自动解析
function createRemoteAgentClients(): AgentClients
function resolveAgentMode(): 'remote' | 'demo'
function createMockAgentClients(options?: AgentClientOptions): AgentClients

type AgentClientOptions = {
  mockResponder?: (req: AgentChatRequest, ctx: { call: number; stageHint?: string }) => unknown | null
  mockSearch?: (query: string) => Array<{ title: string; snippet: string; url?: string }>
}
```

- 判定：`VITE_PERSONA_USE_REMOTE === '0'` → demo；否则 `VITE_WORKBENCH_AI_MODE === 'demo'` → demo；否则 remote。
- **演示应答器的业务上下文必须由调用方显式传入**（主题/读者/平台），**禁止**从提示词里正则抠字段 —— 提示词一改就静默退化成占位符。

### 2.11 React 集成 · `useAgentRun(flowId, options?)`

```ts
function useAgentRun(flowId: string, options?: AgentClientOptions): {
  snapshot: AgentRunSnapshot | null
  isMock: boolean
  running: boolean
  sink: MemorySinkHandle['sink']
  reset: () => void
  clients: AgentClients
}
```

页内直接跑一次流程时用它，省掉自己接线。

### 2.12 运行时工具 · `@/agent`（原 `runtime.ts`）

```ts
function isAbortError(e: unknown): boolean
function httpStatusOf(e: unknown): number | undefined        // 同时认扁平 status 与 axios 的 response.status
function isRetryableError(e: unknown): boolean               // 5xx/408/429/网络 → true；4xx/取消 → false
function errorMessage(e: unknown, fallback = '执行失败，请稍后重试。'): string
function throwIfAborted(signal?: AbortSignal): void
function sleep(ms: number, signal?: AbortSignal): Promise<void>
async function withTimeout<T>(…): Promise<T>
async function withRetry<T>(fn, retry?, signal?, shouldRetry?, onRetry?): Promise<T>
async function streamChunks(…)
```

`withRetry` 的后两个参数是**给业务留的扩展点**：`shouldRetry` 决定某个错误值不值得重试，`onRetry` 在重试前做清理或加码（内核用它清空流式缓冲、抬高 `max_tokens`）。默认策略与预算见 §2.14。

### 2.13 照抄骨架：新增一个 AI 功能的标准四步
```
src/features/<name>/agent/
  stages.ts        ← defineFlow(id, stages)，kind 要诚实
  prompts.ts       ← «变量» 模板
  <name>-flow.ts   ← createStageRunner(...) + runModel / runTool / runAlgo
  demo-responder.ts← 演示应答器（显式接收业务上下文）
src/features/<name>/<Name>Page.tsx  ← 用 <AgentProgress> 等组件展示
src/features/agent-flows.ts         ← import './<name>/agent/stages'（别忘）
src/services/workbench-tasks/executors/<name>-generate.ts  ← 要后台队列才加（§4）
```

**现成范例**（直接读、直接抄结构）：

- `src/features/titles/agent/` —— **8 阶段**（4 位 AI 专家 + 1 步检索 + 3 道本机算法），含 `scoring-model.ts`（纯算法步骤的写法）。
- `src/features/script-lab/agent/` —— 视频/直播共用一套引擎，**8 阶段**（6 位 AI 专家 + 2 道本机算法），含 `src/features/script-lab/agent/retention.ts`（留存曲线）、`src/features/script-lab/agent/library.ts`（结构库适配缝）、`src/features/script-lab/agent/finalize.ts`。
- `src/features/persona/agent/persona-flow.ts` —— 人设生成。
- `src/features/titles/agent/titles-flow.ts` —— 爆款标题生成。
- `src/features/script-lab/agent/script-flow.ts` —— 视频脚本与直播脚本生成。
- `src/features/voice/agent/voice-advanced-flow.ts` —— 高阶配音（Agent 拆段与语气规划，浏览器拼接成片）。
- `src/features/voice/agent/document-chunking.ts` —— 长文稿按句切分与规划批次装箱、`mergePlannerSegments`、`enforceAdvancedSegmentTextLimits`（高阶 TTS 软上限见 `VOICE_ADVANCED_TTS_SEGMENT_SOFT_MAX` / `VOICE_ADVANCED_PLANNER_CHUNK_MAX` in `voice-constants.ts`）。
- `src/features/voice/lib/parse-planner-stream.ts` —— `parsePlannerStreamContent`：从 `segment_planner` 流式 JSON 增量解析分段预览（配合 `createTextStreamFilter` 展示 title/text/instruction）。
- `src/features/voice/lib/voice-workflow-nodes.ts` —— `buildVoiceWorkflowNodes` / `resolvePlannerBatchTotal`：高阶配音流程大图多批拆段扇出与汇总节点拓扑。
- `src/features/voice/components/VoiceWorkflowCanvas.tsx` —— 配音专用 `WorkflowCanvasDialog` 封装，读取任务 `meta.planner_*` 与 `checkpoints.segment_planner`。

### 2.14 稳定性与兜底：预算、重试、截断、背景上下文（**真机缺陷后重设计**）

这一节是 2026-10-12 用**真实 API + 真实数据**跑三个页面之后新增的。当时的现象是：**演示模式一路顺畅，真机必然降级**。根因不是模型不行，而是内核按「演示应答器毫秒返回」拍了一组写死的预算与兜底策略，对真机全都不成立。四个已修缺陷与设计如下。

#### (1) 预算必须按模式取，不能写死在 flow 里 —— `src/agent/budgets.ts`

```ts
type AgentBudgets = {
  stepMs: number; flowMs: number; reviewerMs: number; autofillMs: number
  retry: number; reviewerMaxTokens: number; maxTokensCap: number
}
function resolveBudgets(isMock: boolean): AgentBudgets
function retryMaxTokens(base: number, attempt: number, cap: number): number
```

`StageRunner` 在构造时按 `clients.isMock` 解析一次，flow 用 `runner.budgets`（或自己 `resolveBudgets(clients.isMock)`）取值。**flow 里不要再出现 `3_000` / `60_000` / `90_000` 这类常量。**

| | 演示 | 远端 | 为什么 |
| --- | --- | --- | --- |
| `stepMs` | 8s | 150s | 真机实测单次 2.7s–45.8s |
| `flowMs` | 30s | 480s | 真机整流程实测到 94s |
| `reviewerMs` | 8s | 180s | 评审一次输出最长 |
| `autofillMs` | 4s | 30s | 真机预填实测 5.5s–8.2s |
| `reviewerMaxTokens` | 4096 | 8192 | 4096 会把评审 JSON 截断 |
| `maxTokensCap` | 16384 | 16384 | 重试加码的上限 |

**不变式**：`flowMs > stepMs`（否则单步还没跑完流程就断了）。这条有断言兜着（`budgets.test.mjs`）。

> 演示模式故意保持**短预算**：演示应答器是确定性的、毫秒级返回，真超时就说明有 bug，应当暴露而不是拖。

#### (2) 重试策略要能区分「值得重试」与「重试也白搭」 —— `isRetryableError()`

```ts
function isRetryableError(e: unknown): boolean
function httpStatusOf(e: unknown): number | undefined
async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  retry?: number,
  signal?: AbortSignal,
  shouldRetry?: (e: unknown, attempt: number) => boolean,
  onRetry?: (e: unknown, attempt: number) => void | Promise<void>,
): Promise<T>
```

- **5xx / 408 / 429 / 无状态码（网络层）→ 可重试**。真机实测出现过**响应体完全为空**的 500，命中率约 37.5%，且在慢调用之后聚集 —— 典型瞬时故障。
- **4xx → 不重试**。400 参数错、401 未认证、402 余额不足都是确定性拒绝，重试只会白等一轮**并再扣一次积分**。
- **取消（AbortError）→ 永不重试**。
- 新增可重试的**业务**错误时用第 4 个参数注入判定，不要改默认策略。内核自己就是这么加「截断可重试」的。

⚠️ **前提是错误必须带着状态码往上抛**。`src/agent/clients.ts` 早先写的是 `throw new Error(apiErrorMessage(e))`，把 axios 形状整个丢掉，于是重试层无法判断 5xx/4xx，空响应体的 500 还会退化成 `Request failed with status code 500`。现在由 `preserveAgentError()` 保留 `status` 与 `response`。

#### (3) 解析必须在重试闭包**内部**，截断要能识别

三个改动一起才有效，缺一个都不成立：

1. **解析移进重试闭包**。此前 `withTimeout(withRetry(chat))` 之后才 `parse()`，解析在重试范围之外 —— 一次解析失败直接终局降级。而真机上最常见的失败恰恰就是解析失败。
2. **`AgentChatResult.finishReason`**。上游 `finish_reason === 'length'` 表示正文被 `max_tokens` 砍断，`content` 是残缺 JSON。内核抛内部 `TruncatedOutputError`，把它显式标成可重试，并在重试时用 `retryMaxTokens()` **抬高上限**（否则必然重复截断）。没有这个字段，截断对内核完全不可见。
3. **重试前重置流式缓冲**。`onDelta` 的增量是累加的，不清空就会把同一段正文叠加两遍给用户看。

顺带修掉的隐性失真：`src/api/chat.ts` 的流式分支此前把 `finish_reason` **写死**成 `toolCalls.length ? 'tool_calls' : 'stop'`，流式请求永远报不出截断。现在改为回传上游真实值。

#### (4) 结构化输出：`response_format` + 抬高 token

`ChatCompletionParams.response_format` 早就通了，但 `AgentChatRequest` 没暴露、flow 用不上。现在 `RunModelRequest.responseFormat` 可用：

- **评审 / 理解 / 规划 / 改写这类要 JSON 的步骤：开 `{ type: 'json_object' }`。**
- **走流式的步骤（编剧 / 改写正文）不要开**。流式 + `json_object` 的组合**尚未在真机验证**，风险大于收益；编剧偶发截断由 (3) 的重试兜住。这条是刻意的取舍，不是遗漏。
- 评审还要单独抬 `maxTokens: budgets.reviewerMaxTokens`：它是单次输出最长的一步。

#### (5) 背景上下文（人设 + 定位卡片）：一次传入，每步自动带上

```ts
createStageRunner({ …, background })           // runner 级：本流程所有模型步骤自动注入
runner.runModel(id, { …, background })         // 单步级：覆盖 runner 级
```

- 注入形态是**一条独立的 system 消息** `【背景上下文】…`，排在任务 system 提示词之后、user 之前。**业务侧不要自己往 messages 里塞**人物设定，否则每个 flow 都要重写一遍拼装逻辑。
- **system 提示词本身不变**：背景只说明「我是谁、对谁说」，「怎么做事」的指令仍最贴近用户输入。
- 装载的是**人设 + 定位卡片**（`readPersona()` 读到的启用档 `content`）。
- 放在 runner 上而不是每步传参，是因为「漏传某一步」几乎必然发生：真机上的表现是「评审员突然不知道我是谁」，很难查。有断言保证**无一步遗漏**。
- 关掉开关时页面传 `personaContent: undefined` → `background` 为空 → **一步都不注入**。

#### (6) 兜底的诚实性：降级必须留痕

**原则：正式 API 失败要显示真实失败，不得把兜底当成成功。**

反面案例（已修）：预填失败后代码塞了一组通用常量（`有这类需求的人` / `好用又省事` / `总被同一个问题困扰`），而 `ScriptForm` 只要看到字段非空就打印「**AI 已补全**：人群 X，卖点 Y」—— 用户看到的「AI 补全」其实是写死的字符串，而且当时整轮**没有**标 `fallback`，任务列表仍显示「已生成」。

现在的规矩：

- 兜底文案必须带来源标记：`ScriptAutofill.fromFallback = true`。
- 界面据标记说人话：`fromFallback` 时不显示「AI 已补全」，改为提示「预填未成功，人群/卖点/痛点可自己填一下」。
- 降级**同时**标记整轮：`fallback = true` + `runner.markFallback(true)`，让任务列表显示「部分步骤降级」。
- 宁可显示「这一步失败了」，也不要显示一个看起来正常的编造结果。

#### (7) 思考强度：`reasoning_effort`

`src/api/workbench-ai.ts` 的 `defaultReasoningEffort()` 统一给出默认档（**当前默认 `low`**，用户指定），经 `ChatCompletionParams.reasoning_effort` 下发。`VITE_CHAT_REASONING_EFFORT` 可覆盖；设为 `off`/`none` 或空则不下发该字段。

后端契约见 `API_CONTRACTS.md`：取值必须在该模型的 `reasoning_efforts` 列表内，`off` 会被接受但不转发上游，**不支持的取值直接 400**。

真机实测（同一提示词，各 2 次）：不传 12.9s / `low` 16.3s / `off` 12.1s / `high` 20.0s，**`minimal` 被上游 400 拒绝**。

两个要点：

- 思考强度**不改变**「模型是否返回严格 JSON」，`response_format` 才是那件事的开关。两者别混。
- 模型思考会占用同一个 completion 预算，这是「`max_tokens` 用满却几乎没正文」的成因之一，也是 (3) 要识别截断的原因。

#### (8) `src/agent/budgets.ts` · 预算表

见 (1)。新增生成能力时先想「演示能给多短、真机需要多长」，再填这张表，不要在 flow 里写常量。

#### (9) `src/services/persona/background.ts` · 背景人设组装

```ts
function positioningSummary(record: PersonaRecord | null): string        // 「所属行业：…｜职业身份：…」
function composePersonaBackground(record: PersonaRecord | null): string   // 身份 + 定位卡片 + 档案正文
async function readPersonaContext(): Promise<SavedPersona | null>         // 从本机启用档组装（index.ts 导出）
```

- 输出顺序：`身份：<档名>` → 定位卡片摘要 → 档案正文。定位摘要在前，因为它短、密度高。
- 没有任何可用内容时返回 `''` / `null`，调用方据此**完全不注入**；**不编造**占位值。
- 定位字段按 `kind` 分开列（个人 `role` vs 企业 `companyName`），不写万能映射，避免把语义不同的字段混在一起；空字段跳过。
- 已登记在 `src/services/persona/index.ts` 的导出里，页面只需 `usePersonaInjection()`。

**两路注入的分工**（务必分清，不要合并）：

| | 内容 | 去处 | 管什么 |
| --- | --- | --- | --- |
| `content` | 档案正文 | 提示词变量 `表达参考人设：«persona»` | **怎么说**（语气、视角、用词） |
| `background` | 身份 + 定位卡片 + 正文 | system 消息 `【背景上下文】` | **我是谁**（身份事实） |

两路都来自**同一个启用档**，所以不会出现「语气是 A、身份是 B」。`PersonaInjectionState` 同时给出这两个字段；flow 侧对应 `personaContent` / `personaBackground` 两个入参，落到 `StageRunner({ background })`。

---


## 3. 可复用 UI 组件

### 3.0 本地文件解析（聊天附件 / 文稿导入）· `@/lib/chat-attachments`

浏览器内「选文件 → 抽文本或读图 → 交给 AI」**唯一走本目录**；业务页禁止再写 `mammoth` / 手写 docx 解析。

| 资产 | 路径 | 用途 |
| --- | --- | --- |
| `extractDocumentText` | `src/lib/chat-attachments/parse-document.ts` | **单文件抽正文**（TXT / MD / docx；含 Word 兼容性模式 `afchunk.mht` altChunk） |
| `prepareAttachmentsFromItems` | `src/lib/chat-attachments/prepare.ts` | **多附件**（识图 data URI + 文档正文）→ `StoredChatAttachment[]` |
| `buildUserChatMessage` | `src/lib/chat-attachments/build-message.ts` | 组装 OpenAI 形 user 消息（先图后文） |
| `useLocalDocumentImport` | `src/lib/chat-attachments/use-local-document-import.ts` | 单文件导入 UI 状态（解析中提示、`toast` 报错）；配音文稿等 |
| `INGEST_PROFILES` | `src/lib/chat-attachments/ingest-profiles.ts` | `chatAttachment` / `manuscriptTextOnly` 的 `accept` 与体积上限 |
| `ChatPromptAttachments` | `src/components/ChatPromptAttachments.tsx` | 本地选图/文档条（无服务端上传）；配合 `useChatPromptAttachments()` |
| `AttachmentUploader` | `packages/ui/src/attachment-uploader.tsx` | 桌面同款通用附件 UI（`import … from '@no996/ui/attachment-uploader'`） |

单测：`src/lib/chat-attachments/parse-document.test.mjs`（含 altChunk fixture）、`build-message.test.mjs`（`npm run test:agent`）。

Agent 传附件：`AgentChatRequest.chatAttachments` 或任务 payload 的 `chatAttachments`（见人设 `enqueuePersonaGenerate`、公众号 `enqueueSourceCreate`、爆款标题 `enqueueTitlesGenerate`）。配音页文稿上传用 `useLocalDocumentImport({ profile: 'manuscriptTextOnly' })`，**仅文本类**，不含识图。

### 3.1 `AgentProgress` · `src/components/agent/AgentProgress.tsx`

「进行到哪一步」+ 流式正文的 **agent 适配层**。把 `AgentStageDef` / `AgentStageState` 映射成通用步骤数据后交给 §3.4 的 `<StageProgress>` 渲染。**三个创作页与 `WorkflowRunCard` 都只 import 它**，不需要知道字段怎么对上。

```ts
type AgentProgressProps = {
  stages: AgentStageState[]
  defs: AgentStageDef[]
  variant?: 'compact' | 'full'
  roundText?: string        // 如「第 2 轮」
  streamingText?: string    // 流式正文
  mock?: boolean            // 演示标记
  hideTitle?: boolean       // 外层已有更贴切标题时藏掉自带「创作过程」
  showProgress?: boolean    // 显示面板内「第 N 步 / 共 M 步」；默认不显示（卡头已经写了）
}
function agentProgressText(defs: AgentStageDef[], stages: AgentStageState[]): string | undefined
```

- 标签严格按 `kind` 渲染，纯算法步骤不会写成 AI。
- `status === 'running'` 才显示 `headline`，其余显示「已完成 / 待执行 / 失败 / 已跳过」。
- 状态文案统一来自**导出的** `AGENT_STATUS_LABEL`（`Record<AgentStageStatus, string>`，实际是 §3.4 `STAGE_STATUS_LABEL` 的别名）。`AgentStageDetail` 也用同一份，避免两个面板各写一套后说法不一致。
- **进度文案别在调用点自己算**：用 `agentProgressText()`，它和面板内是同一个算法。各写一套时同一个数字会算出两个值（原先卡头用的是「已完成数」、面板用的是「首个 running」），`WorkflowRunCard` 已改成共用。

### 3.2 `AgentMetrics` · `src/components/agent/AgentMetrics.tsx`

```ts
type AgentMetric = { label: string; value: ReactNode; hint?: string; tone?: 'default' | 'good' | 'warn' }
function AgentMetrics({ items, label }: { items: AgentMetric[]; label?: string })
```
`items` 为空时返回 `null`。

### 3.3 `AgentStageDetail` · `src/components/agent/AgentStageDetail.tsx`

```ts
type AgentStageDetailProps = { stages: AgentStageState[]; defs: AgentStageDef[]; title?: string }
```
把每步输出压成可读摘要（**不抛 JSON 给用户**），`kind` 驱动说明文案（算法步骤注明「不调用模型」）。**不展示提示词。**

- **必须显示状态**（`data-status` + `AGENT_STATUS_LABEL`），并对 `skipped` 调暗。只列角色名不列状态时，**没跑过的步骤和跑过的长得一模一样** —— 用户会以为每个列出的角色都真的执行了。真机复测中「编辑」被跳过（零次模型调用），面板里却和「编剧」完全相同。
- `status === 'idle'` 的步骤直接不渲染（还没轮到，列出来只是噪声）；`skipped` 则**要**渲染出来，因为它说明的是「有这一步、但本轮按收敛条件不必做」，和「还没轮到」是两回事。
- 本组件列**全部**阶段；`<AgentProgress>` 常常只喂一个子集（如脚本页的「六步」进度条，把预填与编辑折在外）。所以「跳过有没有被如实标出」要在**详情区**核对，看进度条会漏。

### 3.4 `StageProgress` · `packages/ui/src/stage-progress.tsx`

**通用步骤进度条**。只认「步骤 + 状态」这种任何板块都有的形状，**不依赖 agent 内核、不依赖任何业务**：任何多步骤流程（生成、导入、发布、批处理）都能直接用它显示「进行到哪一步」。§3.1 的 `AgentProgress` 就是它的 agent 适配层。

```ts
type StageProgressStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped'
type StageProgressStep = {
  id: string
  order: number
  label: string             // 这一步是谁在做（角色名 / 环节名）
  kind?: string             // 可选类型标签，驱动 data-kind 与默认样式
  tag?: string              // 标签文案（如「模型」「算法」）；不传则不渲染
  note?: string             // 这一步在做什么；variant === 'full' 时展示
}
type StageProgressState = {
  id: string
  status: StageProgressStatus
  headline?: string         // 运行中的一句话，只在 running 时展示
  error?: string
  startedAt?: number
  finishedAt?: number
}
type StageProgressProps = {
  steps: StageProgressStep[]
  states: StageProgressState[]
  variant?: 'compact' | 'full'
  title?: string            // 面板标题；不传则头部只显示进度 / 轮次 / 演示徽标
  roundText?: string        // 如「第 2 轮」
  streamingText?: string    // ⚠️ 必须是**可展示文本**（见下方红线）
  mock?: boolean
  hideProgress?: boolean    // 外层已报过进度时藏掉面板内文案，避免同一个数字出现两次
}
const STAGE_STATUS_LABEL: Record<StageProgressStatus, string>   // 待执行 / 进行中 / 已完成 / 失败 / 已跳过
function stageProgressText(steps: StageProgressStep[], states: StageProgressState[]): string | undefined
function stageDurationText(state?: { startedAt?: number; finishedAt?: number }): string | undefined
```

- 样式随组件走：`packages/ui/src/stage-progress.css`，由 `src/styles/components.css` `@import`（和 `wizard-steps.css` 同一套接法）。**换肤走令牌**：`--sp-*` → `--sl-*` → 全局主题令牌三级回退，所以放进 `script-lab` 会跟着该页主题变，**脱离它也落在 `--primary` / `--card` / `--border` 上，明暗主题都稳定**。要单独换色只需在容器上覆盖 `--sp-acc`（**别改这个组件的 CSS**，否则又会变回只服务一个页面）。
- **计算逻辑与渲染分开**：文案算法在 `packages/ui/src/stage-progress-model.ts`（无 JSX / 无 React），`.tsx` 只负责画。分开是为了能直接单测 —— 这三条诚实性约定靠 `packages/ui/src/stage-progress-model.test.mjs`（挂在 `npm run test:agent` 里，11 项）兜住，而不是靠注释里的「别改回去」。导出 `normalizeSteps()`（排序 + 补缺 state）、`stageProgressText()`、`stageDurationText()`、`stageStepText()`。
- **状态文案只有一份**（`STAGE_STATUS_LABEL`）：别在调用点各写一套 —— 两个面板说法不一致时用户会以为是两件事（真机复测见过）。
- **`headline` 只在 `running` 时展示**：它是「运行中文案」，跑完还渲染会留下「已完成 ✔ ／ 正在拆解客群定位…」这种自相矛盾的一行。
- **不自造数据**：没有 state 的步骤按 `idle` 显示；`stageProgressText()` 在一步都还没完成时返回 `undefined`（报「第 1 步」是猜的）；`stageDurationText()` 缺计时返回 `undefined` —— 宁可没有耗时，也不编一个。
- **`streamingText` 必须是可展示文本**：model 返回体是 JSON 时，调用方**先过 `createDisplayDelta`**（§2.6）再传进来，别把裸 JSON 塞给这个组件。组件负责呈现，不负责过滤。

### 3.5 `WorkflowRunCard` · `src/components/agent/WorkflowRunCard.tsx`

「生成中 / 已完成 / 失败 / 已停止」的**通用生成进度卡片**。人设定位、爆款标题、视频脚本、直播脚本与组件目录示例共用同一个 `WorkflowRunCard`；新增或调整生成进度样式时只改此组件。

```ts
type WorkflowRunStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
type WorkflowRunCardProps = {
  title: string                    // 如「爆款标题」
  status: WorkflowRunStatus
  activeRoleLabel?: string         // 当前阶段角色名，如「写手」
  chips: string[]                  // ⚠️ 用户输入摘要（回显用户原文），不是提示词
  submittedAt?: number             // 卡头「提交于 10-12 20:31」
  roundText?: string               // 如「第 2 轮」
  mock?: boolean                   // 演示徽标
  streamingText?: string           // 已过 createDisplayDelta 的正文字段
  snapshot: AgentRunSnapshot | null
  defs: AgentStageDef[]
  progressIds?: readonly string[]  // 只展示子集时传（如脚本页只显示六步）
  detailTitle?: string
  error?: string
  onCancel?: () => void            // 运行/排队时渲染「取消本次」
  onRetry?: () => void             // 失败时渲染重试
  retryLabel?: string
}
```

- **卡头操作集中在一行**：查看工作流、步骤列表、停止本次与重试均使用 SVG 图标按钮；步骤列表默认收起，点列表按钮后按序号展示真实阶段状态。
- **进度条是等待动画，不代表真实完成率**：运行时渐进到 95%，只有实际任务完成后显示 100%；具体执行位置仍由阶段状态与「第 N 步」决定。
- **默认折叠，运行时也不自动展开**：卡头显示当前阶段与输入摘要，步骤列表和流式正文由用户主动展开。自动展开会把等待焦虑变成刷屏。
- **绝不渲染 `actualPrompt`**：卡内只有「输入摘要 + 步骤 + 流式正文」，工具步骤只说明「已执行检索」。提示词与裸 JSON 由 `AgentProgress` / `AgentStageDetail` 拦在外面。
- 状态点颜色：运行=主题色脉冲、完成=绿、失败=红、排队=灰；主题色令牌 `--wf-acc` 默认跟随 `--sl-acc` → `--primary`，各页不必再写一套。
- **取消要分两条路**：演示模式（页内跑）取消 `AbortController`；入队任务取消 `cancelTask(task.id)`。页面按「当前是不是页内跑」选一条，不要两条都发。

### 3.6 `InputWizard` · `src/components/agent/InputWizard.tsx`

**三步输入向导壳**（创作三页共用），解决「一屏扔出十几个参数」的参数疲劳。

```ts
type InputWizardStep = { id: string; label: string; description?: string }
type InputWizardProps = {
  steps: InputWizardStep[]         // 建议 3 步：必填 / 有默认值 / 选填
  active: number
  onStepChange: (index: number) => void
  children: ReactNode              // 当前步的内容
  goLabel: string                  // 主按钮，如「生成视频脚本」
  busy?: boolean; busyLabel?: string
  goDisabled?: boolean
  onGo: () => void
  skipLabel?: string               // 中间步的「跳过，直接生成」
  error?: string; note?: string
}
```

- 内部用 `WizardSteps`（`packages/ui/src/feedback.tsx`，同 §3.11 的公共基础组件）渲染步骤条，支持点步骤跳转。
- **向导是引导，不是关卡**：主按钮常驻页脚，第 1 步填完就能生成；`skipLabel` 让用户任何时候跳过剩余步骤；每步都允许留空。
- 第 1 步只放**必填**，第 2 步放**有默认值的关键项**，第 3 步放**选填补充**。
- 页面自己保留 `step` 状态；切换模式 / 重置时记得把 `step` 归零。
- **`layout="scriptLab"`**（视频/直播脚本页）：用 `stepsSlot` + `headerSlot` 替换默认 `WizardSteps`；页脚加 `wf-wizard__foot--sticky`。可选 **`goOnLastStepOnly`**：前两步只显示「下一步」，最后一步才显示生成按钮；**`nextDisabled`** 可禁第 1 步「下一步」（如产品名为空）。样式见 `src/features/script-lab/script-lab-wizard.css`。

### 3.6.1 脚本 Lab 向导 v2 · `src/features/script-lab/components/`

| 组件 | 路径 | 用途 |
|---|---|---|
| `ScriptLabWizardLayout` | `ScriptLabWizardLayout.tsx` | 左预览轨 + 右白卡片双栏；`railCollapsed` 时单列 |
| `ScriptPreviewRail` | `ScriptPreviewRail.tsx` | 时长/分镜条/规格摘要；数据来自 `src/features/script-lab/lib/preview-segments.ts`；轨头收起钮 |
| （状态） | `ScriptLabPage.tsx` | `previewCollapsed`：收起预览轨；页头 `sl-wiz-rail-reopen` 展开 |
| `ScriptStepPills` | `ScriptStepPills.tsx` | 胶囊步骤条 |
| `ScriptStepHeader` | `ScriptStepHeader.tsx` | 每步标题与引导文案 |
| `ScriptSpecStep` | `ScriptSpecStep.tsx` | 第 2 步：时长/平台/目标大卡 + 结构 |
| `ScriptStructureEditor` | `ScriptStructureEditor.tsx` | 视频结构 preset + 段落拖拽 |
| `ScriptOptionTile` | `ScriptOptionTile.tsx` | 可点选大卡 |
| `ScriptOptionalFields` | `ScriptOptionalFields.tsx` | 第 3 步双列选填 + Agent badge；内容四字段接 AI/预设 |
| `ScriptOptionalFieldRow` | `ScriptOptionalFieldRow.tsx` | 单字段：AI 优化 + `FieldPresetPicker` |
| `polishScriptOptionalField` | `src/features/script-lab/agent/form-assist.ts` | 脚本选填字段润色（demo / 正式 API） |
| `optional-field-presets` | `src/features/script-lab/copy/optional-field-presets.ts` | intro / audience / sellingPoints / pain 预设句 |
| `countFilledOptionalFields` | `src/features/script-lab/lib/config-fields.ts` | 选填项计数 |
| `resolvePreviewSegments` | `src/features/script-lab/lib/preview-segments.ts` | 预览轨分镜秒数（优先段 `share`，其次 `SEGMENT_WEIGHT`） |
| `structureCustomText` | `src/features/script-lab/agent/library.ts` | config → 自定义结构字符串（agent 与预览共用） |

### 3.7 人设注入 · `src/components/agent/PersonaInjection.tsx`

```ts
function usePersonaInjection(): {
  enabled: boolean          // 默认 true
  setEnabled(next: boolean): void
  persona: SavedPersona | null      // 当前选中的档
  options: SavedPersona[]           // 全部候选档（真实数据），供换档菜单
  selectedId: string | null
  selectPersona(id: string): void   // 换档：只影响本页本次生成，不改本机启用状态
  loading: boolean
  content: string | undefined      // 进提示词变量（风格）
  background: string | undefined   // 进 system 消息（身份 + 定位卡片）
  record: PersonaRecord | null     // 含 formData，供表单预填
}
function PersonaInjectionToggle({ state, className }: { state: PersonaInjectionState; className?: string })
```

- 挂在 `PageShell` 的 **`actions` 插槽**（右上角）；与 `AgentFlowExplain` 分槽 —— 流程说明在 `titleExtra`（见 §3.12）。
- **默认开启**：进入页面即读本机「人设定位」的档位并勾选，**默认就是注入状态**，用户主动关才不注入。
- **可换档**：控件里除开关还有「更换」入口，列出本机真实保存的全部档（`role="menuitemradio"`）。
  - 换档**只影响这一页这一次**的生成，**不改动**本机保存的启用状态 —— 避免「随手换一次把默认档也改了」。
  - 手动换档会把开关置为开启（用户此刻显然想注入）。
  - 只有 1 个档时不渲染换档入口：那会儿开关就是全部语义，多一个按钮纯噪声。
- 关掉时页面传 `personaContent: undefined` **且** `personaBackground: undefined`，flow 应**一个字都不注入**。
- 一次给出 `content` 与 `background` 两路（语义分工见 §2.14(9)），页面要**两个都传下去**，只传一个会丢信息。
- 没人设时呈禁用态「未保存人设」，**不伪造**。
- 消费方是**视频脚本 / 直播脚本 / 爆款标题**三页；人设页本身是定义方，不注入。
- 与 §3.9 `PersonaBinding` 的分工：那个是**单档显式挑选**（小红书 / 公众号，进来默认不绑定）；这个是**默认注入 + 可换档**。

**人设 → 创作表单预填**（视频/直播脚本、爆款标题；人设页不做）：

| 件 | 路径 |
|---|---|
| `deriveScriptPrefillPatch` | `src/lib/persona-form-prefill.ts` |
| `deriveTitlesPrefillPatch` | 同上 |
| `usePersonaFormPrefill` | `src/hooks/usePersonaFormPrefill.ts` |

- 与 `content`/`background` **并行**：注入管生成时语气与身份；预填只把定位卡片里可对应的字段写入页面表单。
- **仅填空**；关注入不删已填；换档对新档再填空。
- 个人档优先读已保存的五模块主 Profile：`核心客户→audience`，`三大痛点→pain`，`产品承接→intro`，`差异化价值→sellingPoints`。没有主 Profile 时回退问卷/旧 7 字段：`audiences|targetClients→audience`，`clientSituations|clientPainPoints→pain`，`products|primaryBusiness→intro`，`differentiation|additionalInfo→sellingPoints`；`audience` 空时用 `role`+`industry`。企业档：`targetMarket→audience`，`mainBusiness→intro`，`competitiveEdge→sellingPoints`。
- 标题页：`audience` 同上；痛点进 `supplement`（`受众困扰：…`），不自动填 `topic`。
- 人设页问卷：`src/features/persona/views/PersonaQuestionnaireView.tsx`；候选选择：`PersonaSelectView.tsx`；主 Profile：`PersonaMainProfileView.tsx`。仅问卷草稿、没有 `content` 的档不能注入。

### 3.8 `RetentionCurve` · `src/components/agent/RetentionCurve.tsx`

```ts
type RetentionCurveProps = { rounds: ScriptRound[]; segments: ScriptSegment[] }
```
留存曲线（单调不增、起点 100）。

### 3.9 `PersonaBinding` · `src/components/agent/PersonaBinding.tsx`

按钮式「选一份人设」绑定器（需要用户**显式挑选**、而非默认注入时用；消费方是小红书 / 公众号）。

与 §3.7 `PersonaInjection` 的分工：那个是「默认注入 + 可换档」的开关式控件（创作三页），这个是进来默认不绑定的单档挑选器。两者都只读同一份本机数据，不各自维护状态。

### 3.10 页面骨架与页内导航

| 组件 | 位置 | 用途 |
| --- | --- | --- |
| `Page` | `src/components/WorkbenchUI.tsx` | 工具页外壳；`moduleId` 启用 `ModuleLayout` 与宽度把手；`chrome="workbench-tool"` 启用创作页全宽透明顶栏（无大号 h2） |
| `PageShell` / `PageShellHeader` | `packages/ui/src/PageShell.tsx` | 页面骨架；顶栏可拆到 `ModuleLayout` `topChrome` |
| `WorkbenchPageChromeLeading` | `src/components/WorkbenchPageChrome.tsx` | 顶栏左侧：流程说明 + 创作/历史 Tab（`.page-title-extra`） |
| `WorkbenchPageChromeActions` | `src/components/WorkbenchPageChrome.tsx` | 顶栏右侧操作组（`.page-head-actions`） |
| `WorkbenchPageViewTabs` | `src/components/WorkbenchPageViewTabs.tsx` | 「创作 / 历史」页签 |
| `WorkbenchPageHistoryPanel` | `src/components/WorkbenchPageHistoryPanel.tsx` | 本页历史面板 |
| `WorkbenchGenericHistoryView` | `src/components/WorkbenchGenericHistoryView.tsx` | 通用历史视图 |
| `SourceInput` | `src/components/SourceInput.tsx` | 素材来源选择 |

**创作页顶栏（内容创作分组）**

- `Page` 传 `chrome="workbench-tool"`：页头进 `ModuleLayout` `topChrome`（类名 `wb-page-top-chrome`），全宽、透明底；**不展示顶栏大号标题**（侧栏已有功能名）。`title` / `description` 仍保留在 `Page` 契约上供文案与后续用途。
- **必登 surface（否则顶栏下沉）**：只写 `chrome="workbench-tool"` 不够。路由段必须写入 `src/app/workbench-surface.ts` → `WORKBENCH_SURFACE_BY_SEGMENT`，至少 `workbench-page--fluid workbench-tool-page`。漏登时 `.wb-page-area__scroll` 保留默认 `padding: 32px…`，`top-chrome` 会离开滚动区顶边（对照人设页）。`npm run test:docs` 会核对「导航里的 `/workbench/<segment>`」是否已登记。
- 布局类：`wb-module-page-layout`（由 `Page` 自动合并到 `layoutClassName`）；样式真相：`src/styles/workbench-page-chrome.css`（由 `src/index.css` 引入）。
- 左右插槽用 `WorkbenchPageChromeLeading` / `WorkbenchPageChromeActions`；`actions` 用后者包一层，**不要**把 `WorkbenchPageChromeActions` 塞进 `headerTrailing`。
- **视频工厂满屏剪辑台**：`Page` 传 `enableContentWidthHandles={false}`、`minWidth={1280}`；路由面对应 `video-factory-workbench-page`（在 `.wb-page-area`）和 `.vf-studio--immersive`，样式见 `src/styles/video-factory.css`，负责隐藏列宽把手并设置内容列最小宽度。

```tsx
<Page moduleId="titles" title={t('titlesPageTitle')} description={…} chrome="workbench-tool"
  titleExtra={
    <WorkbenchPageChromeLeading>
      <AgentFlowExplain defs={TITLES_STAGES} />
      <WorkbenchPageViewTabs value={pageView} onChange={setPageView} />
    </WorkbenchPageChromeLeading>
  }
  actions={<WorkbenchPageChromeActions>{/* 人设、开发菜单等 */}</WorkbenchPageChromeActions>}
>
```

### 3.11 公共基础组件 · `@no996/ui/*` → `packages/ui/src/`

**别另建基础 UI 库。** 已有：`button` `input` `textarea` `select` `checkbox` `label` `field` `card` `badge` `dialog` `dropdown-menu` `tooltip` `separator` `skeleton` `spinner` `empty` `feedback` `input-group` `module-layout` `PageShell` `stage-progress` `flow-explain`。

### 3.12 「了解生产流程」· `packages/ui/src/flow-explain.tsx`

给用户一句话交代「这活儿是谁在帮我干」：**N 位 AI 专家与你协同，M 个环节接力完成**，点开再看按真实执行顺序排好的环节清单。

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 纯逻辑 | `packages/ui/src/flow-explain-model.ts` | 归类、排序、文案（无 JSX / 无 React，可直接单测） |
| 通用组件 | `packages/ui/src/flow-explain.tsx` | 入口按钮 + 弹层 |
| agent 适配 | `src/components/agent/AgentFlowExplain.tsx` + `src/components/agent/flow-explain-map.ts` | `AgentStageDef[]` → 通用步骤 |

```tsx
// 创作页：与 §3.10 顶栏配套
<WorkbenchPageChromeLeading>
  <AgentFlowExplain defs={TITLES_STAGES} lang={isEn ? 'en' : 'zh'} />
  <WorkbenchPageViewTabs … />
</WorkbenchPageChromeLeading>
```

- **形态是「图标按钮 + 弹层」，不是常驻窄栏。** 创作页入口在 `titleExtra` → `WorkbenchPageChromeLeading`；`actions` 用 `WorkbenchPageChromeActions`。样式：`workbench-page-chrome.css` + `.page-title-extra`（`src/styles/agent-ui.css`）。弹层外壳复用 §3.11 的 `dialog`（焦点圈闭 / Esc / 遮罩关闭都白拿），不自造浮层。
- **数字一律从 `steps[].kind` 推导，调用点不许手写。** `flowKindCounts()` 只把 `model` 算作 AI 专家，`tool` 算检索，`algo` 算本机算法；未知 `kind` 不归入任何一类（宁可合计对不上，也不把不知道的东西说成 AI）。手写的数字迟早和各流程自己的阶段声明对不上，那时面板就在撒谎。
- **不讲实现细节**：不说调用次数、不说轮次上限、不说提示词。`FLOW_EXPLAIN_COPY` 的两种语言文案与 `flowLeadText()` / `flowKindSummaryText()` 的措辞都由 `packages/ui/src/flow-explain-model.test.mjs` 兜住，`scripts/agent-flow-check/entry.ts` 另有断言扫**真实流程数据**里不允许出现「调用次数 / 轮次上限 / 提示词」等词（「Pareto」不算 —— 它已是页面公开的功能说法）。
- **标签诚实**：`algo` 的标签加虚线边框，措辞由调用方的 `roleTag` 决定，没传才退回 `flowKindTag()`（`AI` / `本机` / `检索`）—— 纯算法步骤不得写成 AI。
- 样式随组件走：`packages/ui/src/flow-explain.css`，由 `src/styles/components.css` `@import`。**换肤走令牌**：`--fx-*` → `--sl-*` → 全局主题令牌三级回退。
- 弹层宽度必须在自己的 CSS 里写 `max-width`：`DialogContent` 自带 `sm:max-w-sm`，只写 `width` 会被它压到 384px。

### 3.13 `WorkflowCanvas` · `packages/ui/src/workflow-canvas.tsx`

**可追溯的 AI 流程无限画布**。原生 React + SVG 拓扑画布，把多步 AI 协作过程以直观的 DAG 拓扑、贝塞尔连线粒子、打字光标、镜头跟随、时光回溯轴与详情抽屉呈现给用户。流程拓扑（含条件分支）由 `nodes` / `deps` 一开始完整声明；运行时用 `done` 标记命中路径、`skipped` 标记本次未命中的路径，未判定分支保持 `pending`。配套全屏弹层 `packages/ui/src/workflow-canvas-dialog.tsx`，与 `src/components/agent/AgentWorkflowCanvas.tsx` 业务适配器。

- 计算与渲染彻底解耦：布局算法与时间切片推导在 `packages/ui/src/workflow-canvas-model.ts`，单测在 `packages/ui/src/workflow-canvas-model.test.mjs`。
- 安全红线：绝不展示实际提示词；侧栏「输出产物摘要」走 `src/agent/stage-output-preview.ts`（`formatStageOutputPreview` / `resolveStageDisplayText`），展示 JSON 化 `output` 与流式正文，禁止黑盒占位。
- 回放时间轴使用相对毫秒（`normalizeWorkflowEventTimes`）；勿把 `Date.now()` 原值塞进事件 `t`，否则 HUD 会显示 epoch 秒数。

---

### 3.14 通用表单排版 · `@no996/ui/module-form`

从桌面端 `packages/ui/src/module-form/` 移植到本网页仓的本地副本。网页只从本项目导入，不依赖桌面仓。组件样式随模块入口自动加载。

```tsx
import { FormActions, FormField, FormRow, FormSection, FormSectionBody, FormSheet } from '@no996/ui/module-form'
```

- `FormSheet`：整组表单的纵向布局容器。
- `FormSection` + `FormSectionBody`：带标题与说明的表单分区。
- `FormRow`：响应式单列 / 双列 / 三列字段布局。
- `FormField`：标签、必填标记、帮助文案和错误提示。
- `FormActions` + `FormActionsSpacer`：表单底部操作区。
- 源码位于 `packages/ui/src/module-form/`；新增交互时沿用 `@no996/ui` 已有的 `Card` / `Field` / `Input` / `Textarea`，不要从桌面仓建立运行时依赖。

---

### 3.15 字段级 AI 润色 · `@no996/ui/ai-edit-popover`

```tsx
import { AIEditPopover } from '@no996/ui/ai-edit-popover'

<AIEditPopover
  fieldLabel="主要业务"
  value={value}
  result={suggestion}
  busy={busy}
  quickPrompts={quickPrompts}
  labels={labels}
  onGenerate={generateSuggestion}
  onApply={adoptSuggestion}
  onDismiss={dismissSuggestion}
/>
```

- 共享层只负责触发按钮、字段上下文、快捷指令、生成中/错误/结果展示与采用/取消；模型调用与结果保存由业务页面提供回调，组件库不绑定后端。
- 触发器为 `ghost` + `icon-sm` 的 Sparkles 图标；`labels.trigger` 用于无障碍标签与 `HoverTip` 悬停说明，不渲染按钮文字。
- Popover 使用 Portal 定位并采用不透明主题背景，避免被表单卡片裁切或透出底层内容；支持 Escape、点击外部关闭与键盘发送（Enter 发送、Shift+Enter 换行）。
- 组件库演示入口在 `src/features/component-catalog/AIEditPopoverStandardsDemo.tsx`，展示结果明确标注为本机演示样例。
- 源码：`packages/ui/src/ai-edit-popover.tsx` 与 `packages/ui/src/ai-edit-popover.css`；根出口同时导出 `AIEditPopover`、`AIEditPopoverProps`、`AIEditPopoverLabels` 与 `AIEditQuickPrompt`。
- **字段预设**：`src/components/agent/FieldPresetPicker.tsx`（人设 `PersonaPresetPicker` 为其 re-export）；列表样式与人设共用 `persona-preset-picker__*`（人设页 `persona.css`；脚本 Lab 在 `script-lab-wizard.css` 补触发器定位）。

---

## 4. 后台任务队列 · `src/services/workbench-tasks/`

适用：由页面/产品流程选用任务队列的耗时能力。队列提供本机持久化、执行状态与历史回填；并非所有 Agent 流程都必须入队，例如小红书/公众号 `social-compose` 当前为页内生成。新增流程按功能页已有架构选择并明确说明执行方式。

```ts
当前 `WorkbenchTaskKind` 与其字段以 `src/services/workbench-tasks/types.ts` 为唯一事实来源，不在清单中复制联合类型。

function useWorkbenchTasks(filter?: { kind?: WorkbenchTaskKind }): WorkbenchTaskRecord[]
function useWorkbenchTaskActiveCount(): number
function useWorkbenchTaskActions(): Actions     // 含下面这些 enqueue*
function WorkbenchTaskProvider({ children })
function useRegisterVoiceListStale(handler)
```

`Actions` 上的入队方法：

```ts
enqueueVoiceTts(input: EnqueueVoiceTtsInput): Promise<string>
enqueueVoiceDubAdvanced(input: EnqueueVoiceDubAdvancedInput): Promise<string>
enqueuePersona(input: EnqueuePersonaInput): Promise<string>
enqueueSourceCreate(input: EnqueueSourceCreateInput): Promise<string>
enqueueScriptGenerate(input: EnqueueScriptGenerateInput): Promise<string>
enqueueTitlesGenerate(input: EnqueueTitlesGenerateInput): Promise<string>
enqueueMomentsPlan(input: EnqueueMomentsPlanInput): Promise<string>
enqueueMomentsCopy(input: EnqueueMomentsCopyInput): Promise<string>
enqueueVideoFactoryExport(input: EnqueueVideoFactoryExportInput): Promise<string>
retryVideoFactoryExport(id: string): Promise<string>
```

**新增一个后台任务的标准动作**：

1. 在 `WorkbenchTaskKind` 登记 kind。
2. `executors/` 下实现执行器（写最终产物进任务的 `payload`）。
3. `WorkbenchTaskProvider` 暴露 `enqueue*`。
4. 页面提交时入队可调用 `toastTaskEnqueued()`（`src/lib/toast-task-enqueued.tsx`）：Sonner 标准成功提示「任务已发送，请在历史中查看。」；需编程打开任务中心仍用 `openTaskCenter()` / `OPEN_TASK_CENTER_EVENT`。
5. 页面历史用 `useWorkbenchTasks({ kind })`，按 `taskId` 读取并回填。
6. **创作区默认不自动灌入「最近一条成功任务」**：用 `src/hooks/useWorkbenchSessionTask.ts` 绑定本会话入队/历史打开/进行中的 `taskId`，仅在对应任务成功时 `applyPayload`；刷新进入创作 Tab 应为空白表单（进行中的任务除外）。脚本与标题页已接入。

顶栏任务中心 UI（与页内历史共用试听块）：
- `src/features/tasks/TaskVoicePlaybackBlock.tsx` + `use-task-voice-playback.ts`：`voice_tts` / `ip_video_audio` 试听与「复制地址」按钮。
- `src/features/tasks/TaskDrawerKindPreview.tsx` + `task-result-summary.ts`：按 `WorkbenchTaskKind` 展示进度条、结果 chip、懒加载 payload 摘要。
- `src/features/tasks/TaskDrawerCardItem.tsx` / `TaskCenterDrawer.tsx`：顶栏对话框卡片列表。
- `src/features/tasks/task-drawer-label.ts`（`taskDrawerModule` / `taskDrawerSubject` / `taskDrawerContext`）：任务中心折叠行与详情的主次文案，禁止再用 `subtitle` 顶替主体标题。

要点：
- 存储：IndexedDB `no996-workbench-tasks`（版本号唯一来源 `idb-store-health.ts` 的 `WORKBENCH_TASKS_DB_VERSION`），store `jobs` / `payloads` / `blobs`。
- **任务队列与历史仅本机浏览器**，不上传服务端。
- `meta` 的值**必须是字符串**（长文本放 `payload`）。
- 登录态下全局 Runner 串行执行，登出暂停。
- **演示模式不入队**。

已有执行器：`voice-tts` `voice-dub-advanced` `persona-generate` `source-create` `script-generate` `titles-generate` `moments-generate` `video-factory-export` `ip-video-create`。

### 朋友圈运营 · 本机 IndexedDB（不入云）

- **页面**：`src/features/moments/MomentsPage.tsx`，导航 id `moments`，路径 `/workbench/moments`。
- **本机库**：`src/services/moments/idb-repository.ts`，库名 `no996-workbench-moments`（weeks / schedule_items / contents / day_materials）。排期与文案只在浏览器 IndexedDB，不上传、不进 SQLite、不写工作区 Markdown。
- **流程**：`src/features/moments/agent/stages.ts` 登记 `moments-plan` / `moments-copy`；编排 `runMomentsPlanFlow` / `runMomentsCopyFlow`；围栏解析 `parseMomentsPlanOutput` / `parseMomentsCopyOutput`（`extractJsonFence` 取最后一个 json 围栏）。
- **Kind**：`moments_plan` / `moments_copy`。演示模式页内跑完、不入队；远程入队后由 `executeMomentsPlan` / `executeMomentsCopy`（`src/services/workbench-tasks/executors/moments-generate.ts`）写回本机库。
- **人设**：文案生成前 `personaContent` 为空则 `USER_PROFILE_REQUIRED`，页面跳转 `/workbench/persona`。过程面板默认折叠，流式正文经 `createDisplayDelta`，不渲染 `actualPrompt`。

### 视频工厂 / IP 编排 · 浏览器 MP4 导出（后台任务）

- **Kind**：`video_factory_export`（`src/services/workbench-tasks/types.ts`）
- **入队**：`enqueueVideoFactoryExport`（`WorkbenchTaskProvider`）
- **执行**：`src/services/workbench-tasks/executors/video-factory-export.ts` → `src/features/video-factory/lib/run-browser-export.ts`。默认 `composition: 'preview'` 走 [`run-preview-export.ts`](../packages/video-editor/src/panels/export/run-preview-export.ts)（挂载 `LiveShotLayer` 预览舞台 + [`composition-recorder.ts`](../packages/video-editor/src/core/export/composition-recorder.ts) 直录，**不走** `prepareShotFrames` / ShotFrameCache）。`offline` 仍走主线程 `ExportController` 逐帧编码。进度 `meta` 写库后必须经 Runner 的 `onJobsChanged` 刷新快照。
- **通用录制器**：`recordComposition()`（`packages/video-editor/src/core/export/composition-recorder.ts`）把已画好的 canvas 按时长编码成 MP4/WebM；预览媒体池 `PreviewMediaPool`（`packages/video-editor/src/core/export/preview-media-pool.ts`）。后续页面合成复用这两个入口，不要再写一套 html-to-image 逐帧管线。
- **快速 vs 精确**：导出面板主按钮「快速导出」（约等于片长、可能掉帧），次按钮「精确导出（逐帧）」。编码器速度档 `latencyMode: realtime`、约 4 Mbps。
- **刷新即中断**：浏览器合成不能在关页后续跑。`resetStaleRunning` 与 Runner dispose 将 `video_factory_export` 标 `failed`（「页面已刷新或关闭…」），任务中心提供「重新导出」。`beforeunload` + 站内链接点击确认。`后台任务` ≠ 云端继续。
- **资产解析**：`src/features/video-factory/lib/export-asset-resolver.ts`（工厂与 IP 编排共用）。`createAssetResolverFromDocument` 返回带 `dispose()` 的解析函数，接收素材 ID、可选源时间微秒及取消信号；图片缓存，视频按源时间逐帧解码。调用方结束时必须释放解析器，临时视频帧位图由合成调用方关闭；`runBrowserExport` 已负责释放解析器。
- **分辨率**：`packages/video-editor/src/core/export/controller.ts` 的 `resolveExportDimensions` 按短边选择 720P/1080P、保留画幅并对齐偶数像素；按工程坐标完成合成后整体缩放，不改工程里的位置、字号或描边。
- **原声混音**：`packages/video-editor/src/media/audio-mixer.ts` 的 `collectDocumentAudioClips` 统一收集配音和视频原声，遵守静音、solo 与音量；对应源区间已有显式音轨时不重复混入。缺媒体或解码失败报错，不冒充静音成功。
- **字体接线**：`runBrowserExport` 先按实际字幕字体加载本机目录里的 CSS；`ExportController` 随后等待 `ensureCaptionFonts`。后台任务无需依赖编辑页面已注册字体。
- **编码能力**：预检与编码入口都检查浏览器编码支持；能力缺失时明确失败，不返回占位视频。
- **存储隔离**：`packages/video-editor/src/core/repository/indexeddb.ts` 的 `IndexedDBProjectRepository` / `IndexedDBAssetRepository` 接收工作区参数；默认 `video-factory` 使用 `no996-video-editor-v1`，`ip-video` 使用 `no996-ip-video-editor-v1`。两边工程与素材均不互读、不回退，账号继续由复合主键隔离；导出执行器按任务 `source` 选择对应工作区。
- **前台约束**：标签页 `document.hidden` 时等待回到前台并写 `meta.stage`；存在 `running` 导出任务时 `beforeunload` 守卫（`WorkbenchTaskProvider` 内 `VideoExportBeforeUnloadGuard`）
- **UI**：`ExportPanel` 默认 `exportMode="task"`；示例编辑器 `exportMode="inline"`。任务中心下载：`TaskVideoExportBlock` + `getVideoExportDownloadUrl`

---

## 5. 导出与文档生成

### 公共字幕样式与本机字体

- `packages/video-editor/src/core/project.ts`：`CaptionStyle` 的可选 `mode` 支持 `rolling` / `clean` / `kinetic` / `editorial`；未设置时保持旧单句显示。`CaptionCue.styleOverride` 稀疏覆盖全片样式，未覆盖字段继续继承。
- `packages/video-editor/src/render/captions.ts`：`renderCaptions` 为预览和导出共用的 Canvas 字幕绘制入口；`ensureCaptionFonts(doc, options)` 按实际正文、合并后字体和字重等待字体，支持 `timeoutMs` 与 `fontSet`，失败或超时抛错。宿主须先注册所用字体的 CSS；本入口不代替字体注册，也不提供语音识别或逐字时间对齐。
- **字幕文字轨双写**：`packages/video-editor/src/panels/captions/sync-text-track.ts` 的 `applyCaptionSegments` / `writeCaptionSegmentsToDocument` / `mirrorCaptionsOntoTextTrack` 把口播/SRT 句落到 `type: 'text'` 的「字幕」轨（`TextClipElement`，id 前缀 `caption-clip:`），并同步 `CaptionCue` 供烧录。时间线拖移/裁剪经 `commitMovesSyncingCaptions` / `commitTrimSyncingCaptions` 回写 Cue。合成器跳过这些轨上标记片段，避免与烧录叠字。标题花字仍用「标题文字」轨。
- **配音估时**：`src/features/video-factory/lib/sync-captions.ts` 的 `syncCaptionsToVoiceScript` 与 IP `buildAlignedTimeline` 按**真实音频时长 + 字重**切句（非固定每句秒数、非 ASR）；工厂配音落盘与 CaptionsPanel「导入 SRT」均走双写。
- **配音库导入（字幕/音频面板复用）**：`src/features/video-factory/lib/import-voice-bundle.ts` 的 `importVoiceBundleToEditor` + `VoiceLibraryImportControl`（复用 `WizardLibraryDropdown` 历史 TTS / `ip_video_audio`）。选「音频+文稿」→ 上配音轨并估时切字幕；「仅音频」→ 只上轨。字幕页 header/空态与音频包络空态共用同一控件。
- `src/features/ip-video/editor/caption-fonts.ts`：`CAPTION_FONTS` 提供十种本机字体的真实 family/字重与标签，`captionFontByFamily` 查找保存的字体，`loadCaptionFont` 按需导入本地 CSS 并等待真实 face 就绪，超时失败可重试。导入目录本身不加载字体，不改变全局字体；出处与许可见根 `MIGRATION_PROVENANCE.md`。

### IP 口播视频本机媒体工具

- `src/features/ip-video/lib/video-renderer.ts`：`renderIPVideo` 把封面、可选真实音频与字幕样式编码为实际视频 Blob；`canRenderIPVideo` 检查浏览器编码能力。`splitSubtitleTimeline`、`subtitleIndexAt`、`estimateSpeechDuration`、`formatVideoTime` 是无副作用时间轴工具，可用于其他字幕预览与导出。
- `src/features/ip-video/lib/cover.ts`：`coverOutputSize`（`cover-size.ts`）按画布宽高出图；`createTemplateCover` / `composePhotoCover` / `composeTalkCover` 在本机将照片和标题按预设排版；`createTalkCoverProject` / `composeTalkCoverSquare` 产出真正的 1080×1080 方图，`validateImage` 限制格式、大小与像素。本文件不直接调用服务端生图；AI 画面生成走 `src/api/images.ts` 的 `generateAiImages`。
- `src/api/ip-video.ts`：`extractIPVideoScript` 通过现有扩展采集桥取作品正文，缺正文明确报错，不提供虚构语音转写。
- `ip_video_audio` 走已有后台任务与音频 Blob 仓储，入队入口 `enqueueIPVideoAudio`；页面以 `useWorkbenchTasks` 读取任务并回填。
- **新版入口**：`src/features/ip-video/composition/TalkWorkspace.tsx` 是 IP 口播唯一编辑工作区。`TalkProjectToolbar` 的显式 Portal 把工具栏放到页头；主路径由 `talk-pipeline.ts` 定义为内容 / 画面 / 配音 / 生成 / 微调 / 封面与合成六步。第 5 步使用 `src/features/ip-video/composition/TalkWorkspace.tsx` 的画布区 + `src/features/ip-video/composition/pipeline/TalkInspector.tsx`（对象栏已并入检查器，分字幕 / 素材 / 镜头三个页签），两者之间用公共 `ColumnDivider` 调宽；不复制工程或时间轴。页面历史包含正式创作、配音与导出任务，演示不入队。
- **高级设置**：`src/features/ip-video/composition/pipeline/TalkAdvancedSettingsDialog.tsx` 是唯一的二级偏好弹窗，承接文稿处理、字幕预设、动效、本机人设、保留项与复用已有内容；画幅固定归第 2 步、音色 / 语速固定归第 3 步，不在弹窗重复。打开弹窗不创建新工程。
- **成片快选**：`src/features/ip-video/composition/talk-looks.ts` 的 `TALK_LOOKS` / `applyTalkLook` 把 8 套成片（底色、字幕预设、构图偏好）应用到同一工程，不改用户画幅；空工程不要求主视觉；`TalkLookStrip` 缩略图跟当前画幅走。新视频画幅只保留竖屏 / 横屏 / 1:1，旧工程的 3:4 仍可读取但不再作为新封面画幅；`TalkFormatPicker` 只列出三种新画幅。字幕组合仍走 `TalkTemplateLibrary`。
- **1:1 封面**：`src/features/ip-video/composition/pipeline/TalkCoverPanel.tsx` 独立生成 / 下载封面；`TemplateProject.design` 与 `TemplatePainter` 按设计尺寸绘制，不再把 9:16 画布非等比压成方图。封面资产写入 `ipVideo.coverAssetId`，不放到视频主轨。
- **AI 画面**：`src/api/images.ts` 的 `generateAiImages` 是既有图像生成接口封装；`TalkAiImageDialog` 只提交明确的提示词 / 尺寸，成功后把图片作为素材加入当前画面，失败显示接口错误，不伪造成功。该对话框不选择模型、不猜价格。
- **风格模板**：`src/features/ip-video/composition/templates/model.ts` 的 `createTalkTemplate` / `applyTalkTemplate` 保存并应用完整字幕样式、背景和可选画幅/静态主视觉构图；`src/features/ip-video/composition/templates/repository.ts` 的 `listTalkTemplates` / `saveTalkTemplate` / `renameTalkTemplate` / `deleteTalkTemplate` 使用独立库 `no996-ip-talk-style-templates`，按账号隔离；`TalkTemplateLibrary` 与 `TalkTemplateSaveDialog` 提供界面。模板不包含内容或私有素材，应用不重建字幕时间、音轨、镜头或关键帧。
- **AI 统筹**：`src/features/ip-video/agent/video-assembly-flow.ts` 的 `runTalkCreationFlow` 复用 `StageRunner`，按方向 / 创作 / 调整意图运行必要分支；`src/features/ip-video/agent/schema.ts` 的 `validateTalkDirectorPlan` 严格限制字幕、构图、画幅、动效和静态内容镜头。`createTalkCreationMockResponder` 只供明确标注的演示使用，不作正式失败兜底。
- **后台创作**：`src/services/workbench-tasks/executors/ip-video-create.ts` 的 `executeIPVideoCreate` 执行 `ip_video_create`，只生成并持久化方案，不等待另一个串行队列任务。`enqueueIPVideoCreate` 入队；中断但没有完整结果时停止自动重跑，避免重复计费。
- **应用与恢复**：`src/features/ip-video/composition/use-talk-creation.ts` 的 `talkCreationFingerprint` 比较可编辑内容；`compileTalkDirectorPlan`（`src/features/ip-video/composition/talk-director-compiler.ts`）在副本上生成工程，宿主经单条 `editTalk` 命令提交。作品已改则保留现状，可另存方案副本。应用收据防止重进页面时重复应用；手动保护分组、原声和人工字幕不被隐式替换。
- **字幕组合**：`src/features/ip-video/composition/talk-caption-presets.ts` 的 `TALK_CAPTION_PRESETS` 提供 12 套字幕组合；`TalkStyleLibrary` 使用同一 Canvas 字幕绘制器展示单个选中方案，字体、版式、动效和人物构图相互独立。
- **镜头配色层**：`packages/video-editor/src/demos/shots/_fixtures/Look.tsx` 的 `useLook`（整套色盘）与 `usePalette`（自带色板镜头的 4 槽位覆盖：bg/primary/secondary/ink，附带 `isCustom` 供"用户改过底色才换底"的分支用）。`PALETTE_THEMES` 是 `colorTheme` 的 4 槽位预设表。默认值必须与镜头原本的字面量一致，这是默认帧零变化的唯一保证。不可改色的镜头登记在 `packages/video-editor/src/demos/color-fixed.json`。
- **竖屏容器**：`packages/video-editor/src/demos/shots/_fixtures/VerticalFrame.tsx` 把 1920×1080 内容装进 9:16（`cover` 裁切 / `fit` 留边 / `reflow` 交给镜头自己重排），安全区 `VERTICAL_SAFE`。构图登记在 `packages/video-editor/src/demos/vertical-presets.json`，由 `scripts/generate-shot-registry.mjs` 注入注册表 `vertical` 字段；`packages/video-editor/src/render/shot-cache.ts` 在竖屏画布下自动把预设传给 `createDomFrameRenderer`。
- **内容镜头**：`packages/video-editor/src/demos/content-variants.tsx` 的 `CONTENT_SHOT_DEFINITIONS` / `findContentShot` 是 6 个无演示私有资源的静态内容版本；`src/features/ip-video/composition/talk-shot-catalog.ts` 对照 151 个原镜头记录适配范围，145 个未适配项不进入 AI 可用目录。数量代表源码接线，不代表实际导出已验收。`retimeTalkDirectorShots` 在配音绑定后依据实际时长重排自动镜头。


| 工具 | 位置 | 用途 |
| --- | --- | --- |
| `buildScriptMarkdown` | `src/features/script-lab/lib/script-markdown.ts` | 脚本 → Markdown（**接收单个 options 对象** `{ config, segments, spokenOf, rounds, demo }`） |
| 提词器 HTML 导出 | `src/features/script-lab/lib/export-teleprompter.ts` | 自包含 HTML（零外部请求，含速度/字号控件） |
| `buildTitlesMarkdown` | `src/features/titles/agent/export-markdown.ts` | 标题 → Markdown |

**约定**：导出文件必须**自包含、零外部请求**（不引 CDN 字体）。

### 视频工厂 · 动效镜头运行时与光栅化管线（2026-10-20 新增）

视频工厂把 `video-shotcraft` 的 151 个动效镜头移植成本地组件。**不要另写一套动效系统**，按下面这三层用：

**第一层 · Remotion 兼容运行时** · `packages/video-editor/src/demos/runtime/`

| 文件 | 关键导出 | 说明 |
| --- | --- | --- |
| `packages/video-editor/src/demos/runtime/index.ts` | 统一出口 | 所有镜头都从这里 import；**禁止**在仓库里引真 `remotion` 包 |
| `frame-context.tsx` | `FrameProvider`、`useCurrentFrame`、`useVideoConfig`、`useT` | 无 Provider 时 `useCurrentFrame()` 返回 0，安全降级 |
| `interpolate.ts` | `interpolate`、`Easing`、`spring`、`bezier` | `interpolate` 默认 `extrapolate*: 'extend'`（Remotion 语义，不是 clamp）；`Easing` 是**可组合高阶函数**，`Easing.out(Easing.cubic)(0.5) === 0.875` |
| `absolute-fill.tsx` | `AbsoluteFill`、`Sequence`、`Freeze` | `Sequence` 用嵌套 Provider 实现相对帧 |
| `assets.tsx` | `staticFile`、`Img`、`waitForImages` | `Img` 挂载即登记 pending，管线截帧前 `await waitForImages()` |
| `render-gate.ts` | `delayRender`、`continueRender`、`waitForRenderGate`、`getRemotionEnvironment` | demo 量 DOM 前会挂起渲染；不实现就会截到空白帧 |
| `determinism.ts` | `random`、`createRandom`、`hashSeed`、`rand` | 确定性伪随机，替代 `Math.random`（逐帧抖动不可复现） |
| `motion-blur.tsx` | `CameraMotionBlur` | 4 个镜头用它；默认 CSS blur 近似，卡片标「近似」 |
| `video.tsx` | `OffthreadVideo` | 只有 `clipcard-looping` 用到 |

**第二层 · 光栅化** · `packages/video-editor/src/demos/pipeline/dom-frame-renderer.ts`

`createDomFrameRenderer({ load, width, height, fps, durationInFrames, props })` → `{ renderFrame(frame), dispose() }`。

内部时序：挂载 → 渲染帧 → `nextPaint` → 等待真实字体与媒体 → `waitForRenderGate` → `nextPaint` → `htmlToImage.toCanvas`。字体先经 `getFontEmbedCSS` 内嵌进 SVG foreignObject，不依赖页面字体隐式继承；加载失败或超时抛错，不能跳过字体当成成功。字体嵌入缓存按渲染器隔离，身份包含实际使用的字体 family、对应字体规则和来源地址；规则无法读取时不复用缓存，释放渲染器时一并释放。实际字形仍需浏览器与导出对照验收。

**第三层 · 缓存与合成**

| 模块 | 关键导出 | 说明 |
| --- | --- | --- |
| `packages/video-editor/src/render/shot-cache.ts` | `getShotFrameCache()`、`resolveShotFrame()` | 缩略图与导出走 360px 宽 LRU（128MB 预算），导出走全分辨率不缓存；1920×1080 单帧 8MB，**不能**把全分辨率帧留在长驻缓存 |
| `packages/video-editor/src/panels/player/LiveShotLayer.tsx` | `LiveShotLayer` | **预览实时层**：把当前时刻的镜头组件直接用 `FrameProvider` 挂到舞台上，播放头驱动 React 更新，不再用 html-to-image 逐帧光栅化（单帧几十到几百毫秒，30fps 追不上）。整层用 CSS `zoom` 缩放到舞台宽度；**不要改成 `transform: scale()`**，1920 宽的滤镜层会先做离屏纹理，反而把播放拖回长任务。加载完纹理后通知 `onReady`，期间显示「正在渲染预览…」 |
| `packages/video-editor/src/panels/player/PlayerSurface.tsx` | `PlayerSurface` | IP 宿主开启 `layeredShots` 时，按 RenderPlan 将连续 Canvas 元素分组，与实时 `LiveShotLayer` 交错；背景最底、字幕最上。不逐帧光栅化预览；默认工厂入口保持既有路径。导出走同一组件的 `ShotFrameCache`，实际一致性仍需页面验收 |
| `packages/video-editor/src/panels/timeline/TimelineTrackView.tsx` | `TimelineTrackView`、`TimelineDropPayload` | 轨道级拖放。`onDragOver` **必须**调用 preventDefault，否则浏览器不允许 drop；落点用 getBoundingClientRect 换算，不用 offsetX（避免横向滚动偏移） |
| `packages/video-editor/src/panels/shared/LibraryAddButton.tsx` | `LibraryAddButton` | 视频工厂左库「+」上轴按钮（Lucide `Plus`）；样式类 `vf-lib-add`，定义在 `src/styles/video-factory.css` |
| `packages/video-editor/src/panels/shared/LibrarySectionHeader.tsx` | `LibrarySectionHeader` | 左库折叠分类头（色点 + 计数 + Chevron）；类名 `vf-lib-section` |
| `packages/video-editor/src/panels/shared/dedupe-library-assets.ts` | `dedupeLibraryAssets`、`findReusableAudioAsset` | 素材面板展示去重（kind+name+size）；`insert-audio` 插入库音频时复用已有 asset |
| `packages/video-editor/src/core/commands/shot-commands.ts` | `InsertShotCommand`、`TrimShotCommand`、`SetShotRateCommand`、`shotDurationUs` | 不变量：`durationUs` 必须等于 `sourceDurationFrames / rate` 换算值 |
| `packages/video-editor/src/media/pcm.ts` | `decodeAudioPCM`、`rmsEnvelope`、`softClip`、`AUDIO_SAMPLE_RATE` | 主线程解码（Worker 拿不到 AudioContext） |
| `packages/video-editor/src/media/audio-mixer.ts` | `mixDocumentAudio(doc, resolveAsset, { totalDurationUs, signal })` | 多轨混成一条立体声 PCM；无音频时返回静音 PCM 而非 null |
| `packages/video-editor/src/media/audio-playback.ts` | `AudioMixPlayback` | 预览实时播放；只在播放/暂停/大跳转时重建节点，**不能**每帧重建 |
| `packages/video-editor/src/media/insert-audio.ts` | `insertAudioElement(editor, input, saveBlob)` | 探测时长 → 存 Blob → 注册 asset（同名同体积音频复用已有 asset）→ 插元素 |
| `packages/video-editor/src/media/probe-audio.ts` | `probeAudioDuration`、`probeMediaDuration` | 读 metadata 拿时长（不解码采样） |
| `src/lib/video-editor/use-asset-media-cache.ts` | `useAssetMediaCache` | 浏览器宿主预览：IndexedDB Blob → 首帧位图 + HTMLVideoElement 缓存，供 `PlayerSurface` 的 `assetSourceResolver`；视频工厂与 IP 编排共用 |

**注册表与清单（生成物，禁止手改）**

- `packages/video-editor/src/demos/registry.generated.ts` · `SHOT_CATALOG` / `SHOT_CATEGORIES` / `findShot` —— 由 `node scripts/generate-shot-registry.mjs` 生成；缺时长或组件时**硬失败**，不静默跳过
- `packages/video-editor/src/media/audio-manifest.generated.ts` · `SFX_CATALOG`（149）/ `BGM_CATALOG`（5）/ `audioAssetUrl` —— 由 `node scripts/generate-audio-manifest.mjs` 生成

**资源服务**：`scripts/vite-plugin-video-editor-assets.mjs` 把 `packages/video-editor/public/` 暴露到 `/demos/*`（纹理）与 `/video-editor/*`（音效/BGM），开发走中间件、构建期复制进 dist。**部署时必须带上这两条路由**，否则音效面板会 404。

**复用注意**：镜头源码带 `@ts-nocheck` 与已改写的 runtime import（`node scripts/rewrite-demo-imports.mjs`）。**不要**把 `'remotion'` 还原回去，也不要对这批文件跑严格 lint 后再手改类型——它们逐字来自上游。

**旧口播模板的背景镜头辅助代码（非当前入口）**

以下仅说明仍留存的模板媒体辅助代码。新版 `TalkWorkspace` 不使用旧模板面板或这套背景预览；新增口播能力应复用上方的公共 `EditorDocument`、6 个内容版镜头和同一预览/导出链。1:1 封面是唯一保留的 `TemplateProject` 设计坐标用途。

IP 旧模板侧的 `TemplatePainter.draw()` 是同步的，采用注入模式：

| 模块 | 关键导出 | 说明 |
| --- | --- | --- |
| `src/features/ip-video/lib/shot-backdrop.ts` | `ShotBackdropRenderer`、`activeShot`、`templateHasShots` | `await frameAt(project, time)` 出帧并按 `(shotId, frame)` 去重；内部 12 个 renderer 的 LRU |
| `src/features/ip-video/lib/template-renderer.ts` | `TemplatePainter.setBackdrop(frame, opacity)` | 换帧时让背景缓存失效；背景铺在底色之上、照片与文字之下 |
| `src/features/ip-video/components/ShotBackdropPanel.tsx` | `ShotBackdropPanel` | 从 151 个镜头里选，设起止/变速/透明度，写回 `TemplateProject.shots` |

三处调用方都必须在 `draw` 前 `await` 一次：实时录制 `src/features/ip-video/lib/video-renderer.ts`、离线编码 `src/features/ip-video/lib/encoding/offline.ts`、预览 `src/features/ip-video/components/TemplateCanvas.tsx`。

**配音（一键出片）** · `src/features/video-factory/lib/synthesize-voice.ts`

`synthesizeVoice(input, actions, { signal, getTask, onProgress })` 走 `ip_video_audio` 后台任务：
入队 → 轮询 → 取回 Blob。**取消时必须调 `cancelTask`**，否则后台继续跑、继续计费。
`estimateSpeechSeconds(text, speed)` 是纯函数估算，用于向导里提示时长。

**节拍检测与吸附**

| 模块 | 关键导出 | 说明 |
| --- | --- | --- |
| `src/features/video-factory/lib/beat-detect.ts` | `analyzeBeats`、`detectBeatsFromBlob`、`energyEnvelope` | 能量包络 → 一阶差分 → 自相关 → 60–180 BPM。合成鼓点实测 90/120/150 全还原 |
| `packages/video-editor/src/panels/timeline/snapping.ts` | `collectSnapReferencePoints`、`resolveSnapping`、`mergeExternalSnapPoints` | 像素阈值换微秒；`mergeExternalSnapPoints` 把宿主算出的拍点并进参考点并抽稀 |

**关键构建约束**：`vite.config.ts` 里必须有 `worker: { format: 'es' }`。IP 的离线编码 worker 是 `type:'module'`，
而它经 `shot-backdrop` 间接引入的镜头注册表含动态 `import()`；默认 iife 格式不支持代码拆分，构建会直接失败。

---

## 6. 传输层 · `src/api/`（**不要自己 fetch**）

| 模块 | 关键导出 | 用途 |
| --- | --- | --- |
| `chat.ts` | `chatCompletions(params)`、`ChatContentPart`、`messageHasImages`、`webSearchToolDefinition(desc)` | 经后端代理的 chat 补全（支持 `content` 多模态数组）；带图时自动选 `resolveVisionChatModel()` |
| `src/api/models.ts` | `resolveVisionChatModel()` | 从 `GET /api/v1/models` 解析 `image_input` 模型 |
| `tools.ts` | `webSearch(...)`、`WebSearchResult` | 联网检索 |
| `tts.ts` | `createSpeech(params)` | 语音合成 |
| `src/api/voice-clone.ts` | `listVoices` / `createVoice` / `refreshVoice` / `deleteVoice` | 声音克隆 |
| `src/api/media.ts` | `resolveMediaUrl(path)` | 媒体地址解析 |
| `client.ts` | `api` / `v1Api`（axios 实例）、`ensureAccessToken`、`getAccessToken`、`setTokens`、`clearTokens`、`apiErrorMessage`、`apiRetryAfterSeconds` | 鉴权与通用请求 |
| `src/api/errors.ts` | `ApiError`、`parseApiError`、`throwApiError` | 错误归类 |
| `workbench-ai.ts` | `isWorkbenchAiDemoMode()`、`defaultChatModel()`、`defaultReasoningEffort()`、`TTS_MODEL`、`PLATFORM_VOICES` | 模式判定与常量 |

⚠️ 传输层失败往上抛时，**不要**把错误包成裸 `new Error(msg)`：状态码会丢，重试层就分不清 5xx/4xx。用 `preserveAgentError()`（§2.14(2)）。`chatCompletions` 的响应必须带真实 `finish_reason`，否则截断对内核不可见。

**红线**：浏览器不得保存平台模型 API 密钥；不得直连生产供应商；不得未经确认另起服务或数据库。新增接口先在 `src/api/` 加**薄封装**。

---

## 7. 其他可复用服务

| 领域 | 位置 | 关键导出 |
| --- | --- | --- |
| 人设 | `src/services/persona/` | `readPersona()`（风格正文）、`readPersonaContext()`（身份背景，见 §2.14(9)）、`listPersonas`、`getActivePersona`、`savePersona`、`setActivePersona`、`createPersona`、`setPersonaRepository`（测试注入用） |
| 素材库 | `src/services/materials/material-repository.ts` | `MaterialRepository`、`materialRepository` |
| 社交发布 | `src/services/social-publish/` | `compose`、`build-sync-draft`、`markdown-to-html`、`image-blob`、`publish-settings` |
| 微信排版预览 | `src/services/social-publish/layout/wechat-markdown-preview.ts` | `WECHAT_THEMES`、`buildWechatStyles`、`parseMarkdownToHtml`、`applyWechatInlineStyles` |
| 社交图文工作室壳 | `src/features/social-studio/SocialStudioShell.tsx` | 左预览 / 中编辑 / 右准备三栏布局 |
| 图文/文章 WYSIWYG 舞台 | `src/features/social-studio/SocialStudioMergedStage.tsx`、`src/features/social-studio/editor/*` | 预览皮内 TipTap 编辑 + 图文图廊（FlowX preview 模式迁入） |
| 公众号工作室预览 | `src/features/social-studio/WechatStudioPreview.tsx` | `buildStudioMarkdown`、网页/微信/贴图预览组合 |
| 小红书工作室预览 | `src/features/social-studio/XhsStudioPreview.tsx` | 笔记与长文手机壳预览 |
| 工作室只读预览画布 | `src/features/social-studio/preview/SocialStudioArticlePreviewCanvas.tsx` | 预览视图下 HTML/壳层只读渲染，流式 `content` 直驱 |
| 预览/编辑舞台分流 | `src/features/social-studio/preview/SocialStudioStageBody.tsx` | `stageView === 'preview'` → 画布；`edit` → `SocialStudioMergedStage` |
| 预览聚合菜单 | `src/features/social-studio/preview/SocialStudioPreviewMenu.tsx` | `@no996/ui/glass-menu`：公众号排版/设备/主题；小红书设备 |
| 可拖拽手机壳 | `src/features/social-studio/preview/ResizablePhoneFrame.tsx`、`preview-phone-size.ts` | `--social-phone-width/height` + sessionStorage 尺寸偏好 |
| 预览偏好 Hook | `src/features/social-studio/preview/useSocialStudioPreviewPrefs.ts` | `layoutView` / `device` / `phoneSize` 状态 |
| 长文正文图片编辑 | `src/features/social-studio/editor/ArticlePreviewPanel.tsx`、`ImageCropModal.tsx` | 粘贴/拖拽插图；点击浮层裁剪/替换（对齐 FlowX 文章模式） |
| 社交工作室 IDB 草稿 | `src/services/social-studio/draft-idb-repository.ts`、`useSocialStudioDraftPersist.ts` | 公众号/小红书页防抖写入 IndexedDB，刷新恢复；含可选 `rewriteSettings` |
| 长文二次改写 | `src/features/social-studio/rewrite/`（`SocialStudioRewriteWizard`、`run-social-rewrite-flow.ts`、`build-social-rewrite-prompt.ts`、`apply-rewrite-result.ts`） | 左侧有正文走 `social-rewrite` 双遍 flow；双栏对比后「采用」落稿；要求历史 `rewrite-requirement-history.ts` |
| 小红书发布摘要兜底 | `src/services/social-publish/resolve-xhs-summary.ts` | brief 摘要优先，否则从正文截取 |
| 长文封面 vs 内嵌 | `build-sync-draft.ts` | 公众号与小红书长文均以正文内嵌图为准；笔记模式仍用 `imageUrls` 图廊 |
| 快捷导入素材 | `src/features/social-studio/wizard/steps/StepSearchCollect.tsx` | 链接解析 / 关键词抓取、sessionStorage 单次会话 |
| 抓取会话存储 | `src/features/social-studio/material-import/material-capture-session-store.ts` | `no996-material-capture-session`，新抓取整包替换 |
| 采集写入舞台 | `src/features/social-studio/wizard/SocialStudioWizard.tsx` 的 `onCollected` | 选中参考作品、回填标题与开头 Hook，按需跳模板步骤 |
| 社交创作右栏（写什么/怎么写） | `src/features/social-studio/creative/SocialStudioCreativePanel.tsx` | 小红书与公众号共用 brief 表单 + 生成区 |
| 社交工作室配图 | `src/services/social-studio/generate-social-images.ts` | `buildSocialImagePrompts` / `generateSocialImages` 经后端生图；`prepareSocialImageReference` / `prepareSocialImageAttachments` 供参考母本视觉分析与图生图；`generateSocialImageCards` 按逐张计划生成并由 `composeSocialImageCard` 本机排版准确文字 |
| 社交创作流式生成 Hook | `src/features/social-studio/useSocialStudioGenerate.ts` | `social-compose` flow + 页内 onDelta 写入舞台；使用统一配图服务 |
| 社媒向导 AI 大纲 | `src/features/social-studio/agent/run-social-wizard-outline-flow.ts`、`wizard-outline-stages.ts`、`wizard-outline-parse.ts` | `runSocialWizardOutlineFlow` 读取母本正文与最多 4 张母本图进行视觉策划；按封面模板校验统一风格、封面/章节逐张图片计划和准确上图文案 |
| 社媒切入点策划 | `src/features/social-studio/agent/run-social-topic-angles-flow.ts` | `runSocialTopicAnglesFlow` 被高级创作面板与公众号/小红书共用向导复用 |
| 微信公众号链接解析 | `src/services/wechat-article/resolve-wechat-article-url.ts` | `resolveWechatArticleByUrl` 通过后端 `web_fetch` 抓取公众号文章正文 |
| 社交创作 Prompt 构建 | `src/features/social-studio/creative/build-social-studio-prompt.ts` | brief + 参考素材 → system/user 文本 |
| 扩展桥接 1.1 | `src/services/extension/workbench-bridge-contract.ts`、`extension-client.ts` | `collection.search`、`asset.fetch` |
| 浏览器能力 | `src/services/browser.ts` | 复制 / 下载 |
| 本地资产 | `src/services/local-assets.ts` | 本机素材读写 |

---

## 8. 机制与规范（写在代码之外的约定）

- **审核与诚实标注**：`runHardCheck` 判合规；`kind` 驱动 UI 标签，**纯算法步骤不得标成 AI**；演示内容必须标注「演示」；预测值（评分/点击率）**不得**由随机或占位数派生。
- **收敛**：轮次上限 ≤ 3；留存曲线单调不增且起点 100。
- **无中间截断**：不要在解析阶段按上限截断文本冒充合格产物；超限交硬校验判为需改项，由改写步骤定向收敛。
- **成本预算**：脚本 ≤ 9 次模型调用；标题 ≤ 7 次。
- **过程面板边界**：只展示「进行到哪一步」+ 流式正文；**提示词不展示**；**工具轨迹不外显**；**不得**出现跨页面的通用过程侧栏。
- **导航唯一来源**：`src/app/navigation.ts`。

---

## 9. 怎么保证这份清单没写错

「文档说有、代码里没有」比没文档更糟。所以本文件里的路径与标识名是**机械核对**过的，不是凭记忆写的：

```bash
npm run test:docs      # → 结论：文档与源码一致（exit 0）
```

`scripts/check-reusable-doc.mjs` 会做三件事：

1. **路径核对** —— 文档里出现的每个路径都要真实存在。省略目录的裸文件名（如 `prompt.ts`）按全仓唯名解析，**若有多个同名文件则报歧义并要求写成全路径**（这能防止读者不知道该看哪一个）。
2. **标识名核对** —— 文档里声称的每个函数/常量/类型/类方法/类型成员，都要能在源码声明里找到。
3. **抓不住错就等于没核对** —— 脚本做过负面测试：故意塞入不存在的导出名与路径（如 `src/agent/nope.ts`、`totallyFakeExportName`），确认都被报出且 exit=1。<!-- doc-check:ignore 本行是反例说明，不是真实声明 -->

视频编辑器与预制组件组装的现状（已实现边界、未接通项、验证命令）见 `docs/video-assembly.md`，外部来源与许可集中登记于根 `MIGRATION_PROVENANCE.md`。

> 注：文档里若要举例说明「哪些路径是错的」，**必须在该行写成 doc-check:ignore 的 HTML 注释**（一行一个），否则核对器会把反例当成真实声明（本文件就踩过这一次）。跳过行数会在核对输出里打印出来，便于发现误跳。

所以**改了内核、组件或服务层之后，顺手跑一次 `npm run test:docs`**，比人工比对可靠。

### 9.1 稳定性改动的回归覆盖（2026-10-12 真机缺陷后新增）

`docs` 核对只保证「名字存在」，**不核对行为**。所以 §2.14 的每条设计都另有断言兜着 —— 全是无需联网的纯函数/接线检查：

```bash
npm run test:agent   # 84 项
npm run test:flows   # 122 项
```
| 设计点 | 断言位置 |
| --- | --- |
| 预算随模式变化、`flowMs > stepMs`、远端预填余量覆盖实测 | `src/agent/budgets.test.mjs` |
| `isRetryableError` / `httpStatusOf` / `withRetry` 的 `shouldRetry`+`onRetry` / 取消不重试 / 重试耗尽 | `src/agent/runtime.test.mjs` |
| `retryMaxTokens` 逐次翻倍且被上限压住 | `src/agent/budgets.test.mjs` |
| 定位卡片摘要与背景组装（空字段跳过、企业/个人不串、空档返回空串） | `src/services/persona/background.test.mjs` |
| 两路注入取自同一档、空档两路皆空、换档不串味、菜单提示只取两字段 | `src/services/persona/background.test.mjs` |
| 背景插成独立 system 消息、语义不与提示词变量互串、空值不注入 | `scripts/agent-flow-check/entry.ts`（直接测 `withBackground`） |
| 每一步都带背景、无一步遗漏；关掉后人设两路都不注入 | `scripts/agent-flow-check/entry.ts` |
| 评审走 `json_object` 且 token 上限取自预算表 | `scripts/agent-flow-check/entry.ts` |
| 预填失败 → `fromFallback` 且整轮如实标降级 | `scripts/agent-flow-check/entry.ts` |
| `skip()` 清掉上一轮计时/提示词/流式内容，轮次标在发生的那一轮 | `scripts/agent-flow-check/entry.ts`（直接构造 runner） |
| `finish()` 把残余 `idle` 补成 `skipped`（含失败收尾），已跑过的步骤不被误改 | `scripts/agent-flow-check/entry.ts`（直接构造 runner） |
| `finish()` 只动 `idle`：真的失败的步骤保持 `failed`（不被洗成「跳过」），错误信息不被清掉 | `scripts/agent-flow-check/entry.ts`（直接构造 runner） |
| 取消路径：以 `AbortError` 抛出、无步骤停在 `running`、被取消的那步记 `skipped` 而非 `failed` | `scripts/agent-flow-check/entry.ts`（直接构造 runner） |
| 步骤进度条：进度只报实测位置（无完成步骤 / 全部完成都不报）、缺计时不编假耗时、`headline` 只在 `running` 展示、五种状态文案固定 | `packages/ui/src/stage-progress-model.test.mjs`（纯函数直测） |
| 「了解生产流程」：`algo` / `tool` 不算 AI 专家、未知 kind 不归类、没有模型步骤时不吹「N 位专家」、主打文案不带调用次数/轮次上限、两种语言文案都不是占位符 | `packages/ui/src/flow-explain-model.test.mjs`（纯函数直测） |
| 真实流程数据也守同一条诚实话术：每个阶段 kind 合法、非模型阶段的标签不含「AI」、专家/检索/本机三类合计等于阶段数、主打文案与阶段说明无技术腔 | `scripts/agent-flow-check/entry.ts`（遍历 `listFlows()`） |

> 为什么 `withBackground` / `skip()` / `finish()` 要**直接测函数或直接构造 runner**而不是测流程：`withBackground` 只在**远端**客户端里被调用（演示客户端不走它），`skip()`、`finish()` 的兜底在演示流程里未必触发。若只在流程断言里间接搜，演示模式下就是**空转**（永远为真）—— 这类假通过比没有断言更危险。
>
> 断言写完后做过**反向验证**：把 `skip()` 改回「只改 status」的旧实现，`skip()` 那行有 **5 条**断言立刻失败（`startedAt` / `finishedAt` / `actualPrompt` / `streamingContent` / `round`）；把 `finish()` 改回「只改 status」，`finish()` 两行合计 **3 条**失败。一条「在错误实现下也照样 PASS」的断言是假保险，发现后当场删掉了 1 条（它只在慢速真机下才有意义，纯单测里恒真）。

> 进度条那 11 项也照做了三组反向验证：① 把 `stageStepText` 改回「无条件展示 `headline`」→ 1 条失败；② 去掉 `stageDurationText` 的计时存在性判断（等价于旧的 `Math.max(1, …)`）→ 2 条失败；③ 去掉 `stageProgressText` 的「无完成步骤返回 `undefined`」→ 2 条失败。

> **一条最重要的不变量**：整轮结束时，快照里**不允许**出现 `running` 或 `idle`。「进行中」意味着还有人在跑（其实没有），「待执行」意味着还在排队（其实已经结束了）—— 两者都是把「已经结束」说成「还在进行」。`finish()` 管 `idle`，`guard()` 的取消分支管 `running`，两条断言一起兜住。

> 已知的诚实边界：
> - 覆盖范围是**「下一个功能大概率要复用」**的东西，不等于项目全部代码。
> - 页面私有的组件（`VideoResult` / `LiveResult` / `TitleResultList` / `TitleEvolutionChart` / `Teleprompter`）刻意**没有**收进来 —— 它们只是某个功能的呈现细节，复制它们通常不如复用 §2 的内核自己写。
> - 脚本核对的是「名字存在」，**不核对语义是否正确**。「这个函数确实存在，但文档描述它的用途说错了」这类问题它抓不到，仍需人工判断。
> - 上面这些断言**不连真实模型**：它们证明「接线正确、策略完备」，**不证明**「真机一定成功」。真机仍可能因为模型/上游波动而失败，此时应当**如实失败**（§2.14(6)），这正是设计目标。真机复测的记录见 §9.2。

### 9.2 真机复测记录（2026-10-12）

用 CDP 驱动真实 Chrome + **真实后端**（`VITE_API_PROXY_TARGET` 指本地 Go 服务）跑三页完整生成，逐条判定而非只看摘要。最近一轮 **82 项全过**：

| 页面 | 模型调用 | 检索 | 阶段终态 |
| --- | --- | --- | --- |
| 爆款标题 | 5 | 1 | 8 步全 `done`（编辑真的跑了） |
| 视频脚本 | 7~9 | 0 | 编辑 `skipped`，其余 `done` |
| 直播脚本 | 7~9 | 0 | 编辑 `skipped`，其余 `done` |

每轮都核对：HTTP 全 200、`usedMock === false`、每次调用都带 `reasoning_effort=low`、**每一步都注入背景**、整轮 `fallback === false`、无步骤失败、无步骤残留 `idle`、界面不泄露提示词与裸 JSON。

> 这一轮真机复测抓到 3 个单测抓不到的问题（都在**呈现层**，静态断言看不见）：① `skip()` 残留上一轮的计时与提示词（见 §2.7）；② `titles-flow` 提前收敛时「编辑」永远停在 `idle`（见 `finish()`）；③ `AgentStageDetail` 压根不显示状态，被跳过的步骤和跑过的长得一样（见 §3.3）。三个都改成了**结构性**的修法（内核兜底 / 共用一份状态文案），而不是在调用点逐个打补丁。

## 10. 产品定位与分析（2026-10-27；2026-10-28 顶栏切换 + 字段 AI）

页面与设计说明见 `docs/product-positioning.md`。**本页不再用左侧记录轨**：产品切换在 Page `top-chrome`；`actions` 顺序为自动保存（有状态才显示）→ 人设 → `+` 新建（仅图标）→ **生成定位分析（最右）**。表单渐进披露；字段壳 + `AIEditPopover` 对齐人设问卷。管理型「左轨 + 右内容」不是本页强制版式。

可直接复用的部分：

| 能力 | 入口 |
| --- | --- |
| 顶栏产品切换（条件搜索 ≥8 条、状态徽标、新建/删除） | `src/features/product-position/views/ProductSwitcher.tsx` |
| 字段输入壳 + AI 优化 / 类型预设 | `src/features/product-position/views/ProductAssistField.tsx` |
| 字段润色（演示样例 + 正式走 `polishProfileDocField`） | `src/features/product-position/agent/form-assist.ts` |
| 模板驱动的 Markdown 报告解析（六章 / 固定栏目 / 动态表格 / 引用原话 / 未识别内容保留） | `src/features/product-position/lib/report-parser.ts`、结构清单 `src/features/product-position/lib/report-template.ts` |
| 报告的章节与表达读取（一句话定位、卖点、介绍、购买理由、营销表达抽取） | `src/features/product-position/lib/report-view.ts` |
| 资料充分性预检（无字数阈值、缺失可定位） | `src/features/product-position/lib/adequacy.ts` |
| 报告呈现原子件（编号标题、字段表、引用、横滚表格、可展开条目、复制按钮） | `src/features/product-position/views/blocks/ReportBlocks.tsx` |
| 本机产品与报告仓储（含 ownerSub 隔离、失败不覆盖有效报告） | `src/services/product-position/store.ts` |
| 方法论 + 正式模板常量（改模板必须同步解析器） | `src/prompts/product-positioning.ts` |
| 后台任务 kind `product_positioning` 与执行器 | `src/services/workbench-tasks/executors/product-positioning.ts` |

测试：`report-parser.test.mjs` / `adequacy.test.mjs` 挂 `npm run test:agent`；`product-position` 的注册与演示端到端断言在 `scripts/agent-flow-check/entry.ts`（`npm run test:flows`）。
