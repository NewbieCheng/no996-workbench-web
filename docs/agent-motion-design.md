# AMD · Agent Motion Design（2026-10-29）

适用于小红书工坊、公众号图文以及后续所有 Agent 生成面板。目标不是“花哨”，而是让用户一直知道：
**系统在动、动到哪一步、正在产出什么**。等待时不要只留一个节点或空白。

## 1. 流式输出

- 单字出现：`90ms`，`blur(6px) → 0`，`cubic-bezier(.215,.61,.355,1)`。
- 相邻字错开 `30ms`，形成“逐个晕开”的节奏，不是整段闪出。
- 只给新增字加动画；已经出现的字保持静止，避免每次轮询整段重播。
- 首屏一次到达很多字时，只让最后一段逐字出现，防止上百个节点同时动画。
- 实现：`src/components/agent/StreamingText.tsx`，样式在 `agent-motion.css`。
- JSON 流必须先过滤成可读字段；**绝不把 `{`、`}`、key 名或提示词直接展示**。
- 单个 AI 步骤要有“流式输出”标题、实时状态点、至少一行可展示文本或“已接收 N 字”的实时说明。

## 2. 逐块浮现

- 规划结果、分段卡片、配图卡片、CTA 不要整块瞬时出现。
- 每个区块使用 `.agent-reveal`，相邻块延迟 `60–80ms`，从 `opacity:0 / blur(4px) / translateY(8px)` 到清晰。
- 只对首次挂载/首次出现做动画；用户编辑时不重播。

## 3. 面板与输入框

- 右侧过程面板必须是**实底不透明**，不能透出底层页面内容。
- 输入框聚焦不加 `outline`、不改边框色；用双层 `box-shadow` 造“咬合感”。
- 行内小图标 `vertical-align: -0.125em`，不要悬在文字中线。
- 数字统一 `font-variant-numeric: tabular-nums`，避免百分比/张数跳动。
- 正文使用 `text-wrap: pretty`，减少孤字。

## 4. 暗色补偿

- 深色背景上的白字会显胖；正文/流式文字字重降到约 `360`。

## 5. 折叠与动效性格

- 折叠用 Grid `0fr → 1fr` 过渡，不靠 JS 算高度。
- 拖拽用 overdamped（约 `1200/80`）零回弹；点赞/对勾用 underdamped（约 `380/18`）微弹。
- 复制/对勾反馈 2.5s 后自动淡出恢复。
- 尊重 `prefers-reduced-motion`：动效全部关闭。

## 6. 复用位置

- 单步：`src/components/agent/AgentStepRunCard.tsx`
- 生成大面板：`src/features/social-studio/run/SocialComposeRunPanel.tsx`
- 逐字文本：`src/components/agent/StreamingText.tsx`
- 动效令牌/工具类：`src/components/agent/agent-motion.css`

新增 Agent 页面时优先复用以上件，不要各自写 spinner 或假进度。
