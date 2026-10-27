# 动效库第二期：配色全覆盖 + 竖屏 9:16 适配计划

> 上一期见 [`docs/shot-editability-plan.md`](./shot-editability-plan.md)：阶段 0–3 已完成（文案接参、共享 LOOKS 配色、字数上限、画幅诚实标注）。
> 本文只覆盖上一期**明确留白**的两件事：**余下 74 个自带色板镜头的配色可改**，以及**竖屏 9:16 适配**。

**状态：未开始（等待确认后执行）**
**最后更新：2026-10-23**

---

## 1. 现状（来自本机实测，不是估算）

| 指标 | 数值 | 来源 |
|---|---|---|
| 镜头总数 | 151 | `registry.generated.ts` |
| 已有配色键（`useLook`） | 77 | 同上，`editableKeys ∩ 6 个配色键` |
| **无配色键** | **74** | 同上 |
| 其中已 `import` `_fixtures/Look` 但未调 `useLook` | 15 | 逐文件 grep |
| 其中整页依赖截图/贴图（真实像素不可换色） | 6 | 逐文件 grep |
| 使用 480×270 设计坐标系（`DesignStage`，等比缩放） | 13 | 逐文件 grep |
| 硬编码 `1920` 的镜头文件 | 112 / 158 | `grep -rl 1920 shots` |
| 竖屏适配 | 0 | 全部按 1920×1080 绝对定位构图 |

74 个镜头按"改造成本"分四组（完整名单见 §7）：

| 组 | 判据 | 数量 | 典型难点 |
|---|---|---|---|
| A | 文件内 ≥12 个色值，自成一套色板 | 27 | 需要逐个做"自有 token → 4 个槽位"的映射表 |
| B | 5–11 个色值 | 24 | 多数只需主色 + 底色两个槽 |
| C | 1–4 个色值 | 21 | 改造成本最低，接近"改一行" |
| D | 0 个色值（纯排版/纯黑） | 2 | 可能本来就没有可换的颜色 |

---

## 2. 目标与非目标

**目标**
1. 让 74 个镜头中**真正有颜色可换**的那部分，在检查器「视觉配色」页签里改色能实时生效，且默认帧零变化。
2. 让动效库能按 **1080×1920** 出片：先做到"不重写镜头也能出竖屏"，再对高频镜头做真正的竖屏重排。
3. 两个能力都必须**可验证**：新增 `--colors`（已有）与 `--aspect`（新建）两条真实浏览器抽查通道，结果写进本文件 §9。

**非目标（明确不做，避免范围蔓延）**
- 不做 4:5 / 1:1 / 方屏适配（需要时另立计划）。
- 不扩大口播内容版白名单（`talk-shot-catalog.ts` 的 `candidate` 逻辑不动）。
- 不改后端、不改导出编码链路；竖屏只改"画布尺寸与构图"，编码参数沿用现有导出。
- 不改截图/贴图类镜头的画面内容（只做诚实标注）。

---

## 3. 关键设计决策

### 3.1 配色：不强制套 `useLook`，新增轻量槽位 `usePalette`

**为什么不能直接套 `useLook`**：这 74 个镜头里有相当一部分，"颜色本身就是内容"——
`interaction/theme-switch-moves~ThemeSweepToggle`（浅色↔深色主题切换）、`rhythm/beat-step-list-theme-cycle`（主题轮播）如果整体换成某个 Look，动作的含义就没了；`effects/riso-print-hits`（双色套印错位）换了主色就失去孔版印刷的识别度。

**方案**：新增 `usePalette(fallback)`，只暴露 **4 个槽位**，其余配色仍由镜头自己决定：

```ts
// _fixtures/Look.tsx（与 useLook 并列，同一套 useShotProp 读取，自动进 editableKeys）
export type Palette = { bg: string; primary: string; secondary: string; ink: string }

export function usePalette(fallback: Palette): Palette
```

