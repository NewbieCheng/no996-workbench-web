# 产品定位与优势分析（网页工作台）

> 页面：左侧「内容创作 → 产品定位」，路由 `/workbench/product-position`。
> 来源：外部 Skill 包「2-产品定位与分析 skill」（SKILL.md / 网页端 PRD v1 / 线框原型 / 报告模板），登记见 `MIGRATION_PROVENANCE.md`。

## 1. 这个功能做什么

用户建一份产品档案（名称、类型、规格价格、附件、四个补充问题），系统读取当前启用的人设档案作为背景，按 Skill 的方法论生成一份固定结构的 Markdown 报告，再解析成 5 个页签 + 定位分析详情，供后续短视频、直播、朋友圈复用。

## 2. 与原型（PRD）的差异

原型的架构假设是「服务端持有产品、附件、任务与报告」。本项目没有产品域后端接口，因此做了如下落地，界面文案也据此如实标注：

| 原型假设 | 本项目实现 |
|---|---|
| 服务端归属、上下文组装、模型调用、解析、持久化 | 全部在浏览器：`src/agent/` 编排 + IndexedDB（`no996-workbench-product-position`） |
| 后台任务状态由服务端推送 | `workbench-tasks` 队列（kind `product_positioning`），页面按 `taskId` 观察真实状态，不显示编造百分比 |
| 附件支持 Word / PDF / MD | 只支持 `txt / md / docx`（单文件 4MB）。PDF、图片、音视频上传后标记「不支持解析」，不冒充已读取 |
| 默认联网补竞品 | 默认不联网（本期范围外），流程中没有检索阶段 |
| 报告是唯一成果 | 一致：模型只返回 Markdown，程序校验结构并解析 |
| 账号级隔离 | 本机记录带 `ownerSub`（JWT uid/tid），同浏览器切账号不串数据；不跨设备同步 |

报告原文永远保存；解析失败、结构不合格或任务失败都不覆盖上一份有效报告。

## 3. 代码结构

```
src/features/product-position/
  ProductPositionPage.tsx        页面外壳、选择/自动保存/入队/回填
  views/ProductSwitcher.tsx      Page 顶栏产品切换（下拉、条件搜索、新建/删除）
  views/ProductAssistField.tsx   字段壳 + AIEditPopover / 类型预设
  views/ProductInputForm.tsx     资料录入（首屏基本信息；附件与补充题默认折叠）
  agent/form-assist.ts           单字段润色（demo / 正式）
  views/ProductReport.tsx        公共信息条 + 5 页签 + 定位分析详情 + 原文
  views/blocks/ReportBlocks.tsx  字段、引用、表格、可展开条目、复制按钮
  agent/product-position-flow.ts 5 阶段 flow（准备→撰写→校验→修复→整理）
  agent/demo-report.ts           演示用完整报告（虚构产品，仅 demo 与测试）
  agent/demo-responder.ts        演示应答器
  lib/report-parser.ts           模板驱动的 Markdown → 视图模型
  lib/report-view.ts             章节/表达读取、营销表达抽取
  lib/adequacy.ts                资料充分性预检
src/services/product-position/   数据模型 + IndexedDB 仓储
src/prompts/product-positioning.ts  方法论要点 + 正式模板 + 提示词拼装
src/services/workbench-tasks/executors/product-positioning.ts  后台执行器
```

**控件归属**（与 `AGENTS.md`「页面骨架与控件归属」一致）：

- 顶栏 `actions`：自动保存状态（有变化才显示）→ 人设 → `+` 新建（仅图标）→ **生成定位分析（最右）**。
- 人设绑定用通用 `PersonaBinding` + `usePersonaInjection()`；关闭即本次不注入。
- 文本字段用 `ProductAssistField`（`AIEditPopover` + 可选 `FieldPresetPicker`）；附件用 `AttachmentUploader`（`kind="doc"`、txt/md/docx、4MB）。
- 不恢复 sticky 第二顶栏；AI 只用 Popover Portal，避免全屏遮罩导致点不了。

## 4. 生成链路
| 阶段 | kind | 说明 |
|---|---|---|
| prepare-context | algo | 合并产品、四问、附件正文、人设问卷与 Profile；资料不足时直接以 `ProductInputInsufficientError` 停在模型之前 |
| compose-report | model | 内联方法论 + 正式模板，流式输出整篇 Markdown（不走 JSON） |
| check-structure | algo | `parseProductReport` 校验六章、固定栏目、表格闭合、是否截断 |
| repair-report | model | 只在结构不合格时触发，最多一次，只补结构不改事实 |
| finalize | algo | 输出视图模型；报告中途截断按失败处理，不保存半篇 |

结构修复后仍不合格 → 报告记为 `failed`，保留原文供「查看上一次的原文」。

## 5. 解析器约定（改模板时必须同步）

- 结构由模板标题层级决定：H1 报告名、H2 六章、H3 固定栏目、H4 动态条目；
- 字段按完整标签识别（`**客户利益：**`），不做关键词模糊匹配；
- 表格允许 `\|` 转义与 `<br>`，替代方案列数动态；
- 引用块是用户原话，块内 `#` `|` 换行不拆结构；
- `未提供 / 尚待确认 / 不适用 / 暂无` 是合法值；整栏写「未提供真实客户案例」不触发缺失；
- 模板外的 H2 进 `unrecognized`，界面折叠展示，绝不丢弃；
- 章节/栏目清单在 `lib/report-template.ts`，模板正文在 `src/prompts/product-positioning.ts`，两处版本号一致（当前 `v1`）。

## 6. 数据与状态

- 产品：`ProductRecord`（specs 至少一行；空价格 ≠ 0 元）。
- 报告：`ProductReportSnapshot`，含原文、解析结果、结构问题、输入快照（产品 + 人设问卷/Profile + 附件状态）。
- 有效报告 = 最新一条 `succeeded`；失败尝试单独保留，页面提示「上次失败」。
- 队列任务与报告通过 `taskId` 关联；页面刷新后若任务仍在跑，会自动绑定并恢复进度。

## 7. 测试与验收

```powershell
npm run typecheck
npm run test:agent     # 含 report-parser / adequacy
npm run test:flows     # 含 product-position 注册与演示端到端
npm run build
```

手工验收清单见 PRD 第 13 节；本项目对应的 20 条已在实施计划中逐条映射（表单必填、附件状态分离、结构不合格不冒充成功、刷新恢复、本机隔离等）。

## 8. 已知边界

- 报告只在本机浏览器，不同步、不导出（PRD 本期范围外）；可查看并复制原文 Markdown。
- 不处理音色/口音之外的产品承诺；不联网核实竞品。
- 演示模式（`VITE_WORKBENCH_AI_MODE=demo`）返回虚构样例报告，界面同时显示「演示」徽标，不得当作真实客户材料。
