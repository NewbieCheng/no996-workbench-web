# 视频编辑器与预制组件组装（现状）

> 视频编辑器与预制组件组装的现状入口。历史规划文档（`视频编辑器计划书.md`、`视频编辑器升级/`、`AI视频组装升级/`、`参考项目/`）已于 2026-10-19 删除；事实以本文件与源码为准。外部来源与许可见根 `MIGRATION_PROVENANCE.md`。
>
> IP 口播专用维护说明见 [架构调用图、设计思路与提示词维护指南](ip-talk-architecture.md)，包含业务调用链与后续调整入口。

## 1. 代码位置

| 位置 | 内容 |
|---|---|
| `packages/video-editor/` | 公共包 `@no996/video-editor`（工程、命令、媒体、渲染、面板） |
| `packages/video-editor/src/core/assembly/` | 预制组件目录、组装计划、原子应用、模板复用 |
| `src/features/ip-video/` | IP 口播宿主：独立作品库、口播工作区、字幕外观与后台导出 |
| `packages/video-editor/README.md` | 公共包的 API 与面板清单 |

`vite.config.ts` 与 `tsconfig.app.json` 把 `@no996/video-editor` 别名指向本地 `packages/video-editor/src`；包不依赖任何业务代码或后端。

## 2. 已实现

**公共编辑器内核**（`packages/video-editor/src/`）

- `core/`：`EditorDocument`（`schemaVersion: 1`）、整数微秒时间、原子命令与撤销重做、IndexedDB 仓储（`[scope, id]` 隔离）、工程备份容器、关键帧、变速/反放/冻结、转场、滤镜、多轨混音（软限幅）。
- `media/`：Mediabunny 适配器（`mediabunny@1.61.6`）、资源池、元数据探测。
- `render/`：统一 `RenderPlan` + Canvas2D 离屏合成，预览与导出共用同一求值。
- `panels/`：11 类面板（时间轴、属性、字幕、文字、模板、素材、转场、效果、关键帧、混音、导出）与播放器。
- `presets/`：4 套确定性场景预设；`examples/` 为 full / IP / minimal 三种宿主装配示例。

**预制组件组装**（`core/assembly/`）

- `packages/video-editor/src/core/assembly/catalog.ts`：32 个内容组件（标题 6、字幕 5、媒体 5、信息 6、图表 6、背景 4）、18 个动效、8 个布局、6 套风格、4 条配方，均为静态登记，无动态渲染器路径。
- `packages/video-editor/src/core/assembly/plan.ts`：`VideoAssemblyPlan` v1 严格校验——JSON ≤ 65536 字节、场景 ≤ 40、组件总数 ≤ 100、单场景 ≤ 20、单场景时长 ≤ 300 秒、文本 ≤ 500 码点、步骤 ≤ 6 项；拒绝未知字段、未知 ID、非法时间与非法组合。
- `packages/video-editor/src/core/assembly/apply.ts`：`prepareVideoAssemblyPlan` 生成不可伪造的准备对象，`applyVideoAssemblyPlan` 以**一条**编辑器命令提交，可撤销；stale revision 与命令策略会拒绝且不改原工程。
- `packages/video-editor/src/core/assembly/model.ts` 与 `packages/video-editor/src/core/assembly/template.ts`：`ComponentInstance`、`SceneMetadata`、`VideoTemplateEnvelope`，以及 `exportDocumentAsTemplate` / `instantiateTemplate`（另存模板、按槽位复用到新工程，默认剥离账号与私有素材）。

**宿主接入**（`src/features/ip-video/`）