- `customBg → bg`、`customPrimary → primary`、`customSecondary → secondary`、`customInk → ink`。
- `colorTheme`：对这 74 个镜头**只映射成 4 槽位预设**（例如 ember → `{bg:'#160d09', primary:'#ff7a3d', secondary:'#ffc46b', ink:'#f7eee4'}`），不再声称"整套 look 换肤"。检查器里对这类镜头加一句说明：`预设主题在本镜头只替换 4 个主色槽位`。
- 默认值 = 各镜头原本的四个主色字面量 → **默认帧零变化**（用现有 `--colors` 通道回归，`themeRatio` 与 `primaryRatio` 都必须 > 0.005 才算接通）。

**为什么不另建一套 `paletteTheme` 键**：`useShotProp` 的扫描口径、检查器的「视觉配色」页签、注册表 `editableKeys` 都已经围绕这 6 个键成型；新增键名会让检查器出现两套并行控件，得不偿失。

### 3.2 竖屏：三层策略，先通用容器、再逐镜头重排

| 层 | 做法 | 覆盖 | 成本 | 风险 |
|---|---|---|---|---|
| **V1 通用容器** | 1080×1920 视口 + 内部 1920×1080 舞台，按焦点做 `cover` 裁切或 `fit` 等比缩小 | 全部 151 | 低（1 个组件 + 元数据） | 左右裁掉 25%，构图偏侧的镜头会切坏 |
| **V2 焦点元数据** | 每个镜头一条 `vertical: { mode, focusX, focusY }`，默认 `cover` + 中心；数据由清单 JSON 注入，不改组件源码 | 全部 151 | 低 | 焦点判断需要人工核对（用截图过一遍） |
| **V3 逐镜头竖屏变体** | 组件内读 `useVideoConfig().width/height`，竖屏走一套重排布局（不是裁切） | 先 20 个高频，视需要再扩 | 高（每个 0.5–1 人日） | 等于重画构图，必须逐帧验收 |

**竖屏安全区**：上方留 180px（状态/标题区）、下方留 320px（口播字幕 + 进度），中间 1080×1420 为"必读区"。V1 容器负责把舞台内容压进必读区，V3 变体必须自己遵守这个安全区。

**为什么不直接全量 V3**：151 × 1 人日 ≈ 半年；而多数镜头（图表、卡片、粒子）在 V1 的 `cover` + 焦点校正下已经可用。先把"能出竖屏"落地，再用数据（哪些镜头被裁坏）决定 V3 名单。

---

## 4. 阶段 P：配色全覆盖（74 个镜头）

### P.0 基础设施（半天）

- [x] P.0.1 `_fixtures/Look.tsx` 新增 `usePalette(fallback)` + `PALETTE_THEMES`（8 主题 × 4 槽位预设表）。
- [x] P.0.2 `scripts/lib/shot-editable-keys.mjs` 识别 `usePalette(` 调用，按 `useLook` 同样的口径补 6 个配色键（否则间接消费会被误判不生效）。
- [x] P.0.3 `shot-schemas.ts`：对"用 usePalette 的镜头"，配色字段 description 写明"预设主题只替换 4 个主色槽位"。
- [x] P.0.4 `verify-entry.tsx` 的 `__shotVerifyColorCheck` 增加 `customBg` / `customInk` 两个通道（现在只有 theme + primary），否则底色与墨色改失败也看不出来。
- [x] P.0.5 回归基线：跑一次 `npm run verify:shots -- --all`，把当前 151 帧的 `inkRatio` 存成 `.verify/baseline-ink.json`，供后续"默认帧零变化"对比。

**判据**：`node parsecheck.mjs` 0 诊断、`npm run test:shots` 6/6、`--all` 仍 151/151。

### P.1 批次一：A 组深度色板（27 个）

**映射规范（先定死，避免 27 个镜头 27 种写法）**：

1. 文件顶部（组件外）放默认值常量，**四个字面量必须等于该镜头原本的主色**：
   ```ts
   const PALETTE_FALLBACK = { bg: '#090d1a', primary: '#e0552a', secondary: '#2b3048', ink: '#eef1fa' };
   ```
