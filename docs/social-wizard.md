# 小红书 / 公众号图文生产（爆款复刻 + 灵感创作）

## 1. 统一入口

爆款复刻向导和灵感创作高级工作台都走同一条后台任务 `social_compose`：

- 爆款复刻：第 6 步点“确认大纲并启动生成”后入队。
- 灵感创作：点“AI 生成 / 重新生成”入队；“只生成配图”也入队，`action='images_only'`。
- 演示模式不入队，仍走页内 mock 流程。

任务页路由按平台落到 `/workbench/xiaohongshu` 或 `/workbench/wechat-article`，`meta.targetType` 供页面历史筛选。

## 2. 流程阶段

`src/features/social-studio/agent/social-compose-production-flow.ts` 使用 `StageRunner`：

| id | kind | 作用 |
| --- | --- | --- |
| `resolve-source` | algo | 校验素材类型、解析参考内容与参考图 |
| `compose-body` | model | 流式生成正文 |
| `plan-images` | algo | 生成逐张图片规划/提示词 |
| `generate-images` | tool | 调用生图服务，逐张回调 |
| `compose-cards` | algo | 叠加标题、辅助文字、角标 |
| `finalize` | algo | 组装结果并写入 payload |

`generate-images` 通过 `StageRunner.setStageProgress()` 写 `done/total`，
`snapshotToMeta()` 把阶段内进度折算进 `pct`，任务中心的百分比不会卡在阶段边界。

## 3. 页面恢复

- 页面用 `useSocialComposeTask` 观察本入口的 `queued/running` 任务。
- 每 1.5s 读取 payload 的 `run` 快照；正文从 `compose-body` 的 `streamingContent` / `output` 取。
- 任务成功后读取 `result`，回填标题、正文、配图；历史列表按 `taskId` 重新打开。
- 文案先出现；图片后续补入。任务运行中编辑锁定，避免生成结果覆盖用户修改。

## 4. 非图文边界

`classifySocialSource()` 优先读插件 `noteType`，没有时用 `playUrl` / `videoUrls` / `imageUrls` 推断：

- `video`：不能套图文模板；只能改选图文或“只复刻文案”。
- `text_only`：允许只复刻文案，不生成排版配图。
- `article`：公众号按文章处理。
- `unknown`：要求用户确认，不静默套模板。

## 5. 第 5 步规划也要有独立进度

`StepOutlinePlan` 在规划时渲染 `AgentStepRunCard`：卡头有独立进度条，右侧“查看过程”
抽屉里是 `AgentProgress` 与从流式 JSON 中抽出的标题/钩子摘要。不要只显示一个工作流节点。
公众号向导复用同一个组件。

## 6. 复用件

- `WorkflowRunCard`：卡头进度、阶段、取消/重试。
- `AgentProgress`：步骤明细；`StageProgressState.progress` 支持阶段内细进度。
- `AgentWorkflowCanvas`：`embedded` 模式页内渲染流程拓扑，Dialog 模式保持兼容。
- `SocialComposeRunPanel`：组合上述组件 + `ImageGenerationBoard`，不要另写进度条/拓扑图。
- `ImageGenerationBoard`：右侧逐张配图槽位。

## 7. 已知边界

- 生图失败不会把整任务判失败；正文仍交付，`meta.failedImages` 与 `result.warnings` 如实记录。
- 任务 payload 里的配图是生成后的 data URL；图片数量按现有上限 4 张控制。
- 插件当前未必回传 `noteType`，视频判定需要依赖 URL/媒体字段推断。

## 8. 动效基线

流式打字、逐块浮现、实底抽屉、输入框双环等统一遵循 `docs/agent-motion-design.md`（AMD）。
单步过程卡与生成面板都必须复用 `StreamingText` / `.agent-reveal`，不要再整段瞬显或只放一个节点。
