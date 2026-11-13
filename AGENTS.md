# 网页项目 AI 开发约束

开工必读：`README.md`、`API_CONTRACTS.md`（接口与接入态）、`DEPLOYMENT.md`。代码查询与分析优先用 CodeGraph（`codegraph query/explore/node/callers`）。复用资产查 `docs/reusable-assets.md`（新增顺手补入，`npm run test:docs` 校验）。外部来源见 `MIGRATION_PROVENANCE.md`。

## 1. 产品与系统边界
- **独立运行**：纯前端项目，可在无桌面/其他源码环境独立构建。严禁跨仓绝对路径/junction/Electron/DSH 依赖。
- **页面范围**：仅开发首页与导航所列功能页。严禁聊天输入框、会话列表、续聊及全局任务过程侧栏。
- **Agent 边界**：业务流程在 `src/features/agent-flows.ts` 统一注册；Agent loop 在浏览器，凭证绝不入浏览器。不改后端仓，接口契约见 `API_CONTRACTS.md`。
- **IP 视频组件组装例外**：仅规格明确要求时，Agent 输出结构化组装计划；仅能选择静态登记组件/布局/动效，严禁生成/下发任意代码、TSX、HTML、CSS 或任意 URL；经本机可信编译入公共视频工程；详见 `docs/video-assembly.md`。
- **查看创作过程边界**：业务页内默认折叠面板；**绝不渲染/复制提示词**（`actualPrompt` 仅留存快照本机排障）；JSON 流式正文必须经 `src/agent/stream-filter.ts` 的 `createDisplayDelta` 过滤；工具信息仅展示摘要；仅在页面订阅时请求上游流式，思考内容依遮挡交互展示。
- **知源插件素材导入**：经既有扩展桥接显式导入本机 IndexedDB（`ExtensionMaterialImport.tsx` + `workbench-bridge-contract.ts`）；插件素材库由扩展共享不跨账号隔离；桥接不传凭证；发布须保留线上插件下载包并核对校验值。
- **演示与凭证边界**：本地模拟必须标注「演示」；禁止冒充真实模型、扣款或云端存储；人设本机存 IndexedDB；未提供插件/语音保持待接入；正式 API 失败显示真实错误。

## 2. Agent 内核与生成规范（`src/agent/`）
- **分层**：业务页 → 业务 flow（`features/<name>/agent/`）→ 内核（`src/agent/`）→ 传输层（`src/api/`）。内核不引 `features`，flow 不引 `workbench-tasks`（落库走 `AgentSink`）。
- **流程定义**：`defineFlow(id, stages)`，并在 `src/features/agent-flows.ts` 汇总注册。`kind: 'model'|'algo'|'tool'` 真实标注，算法步骤不记提示词。
- **执行与输出**：统一用 `StageRunner`；流式输出经 `createDisplayDelta` 过滤；模板 `renderTemplate` 用 `«变量»`（缺失填 empty）；大图侧栏文案走 `src/agent/stage-output-preview.ts`。
- **人设注入与预填**：消费页统一用 `usePersonaInjection()` + 右上角 `PersonaBinding`（挂在 `Page` 的 `actions`，禁在正文造关联卡片）；关闭时传 `undefined` 且 flow 绝不注入；表单预填走 `derive*PrefillPatch` + `usePersonaFormPrefill`，**只填空**不覆盖用户改动；人设仅进提示词，不进流式展示。
- **合规校验与收敛**：`runHardCheck` 为唯一合规入口（分段字数容差 1.3，硬上限传 1，`segmentId` 用序号）；禁止中间截断伪造合格产物；收敛上限 ≤ 3 轮；留存曲线单调不增且始于 100；预测值不得随机派生。
- **演示 Mock**：`createMockAgentClients({ mockResponder })`，应答器由调用方显式传业务上下文，禁正则抠提示词。

## 3. 页面骨架与控件规范
- **导航与路由**：唯一源 `src/app/navigation.ts`；旧地址走 `legacyRoutes`。
- **Page 骨架（`chrome="workbench-tool"`）**：
  - `title`：功能名（导航同名，2-4 字）。
  - `titleExtra`：流程说明/视图切换（`AgentFlowExplain`, `WorkbenchPageViewTabs`）。
  - `actions`：必须包 `WorkbenchPageChromeActions`，放 `PersonaBinding`、主操作、次要工具。
  - `headerTrailing`：全局工具（直接传节点，不包 actions）。
- **顶栏贴齐铁律**：必须在 `src/app/workbench-surface.ts` 的 `WORKBENCH_SURFACE_BY_SEGMENT` 登记路由段，至少含 `workbench-page--fluid workbench-tool-page`。严禁在 CSS 里加 padding 补丁。
- **控件归属**：人设→右上角 `PersonaBinding`；附件→`AttachmentUploader`；Tab/Table/表单项→`@no996/ui`（Select 须 value/label 映射，Tooltip 用公共组件）；结构化产物解析为模型渲染，禁直接丢 Markdown。
- **长页面向导与调试**：长产物向导支持整块折叠收起；调试用例与一键填入必须用 `import.meta.env.DEV` 包裹，生产构建物理剔除。
- **后台任务（`src/services/workbench-tasks`）**：IndexedDB 存储；`WorkbenchTaskKind` 登记 → `executors/` 实现 → `enqueue*` 入队；产物存 `payload`，`meta` 纯字符串；全局串行 Runner，登出暂停；演示模式不入队。

## 4. 新增左侧功能最小清单
1. `src/app/navigation.ts` 加导航；`App.tsx` 加路由；`locales/*/workbench.json` 加文案。
2. `src/app/workbench-surface.ts` 登记路由段（`workbench-page--fluid workbench-tool-page`）。
3. 页面：`src/features/<name>/<Name>Page.tsx`，用 `Page` 套骨架。
4. 数据服务：`src/services/<name>/`（IndexedDB + `ownerSub` 隔离）。
5. 生成流程：`features/<name>/agent/*-flow.ts` 并在 `src/features/agent-flows.ts` 注册；提示词放 `src/prompts/`。
6. 后台任务：`WorkbenchTaskKind` 登记并实现执行器。
7. 质量：补 `*.test.mjs`，`test:docs` 校验，可复用件记入 `docs/reusable-assets.md`。

## 5. UI、质量、交付与部署
- **UI 质感**：延用 CSS 令牌；输入框/文本域聚焦**不出现** outline/ring/边框变色，以光标指示；保留中性 `:focus-visible` 与错误态辨识。
- **验证梯度**：默认免测（文档/文案/样式/局部页面小改直接交付）；仅在改动涉及构建/公共契约/流程算法或用户要求时跑 `npm run test:agent` / `test:voice-tts` / `test:docs` / `typecheck` / `build`。收尾如实汇报。
- **交付与部署**：默认**只改本地工作区**，不自动 commit/push；默认**只部署测试环境**；生产环境部署须用户明确授权，主机与凭据只存本地 `DEPLOYMENT.md`（严禁入库），发布前先备份数据库与程序，核对迁移，严禁测试数据覆盖生产。