2. 组件体内一行取色（`usePalette` 必须在组件顶层、无条件调用）：
   ```ts
   const PAL = usePalette(PALETTE_FALLBACK);
   ```
3. 只替换四类位置：**大面积舞台/页面底色 → `PAL.bg`**、**最显眼的品牌强调色 → `PAL.primary`**、**次强调 → `PAL.secondary`**、**主文字色 → `PAL.ink`**。
4. **不替换**：成功/危险等状态色、`BRAND.amber`、印刷专色、阴影色、渐变中间停靠点（换了会破坏材质与可读性）。
5. 多主题镜头（如 theme-switch 的昼/夜两套）只覆盖"强调色 + 夜色底"，另一套保持原样，避免把演示语义改掉。
6. 改完必须 `node parsecheck.mjs` 0 诊断；批次结束后统一跑 `--colors` 抽查（通道 ≥1 项 > 0.005）。

逐个做"自有 token → 4 槽位"映射。做法固定：

1. 把模块级色常量（`const BG = '#0b0b0f'` 等）搬进组件内，改为 `const PAL = usePalette({ bg: '#0b0b0f', primary: ..., secondary: ..., ink: ... })`。
2. 只在"用户真的会想改"的地方用 `PAL.*`（大面积底色、主强调、次强调、正文字）；品牌琥珀 `BRAND.amber`、状态色（成功绿/危险红）、印刷专色**保持硬编码**——换了就不是这个镜头了。
3. 每改 3–4 个跑一次目标镜头出帧 + `--colors` 抽查。

**优先顺序**（从"最可能被用户改色"排）：
`interaction/theme-switch-moves~ThemeSweepToggle`、`~PaletteThemeRipple`（这两个必须先做，它们是"改色"这个动作本身的演示，检查器改色不改画面会立刻穿帮）→ `transition/bottom-push-stack-wipe`、`transition/transition-hidden-cut~InvisibleCut`、`rhythm/panel-grid-moves`、`rhythm/beat-step-list-theme-cycle`、`effects/impact-feedback~HitCounter`、`ui-entrance/integration-hub-map`、`ui-entrance/neon-frame-orbit-drop`、`camera/graze-face-tour`、`camera/steep-tilt-glide`、其余按 §7 名单顺延。

**判据**：该批每个镜头 `themeRatio|primaryRatio|bgRatio|inkRatio` 至少一项 > 0.005；`--all` 无新增空白帧。

### P.2 批次二：B 组中等色板（24 个）

同上，但多数只映射 `bg` + `primary` 两个槽位（`secondary`/`ink` 保持原值即可）。这一批里有 6 个是截图/贴图类（`ui-entrance/page-waterfall-wall`、`row-embed`、`outro/outro-group-photo-launch`、`interaction/type-and-filter`、`camera/crash-zoom-punch~CrashImpactReal`、`ui-entrance/list-stack-press`），先判定"改色是否真的有意义"，无意义就走 P.4 登记。

**判据**：同 P.1。

### P.3 批次三：C 组单强调色（21 个）

这些镜头全片只有 1–4 个色值，多数是"一个强调色 + 黑白"。改造成本最低，可以一次批量脚本 + 人工核对：

**判据**：同 P.1；另外抽 3 个手动确认画面没走形（颜色比例没变、对比度没塌）。

### P.4 批次四：登记为"不可改色"（预计 8–12 个）

给这些镜头在注册表加 `colorFixed: true`，动效库卡片角标显示「固定配色」，检查器不出现配色页签（现在靠 `editableKeys` 为空已自动隐藏，只需补一句说明文案）。

候选：`ui-entrance/page-waterfall-wall`、`ui-entrance/row-embed`、`outro/outro-group-photo-launch`、`ui-entrance/list-stack-press`、`camera/space-camera-moves~DroneDiveLanding`、`typography/paper-title-card`、`typography/type-entrance-moves`（后两个 hex=0，先确认它们是否读 LOOKS；不读就是纯黑白）。