- `composition/TalkWorkspace.tsx` 是唯一的口播入口。通过 `TalkProjectToolbar` 将作品切换、保存与导出投射到 `IPVideoPage` 的显式页头挂载点，保留同一个编辑器 Context 与命令历史；正文不重复工具栏。主路径只有 `talk-pipeline.ts` 定义的六步：内容 / 画面 / 配音 / 生成 / 微调 / 封面与合成；底部引导、右侧入口面板和「高级编辑」开关已移除，偏好统一进入 `pipeline/TalkAdvancedSettingsDialog.tsx`。
- 第 5 步使用「对象栏 + 画布 + 属性检查器」：对象栏定位字幕、人物 / 素材和镜头，画布点击同步选中，检查器复用 `TalkCaptionPanel` / `TalkMediaPanel` / `TalkShotPanel`。主预览与编辑列、画布与检查器均通过公共 `ColumnDivider` 调宽，不另写拖拽逻辑。
- 第 6 步的封面是独立 `createTalkCoverProject()` 1080×1080 PNG，不再把 9:16 画布合成片头静帧；视频画幅只保留 9:16 / 16:9 / 1:1，旧工程仍可读取 3:4。
- `composition/templates/` 提供本机风格模板模型、独立 IndexedDB 仓储、推荐 / 全部 / 我的模板库与命名保存。存实际字幕样式与背景、可选画幅和静态主人物归一化构图；不保存正文、声音、素材与任务。应用经字体就绪与工程版本检查后以单条 `editTalk` 命令提交，保护确认、账号隔离与错误提示均在本机完成；多构图和动画不被猜测成静态模板。
- `agent/video-assembly-flow.ts` 的 `runTalkCreationFlow` 已从单纯阶段注册接为执行流程，复用 `StageRunner`、代理客户端与统一硬规则检查，按方向 / 制作 / 局部调整运行必要分支。AI 只返回 `TalkDirectorPlan`，不下发代码或动态素材地址。
- `agent/schema.ts` 严格验证计划字段、静态预设、镜头及句序号；`composition/talk-director-compiler.ts` 的 `compileTalkDirectorPlan` 在副本上确定字幕与镜头时序，复用现有编辑命令，宿主以一条可撤销命令提交。公共 v1 组装计划仍保留其原有受限契约；口播导演的组合数据不是把公共目录中的未实现能力全部开放。
- `ip_video_create` 进入全站本机队列，保存输入、运行快照和最终方案；`use-talk-creation.ts` 在返回页面时比较工程可编辑字段，冲突保留当前作品，可另存方案副本。已应用收据避免刷新后重复插入；中断且未保存完整结果时不自动重跑收费模型调用。
- 配音复用 `ip_video_audio`，在检查文稿与音色并确认后单独入队；绑定后使用真实音频时长重排估时字幕和 AI 镜头。人物原声、人工校时字幕和用户保护的分组不会因自动制作被擅自覆盖。
- 口播工程和素材仍位于 `no996-ip-video-editor-v1`；工厂使用 `no996-video-editor-v1`，内部按账号 `scope` 隔离。导出按 `source` 选库，不跨库兜底读取，不删除或搬迁工厂作品。
- 12 套字幕组合和 10 款本地字体按需使用；风格示意与实际舞台共用 Canvas 字幕渲染。`presentation: content` 仅选择 6 个去演示化内容镜头，另外 145 个原演示不进入 AI 可用目录；镜头面板默认只展示这 6 个，完整目录只在开发环境可切换。具体兼容判定见 `docs/ip-talk-shot-compatibility.md`。

## 3. 预览、导出与未开放范围