**判据**：这些镜头 `editableKeys` 里没有任何 `custom*`/`colorTheme`，且 `test:shots` 的"无假字段"断言仍通过。

### 阶段 P 完成判据

1. 74 个镜头里，**有意义的都已接 `usePalette`**，其余有 `colorFixed` 标记与理由。
2. `--all` 151/151，无空白帧，`inkRatio` 与 `.verify/baseline-ink.json` 偏差 < 0.002。
3. 每个批次 ≥3 个镜头 `--colors` 实测通过（含新增的 bg/ink 通道）。
4. 注册表 `editableKeys` 中带配色键的镜头数从 77 提升到 ≥140。

---

## 5. 阶段 V：竖屏 9:16

### V.0 元数据与清单（半天）

- [x] V.0.1 新建 `packages/video-editor/src/demos/vertical-presets.json`：`{ "<shotId>": { "mode": "cover|fit|reflow", "focusX": 0.5, "focusY": 0.5 } }`，缺失即默认 `cover` + 中心。
- [x] V.0.2 `scripts/generate-shot-registry.mjs` 读该 JSON，写进注册表 `vertical` 字段（和 `editableKeys` 同一套机械注入，避免手改 151 个组件）。
- [x] V.0.3 `dom-frame-renderer` 增加 `aspect: '16:9' | '9:16'` 选项；9:16 时 canvas = 1080×1920，内部仍以 1920×1080 渲染舞台。

### V.1 通用容器（1–2 天）

- [x] V.1.1 新增 `_fixtures/VerticalFrame.tsx`：按 `mode` 把 1920×1080 舞台放进 1080×1920 画布。
  - `cover`：等比放大到填满宽度，按 `focusX/focusY` 取裁切窗口（默认左右各裁 31.25%）。
  - `fit`：等比缩小到高度填满，上下留背景色（用于图表/时间轴这类"不能裁"的镜头）。
  - `reflow`：交给镜头自己的竖屏变体（V.3），容器只提供安全区变量。
- [x] V.1.2 安全区常量：`VERTICAL_SAFE = { top: 180, bottom: 320 }`，以 CSS 变量 `--safe-top/--safe-bottom` 注入，供 V.3 变体使用。
- [x] V.1.3 `verify-shot-render.mjs` 新增 `--aspect 9:16`，输出 1080×1920 帧与 `inkRatio`。

**判据**：151 个镜头在 9:16 下全部能出帧（不报错、`inkRatio > 0.005`）。

### V.2 焦点校准扫一遍（2–3 天）

- [x] V.2.1 用 `--aspect 9:16` 全量出帧，人工（或半自动：检测"文字是否被裁"）过一遍 151 张。
- [x] V.2.2 把 `mode: 'fit'` 分给"信息密度高、不能裁"的镜头（图表/时间轴/多列布局），`focusX/Y` 分给构图偏侧的镜头。
- [x] V.2.3 产出"必须重排"清单（V.3 的输入），预期 20–35 个。

**判据**：`vertical-presets.json` 覆盖 ≥95% 镜头；被裁坏的镜头全部进 V.3 清单或标 `mode:'fit'`。

### V.3 竖屏变体（每个 0.5–1 人日，先 20 个）

按使用频率挑首批（可在执行时按真实播放数据调整）：

| 序 | 镜头 | 竖屏做法 |
|---|---|---|
| 1 | `opening/crane-rise-reveal` | 表格改 2 列滚动，标题上移进安全区 |
| 2 | `opening/spotlight-hero-card` | 卡片改满宽，聚光灯改从上往下 |
| 3 | `typography/lead-word-zoom-assemble` | 主词分 3 行，字号按短边重算 |
| 4 | `typography/flying-words` | 词流改纵向 |
| 5 | `ui-entrance/card-stack` | 卡堆改单列纵向摊开 |
| 6 | `ui-entrance/list-reveal` | 列表占满宽度，标题移到顶部 |
| 7 | `data/chart-live-moves~AxisRescaleShockV2` | 图表转纵向柱状，图例下移 |
| 8 | `interaction/glass-pill-dictation-typing` | 药丸改底部固定，键盘安全区 |
| 9 | `effects/slam-entrance-moves~ScoreSlam` | 数字居中放大，背景改纵向渐变 |
| 10 | `transition/shot-transitions~PortalWipeV2` | 门洞改上下开合 |
| 11–20 | 待 V.2 清单确定 | — |

- [x] V.3.1 建立"竖屏变体"写法规范：组件内 `const { width, height } = useVideoConfig()`，`vertical = height > width`，两套布局分支共用同一份时间轴与文案键。
- [x] V.3.2 每个变体：默认横屏帧零变化 + 竖屏帧人工确认 + `--aspect 9:16` 出帧。

**判据**：每个变体横屏 `--all` 不回归；竖屏画面内文字完整、不被安全区遮挡。

### V.4 导出与文档（1 天）

- [x] V.4.1 导出设置增加 9:16 预设（沿用现有编码参数，只改分辨率）。
- [x] V.4.2 `docs/video-factory.md` 写明：哪些镜头是 `cover`/`fit`/`reflow`，V.3 覆盖了哪些。
- [x] V.4.3 动效库卡片：已做竖屏变体的显示「横竖屏」，其余继续「仅横屏」。

### 阶段 V 完成判据

1. `--aspect 9:16` 全量出帧，无报错、无空白 → ✅ 151/151，0 空白。
2. 首批 20 个镜头竖屏可用（人工验收，附截图）→ ✅ 19 个通过逐张目视验收；第 20 个
   `outro/logo-shrink-wordmark-lockup` 竖屏中帧近全黑，判定重排不成立并回退为 `fit`（截图证据：
   `.verify/v3-all2/` 20 张 PNG 与 `.verify/v3-sheet2.png` 接触表）。
3. 库卡片与检查器的画幅标注与实际能力一致（不夸大成"已适配 9:16"）→ ✅ 卡片按 `vertical.mode`
   显示「横竖屏」（19 个）/「仅横屏」（其余 132 个）。

---

## 6. 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| `usePalette` 只换 4 槽位，用户仍可能觉得"改不全" | 体验落差 | 检查器写明"只替换 4 个主色槽位"；确实需要全换的镜头走 `useLook` 路线 |
| 强行给"颜色即内容"的镜头换色（主题切换、套印） | 语义被破坏 | 这类镜头只开放"底色/正文"两个槽，主色锁定并在 description 说明 |
| `cover` 裁切把标题切掉 | 竖屏不可用 | V.2 全量人工过一遍；宁可 `fit` 有留白，也不要裁断字 |
| 竖屏变体与横屏分叉后维护成本翻倍 | 长期负担 | 强制"同一时间轴 + 同一文案键，只分支布局"；不为竖屏单独复制组件 |
| 151 张基准帧没有金标图，只能比 `inkRatio` | 回归发现弱 | P.0.5 存 baseline ink；关键批次附 before/after 截图 |
| 批量子代理并行改同一批文件冲突 | 返工 | 每个 agent 只碰一个镜头文件；schema/registry 由主进程统一合并 |

---

## 7. 74 个镜头分组名单（执行时的勾选清单）

### A 组（27，深度色板）
`camera/graze-face-tour`、`camera/steep-tilt-glide`、`data/gauge-readout-moves~NeedleSweepSelftest`、`effects/glow-flyline-moves~GlowOrbAmbient`、`effects/impact-feedback~HitCounter`、`effects/light-play-moves~SpotlightSweepReveal`、`effects/spotlight-sweep-moves~CornerSpotlightReveal`、`effects/spotlight-sweep-moves~GlowWakeSleepPanel`、`effects/spotlight-sweep-moves~SlideSpotlightPan`、`interaction/hashtag-to-pill-materialize`、`interaction/picker-carousel-feature-cycle`、`interaction/theme-switch-moves~PaletteThemeRipple`、`interaction/theme-switch-moves~ThemeSweepToggle`、`opening/letterspace-materialize`、`outro/grain-dissolve`、`outro/logo-shrink-wordmark-lockup`、`outro/ui-strip-away-outro`、`outro/ui-to-brand-morph~InputMorphsIntoLogo`、`rhythm/beat-step-list-theme-cycle`、`rhythm/panel-grid-moves`、`transition/bottom-push-stack-wipe`、`transition/transition-hidden-cut~InvisibleCut`、`typography/gradient-word-sweep`、`ui-entrance/bezier-source-converge-merge`、`ui-entrance/doc-park-left-pill-deal`、`ui-entrance/integration-hub-map`、`ui-entrance/neon-frame-orbit-drop`