- `TalkStage` 开启公共 `PlayerSurface.layeredShots`，按 RenderPlan 将连续 Canvas 图层与实时镜头交错，字幕置顶、背景置底。实时层与导出均按内容版标识选择静态加载器，不退回原始演示。
- 镜头缓存身份包含内容版、实例、参数、画布、帧率和源帧长；导出使用全分辨率帧。DOM 出帧嵌入实际字体 CSS，失败或超时明确报错，不静默换字体。
- **6 个内容版本是已落盘并接线的候选，不是运行验收结论。**本轮没有运行测试、构建、浏览器、CDP 或真实模型调用；不能据此宣称整片播放、音画同步、字体和下载文件均已通过。
- 没有语音识别/逐字对齐、人物抠像或从照片生成人物说话的能力。只有视频而无稿/SRT 时保留原声与画面，字幕需要补充文字。
- 公共组装目录 32 组件 / 18 动效 / 8 布局 / 6 风格 / 4 配方不等于全部实际可编译。当前公共 v1 只有 5 个语义组件分支和 2 个动效处理，口播只开放本轮明确实现的组合；不将普通文字降级描述为真实图表。
- 模板复用的公共 `core/assembly/template.ts` 仍是有限的文本提取/填充，不承担口播模板。V2 的 `composition/templates/` 只提供本机风格模板，不提供可替换文稿/音轨/镜头结构的完整工程模板或模板市场。图表 D3 和 Lottie 没有接入；音效149项/BGM5项缺少逐件权利证据，本轮不开放。

## 4. 验证

本轮已运行 `npm run typecheck` 与 `npm run build`，均通过；未调用真实模型、未做浏览器逐项播放验收。`talk-pipeline.test.mjs`、`talk-cover.test.mjs`、`talk-import.test.mjs` 和扩展后的 `template-renderer.test.mjs` 覆盖六步门禁、1:1 封面设计坐标、SRT 空工程导入和方图绘制，已加入 `npm run test:ip-video`。`templates/model.test.mjs` 仍覆盖字段白名单、真实样式保存、账号隔离、保护确认、内容/时序/关键帧保留、重复主轨/重叠素材/多构图拒绝及陈旧工程拒绝。`npm run test:ip-video` 已通过（57 项）；旧 `video-renderer` 的镜头背景改为按需动态加载后，不再让纯函数测试拉起 TSX 运行时。页头 Portal、拖拽调宽、封面生成 / 下载、模板保存后重开与账号切换仍需页面验收。

```powershell
npm run test:video-assembly   # 组件目录、计划校验、原子应用、模板复用
npm run test:ip-video         # IP 模板、时间轴、渲染器、编码策略
npm run test:docs             # 本文件与 reusable-assets 的路径/标识核对
```

浏览器精准回归：在本机 Vite 页面中导入 `packages/video-editor/tests/indexeddb-workspace.browser.mjs` 并调用 `verifyWorkspaceIsolation()`。它使用随机账号作用域验证同 ID 工程/素材的列表、双向编辑/删除、默认工厂库兼容和账号隔离，结束后清理本次测试数据，不调用模型或厂商接口。

人工验收（由用户执行）：

1. 一句想法：生成方向建议，使用推荐方向制作；只问必要背景，不出现多步表单。
2. 完整文稿：保留原文，AI 自动安排字幕与重点镜头；补充效果要求被遵守。
3. 已有原声：不自动配音；缺稿/SRT 时明确提示补充，不伪造转写。照片预览不声称数字人说话。
4. 配音确认：先检查最终文稿与真实音色；确认后仅提交一次；取消、失败和重读已完成音频不冒充新成功。
5. 局部调整：字幕、镜头和构图仅修改允许范围；手工校时、SRT 和保护分组保留。打开高级设置、切换步骤和拖拽列宽不丢工程及撤销历史。
6. 后台恢复：离页返回、刷新、历史打开与账号切换不串作品；生成期间原作品变更时保留现状；另存方案副本不覆盖原作；已应用任务不重复插入。
7. 30 / 90 / 300 秒样本与 9:16 / 16:9 / 1:1 画幅，检查长短中英文字幕、12 套组合、10 款字体、人物+字幕+6 个内容镜头层序、音画同步、导出文件实际播放，以及缺资源/取消/失败。
8. 第 6 步单独生成 1:1 封面：标题和照片变化后预览立即更新，导出 PNG 为 1080×1080，不因视频画幅被拉伸；AI 图片生成只通过已接入的图像接口，失败显示真实错误。上述运行项仍待验收。