### B 组（24，中等色板）
`camera/crash-zoom-punch~CrashImpactReal`、`camera/tension-camera-moves~PullBackIsolation`、`data/before-after-slider-scrub`、`data/scroll-brake-moves~BrakeReticleLock`、`data/scroll-brake-moves~ChangelogScrollBrake`、`data/timeline-travel`、`effects/glow-flyline-moves~FlylineArc`、`effects/impact-feedback~AnimeImpact`、`effects/riso-print-hits`、`effects/scan-bracket-sweep`、`interaction/segmented-thumb-hero`、`outro/neon-triple-marquee`、`transition/print-texture-transitions`、`transition/transition-hidden-cut~VersusSlam`、`typography/lead-word-zoom-assemble`、`typography/pill-chip-slot-cycle-handled`、`typography/text-column-converge`、`typography/vertical-word-roll-blur-cycle`、`ui-entrance/avatar-bracket-carousel`、`ui-entrance/page-waterfall-wall`、`ui-entrance/research-card-stack-scroll`、`ui-entrance/row-embed`、`ui-entrance/value-stagger-gradient`、`ui-entrance/wall-reveal-moves~WireframeDrawOn`

### C 组（21，单强调色）
`camera/space-camera-moves~DroneDiveLanding`、`effects/aurora-bloom-bg-flip`、`effects/fui-hud-moves`、`interaction/type-and-filter`、`opening/fracture`、`outro/outro-group-photo-launch`、`outro/ui-to-brand-morph~IconFlipBloomLogo`、`rhythm/rhythm-interrupt-moves`、`rhythm/trailer-grammar-moves`、`transition/tear-streak-transitions`、`typography/brand-ink-open`、`typography/marker-underline-title`、`typography/pill-slot-cycle`、`typography/type-assembly-moves~LetterformDriftAssembly`、`typography/type-assembly-moves~SplitTextStagger`、`typography/type-rhythm-sync~KaraokeFillSync`、`typography/typewriter-moves`、`ui-entrance/clipcard-looping`、`ui-entrance/list-stack-press`、`ui-entrance/radial-wave`、`ui-entrance/wall-reveal-moves~BentoLightUp`

### D 组（2，无色值）
`typography/paper-title-card`、`typography/type-entrance-moves`

---

## 8. 排期（估算，按单人）

| 阶段 | 内容 | 估时 |
|---|---|---|
| P.0 | 基础设施 + 基线 | 0.5 天 |
| P.1 | A 组 27 个 | 3–4 天 |
| P.2 | B 组 24 个 | 2–3 天 |
| P.3 | C 组 21 个 | 1–2 天 |
| P.4 | 固定配色登记 | 0.5 天 |
| V.0–V.2 | 竖屏容器 + 焦点校准 | 3–4 天 |
| V.3 | 20 个竖屏变体 | 10–15 天 |
| V.4 | 导出与文档 | 1 天 |

配色全覆盖约 **8–10 天**；竖屏"能出片"约 **4–5 天**，"20 个高频镜头真正竖屏重排"再加 **10–15 天**。

---

## 9. 进度看板（执行时更新本节）

| 里程碑 | 状态 | 进度 | 备注 |
|---|---|---|---|
| P.0 基础设施 | ✅ 完成 | 5/5 | `usePalette` + `PALETTE_THEMES`（14 个预设）、扫描口径识别 `usePalette`、注册表新增 `colorMode`、检查器说明、`--colors` 扩到 4 通道（theme/primary/bg/ink）、`.verify/baseline-ink.json`（151 条） |
| P.1 A 组（27） | ✅ 完成 | 27/27 | 两个 theme-switch 镜头先手工做（theme=0.069 / bg=0.251 / ink=0.026），其余 25 个按映射规范铺开；`--colors` 抽查 21 个全部至少 1 个通道 > 0.005（如 `beat-step-list-theme-cycle` theme=1/bg=1、`bezier-source-converge-merge` theme=0.954、`grain-dissolve` bg=0.995）；`--all` 151/151；`test:shots` 6/6 |
| P.2 B 组（24） | ✅ 完成 | 24/24（19 接 + 5 判为不可改） | 19 个接入并通过 `--colors` 抽查（如 `riso-print-hits` theme=1/bg=1、`neon-triple-marquee` theme=0.968/primary=0.69、`lead-word-zoom-assemble` theme=0.994）；5 个如实判死、登记进 P.4：`data/before-after-slider-scrub`、`effects/impact-feedback~AnimeImpact`、`ui-entrance/page-waterfall-wall`、`ui-entrance/row-embed`、`ui-entrance/wall-reveal-moves~WireframeDrawOn`（画面主体整页截图或共享占位底图，改色无可落地对象）；`transition/print-texture-transitions` 额外补了「共享底图落定帧」的调色膜，从 4 通道全 0 修到 bg=0.239 |
| P.3 C 组（21） | ✅ 完成 | 21/21（20 接 + 1 判为不可改） | 全部通过 `--colors` 抽查（如 `aurora-bloom-bg-flip` theme=1/primary=0.521、`marker-underline-title` theme=1/bg=0.953、`radial-wave` theme=1/primary=0.098）；`camera/space-camera-moves~DroneDiveLanding` 判为不可改（纯运镜包装 + 共享占位素材） |
| P.4 固定配色登记 | ✅ 完成 | 8/8 登记 | 新增 `demos/color-fixed.json`（8 条，含理由）→ 生成脚本输出 `colorFixed` + `colorFixedReason`；检查器在没有配色键时改显示一句说明，不再渲染一排拖了不动的手柄 |
| **配色覆盖率** | ✅ 达成 | **143 / 151** | 原有 77 + 新接 66 = 143 个镜头有配色键；剩余 8 个全部登记为 `colorFixed` 并写明原因。`--all` 151/151、`test:shots` 6/6、`parsecheck` 0 诊断 |
| V.0 元数据 | ✅ 完成 | 3/3 | `vertical-presets.json` 覆盖 **151/151**（cover 64 / fit 68 / reflow 19）；生成脚本读它并写进注册表 `vertical`；`FlylineArc` 因自身写死 1920×1080 容器改为 `fit` |
| V.1 通用容器 | ✅ 完成 | 3/3 | `_fixtures/VerticalFrame.tsx`（cover / fit / reflow + `VERTICAL_SAFE` 上 180 / 下 320）、`dom-frame-renderer` 支持 `vertical`（cover/fit 时 `useVideoConfig` 仍报 1920×1080，reflow 才报真实竖屏）；`--aspect 9:16` 全量 151/151 出帧、0 空白 |
| V.2 焦点校准 | ✅ 完成 | 3/3 | 151 张竖屏帧全量出图并做成 7 张接触表逐张过审；`vertical-presets.json` 覆盖 151/151（cover 67 / fit 84）。判据：文字/表格/界面是画面主体的镜头（typography / data / rhythm / interaction / ui-entrance 共 79 个）走 `fit` 不裁字，构图与光效类（camera / effects / transition / opening / outro）走 `cover`，另有 5 个宽幅信息镜头单独改为 `fit` |
| V.3 竖屏变体 | ✅ 完成 | 19/20 上线（1 个复核后回退） | 20 个镜头写了 `vertical` 重排分支并出图复核；`outro/logo-shrink-wordmark-lockup` 竖屏中帧实测近全黑（`ink` 从横屏 0.976 掉到全黑），判定重排不成立，已 `git checkout` 回退该文件并改回 `fit`。其余 19 个竖屏成片逐张过目：无裁断、无安全区遮挡。横屏 151/151 复跑，`inkRatio` 与改动前基线偏差 > 0.002 的镜头数 = **0**（默认帧零变化） |
| V.4 导出与文档 | ✅ 完成 | 3/3 | 9:16 画幅走现有 `CanvasRatioControl`，导出分辨率沿用 720P/1080P（取短边、保留画幅）；`render/shot-cache.ts` 在竖屏画布下自动传 `vertical`，预览与导出同源；`docs/video-factory.md` 新增 §11.1、`docs/reusable-assets.md` 补两条可复用件；动效库卡片按 `vertical.mode` 显示「横竖屏 / 仅横屏」 |

**代码改动记录**（执行时追加）

| 日期 | 改动 | 结果 |
|---|---|---|
| 2026-10-24 | `_fixtures/Look.tsx` 新增 `usePalette` / `PALETTE_THEMES` / `PaletteState.isCustom` | 4 槽位覆盖层可用，默认值与镜头原字面量一致 |
| 2026-10-24 | `scripts/lib/shot-editable-keys.mjs` 的 `USE_LOOK_CALL` 扩到 `usePalette(` | 扫描口径与运行时一致 |
| 2026-10-24 | `generate-shot-registry.mjs` 注入 `colorMode` / `colorFixed` / `colorFixedReason` / `vertical` | 注册表现状：151 镜头，143 有配色键、8 个 colorFixed |
| 2026-10-24 | `demos/color-fixed.json`（8 条） | 不可改色镜头有据可查，检查器不再显示假控件 |
| 2026-10-24 | `ShotInspectorSection.tsx` 按真实配色键决定是否渲染预设网格与 5 路拾色 | 无配色键的镜头只显示一句说明 |
| 2026-10-24 | `_fixtures/VerticalFrame.tsx` + `dom-frame-renderer` 的 `vertical` 选项 | cover / fit / reflow 三档；cover·fit 时 `useVideoConfig` 仍报 1920×1080 |
| 2026-10-24 | `render/shot-cache.ts` 在竖屏画布下传 `vertical` | 编辑器预览与导出走同一套竖屏逻辑 |
| 2026-10-24 | `demos/vertical-presets.json`（151 条）+ `tests/vertical-presets-truth.test.mjs`（5 例） | 登记缺失 / 非法 mode / 死条目 / 假 reflow 都会被测试拦住 |
| 2026-10-24 | `verify-shot-render.mjs` 新增 `--aspect` / `--ids` / `--shots-dir` / `--save-ink` / `--save-spread` / `--colors` 四通道 | 横屏、竖屏、改色、基线四类取证都有入口 |
| 2026-10-24 | `ShotLibraryPanel.tsx` 画幅角标改按 `vertical.mode` 显示「横竖屏 / 仅横屏」 | 不再一律标「仅横屏」 |
| 2026-10-24 | `docs/video-factory.md` §11.1、`docs/reusable-assets.md` | 配色与竖屏能力的接入规范 |
| 2026-10-24 | 20 个镜头加 `vertical` 重排分支（两遍：先铺再按实测裁断修） | 19 个验收通过；`outro/logo-shrink-wordmark-lockup` 复核不成立，回退为 `fit` |

---

## 10. 与上一期计划的关系

- 上一期 [`docs/shot-editability-plan.md`](./shot-editability-plan.md) 的阶段 1 §6 明确写了「其余约 60 个镜头自带色板——不强做，逐个评估工作量后决定是否纳入」。本文就是那个"评估后的决定"。
- 上一期 §8 的 3.3 只做了「仅横屏」标注（诚实告知），本文 V 阶段才是真正的适配工作。
- 两项都不改动上一期已验收的行为：文案键、`maxLength` 校验、检查器诚实提示、动效库角标全部保持。
