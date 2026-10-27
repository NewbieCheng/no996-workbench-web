# 动效库镜头可编辑化改造计划（Shot Editability Plan）

> 创建：2026-10-23 ｜ 状态文件：**每完成一项任务，打勾并更新本文件的「执行进度」章节**
> 范围：`packages/video-editor/src/demos/`（151 个动效镜头）及其在 `workbench/video-factory` 动效库、检查器面板的编辑体验。

---

## 1. 背景与问题诊断（已完成，2026-10-23）

### 1.1 用户反馈

动效库（视频工厂 → 素材 → 动效库，`ShotLibraryPanel`）里约 150 个动效模板，只有部分模板的文字、视觉配色真正可修改；其余模板的编辑表单是假的——填了值画面不变，等于套用旧 demo 无法替换。典型例子：`opening/crane-rise-reveal`（升降臂拉升揭示）。

### 1.2 结论（根因）

编辑参数的**注入管线是完整且正常的**，问题在于**镜头组件侧几乎没人消费参数**，而 schema 层按分类"乐观推导"出假字段：

1. 参数管线：时间轴片段 `overrides/slots` → `LiveShotLayer` 合并注入 `ShotPropsContext` → 镜头用 `useShotProp(key, fallback)` 读取。链路无缺陷。
2. **151 个镜头中只有 6 个文件真正调用 `useShotProp`**（见 1.3 表）；其余镜头是 `@ts-nocheck` 的整幅移植 demo，文案/品牌/配色全部硬编码，任何写进 `overrides` 的值都被静默忽略。
3. `getShotSchema()`（`packages/video-editor/src/demos/shot-schemas.ts:179`）对未精确登记的镜头**按分类前缀兜底编造字段**：`opening/*`、`typography/*` 自动获得"主标题/高亮词/副标题"，`outro/*` 自动获得"品牌名/CTA"……检查器 `ShotInspectorSection.tsx` 照常渲染这些控件，用户填完能存能撤销，渲染时零效果——这就是"假可编辑"。
4. 注册表 `registry.generated.ts` 中大量条目 `summary` 字面量为 `"@ts-nocheck"`，说明批量套用旧 demo 时未做逐项可编辑性审核；`fidelity` 字段只描述 CameraMotionBlur 渲染保真度，与可编辑性无关。

### 1.3 现状清单：真正消费参数的镜头（ground truth）

| 镜头文件 | shotId | 可改内容 |
|---|---|---|
| `shots/opening/text-as-mask/TextAsMask.tsx` | `opening/text-as-mask` | 文案 + 看板全要素 + 5 个自定义色（最完整，事实上的参考实现） |
| `shots/opening/spotlight-hero-card/SpotlightHeroCard.tsx` | `opening/spotlight-hero-card` | title / subline / cardImage 槽 |
| `shots/typography/blur-slide/BlurSlide.tsx` | `typography/blur-slide` | text / subline |
| `shots/typography/lead-word-zoom-assemble/LeadWordZoomAssemble.tsx` | `typography/lead-word-zoom-assemble` | text / highlightWord / subline（高亮词实际着色仍比较常量，见 talk-shot-catalog 备注） |
| `shots/outro/logo-shrink-wordmark-lockup/LogoShrinkWordmarkLockup.tsx` | `outro/logo-shrink-wordmark-lockup` | brand / slogan |
| `shots/data/chart-live-moves/AxisRescaleShockV2.tsx` | `data/chart-live-moves~AxisRescaleShockV2` | metric / value / label（图表数据仍为固定示例） |

另有 6 个"内容版"干净重写镜头（`demos/content-variants.tsx`：blur / fly / outline / gradient / marker / label），仅供 IP 口播白名单使用，不属于本计划范围，但其 `contentShotTextError` 校验模式可复用。

### 1.4 有利条件

- 151 个镜头中 **91 个**从共享 `_fixtures/Look.tsx` 导入 `LOOKS` 调色板 → 配色批量可改的杠杆点在 fixture 层 + 每文件 3–5 行机械改动。
- 回归工具现成：`/workbench/shot-check`（DEV 缩略图网格）、`npm run verify:shots`（headless 渲染 + inkRatio 非空像素占比，抓静默空白）。
- 参考实现齐全：`TextAsMask` 演示了文案+色盘全要素的完整接法；`ShotInspectorSection` 的"视觉配色"页签与 `colorTheme`/`custom*` 键名约定已存在。

### 1.5 项目内已有共识（须继续遵守）

- `src/features/ip-video/composition/talk-shot-catalog.ts`：口播侧只放行 6 个内容版，明确写有"分类推导的编辑字段不生效，原场景待适配"。本计划完成后该结论需同步更新。
- `MIGRATION_PROVENANCE.md`：原始 demo 的纹理/品牌（如 ShotcraftMark 图标、"video-shotcraft" 字标）许可证据待核实 → 改造中凡用户不可替换的品牌标，必须提供隐藏开关或明确提示，不得当作用户内容默认发布。

---

## 2. 目标与非目标

**目标**

1. 每个在动效库中开放的编辑控件，写入值后画面必须真实变化（可机械验证）。
2. 尽可能多的镜头支持：标题类文案可改 + 视觉配色（底色/主色/强调色/墨色）可改。
3. 界面对"暂不可改"的部分诚实标注，绝不出现假控件。
4. 全程有回归手段，防止改坏出帧。

**非目标**

- 不做数据图表的真实数据接入（`data/*` 的 DATA 仍为演示数据，只开放标签文案）。
- 不做竖屏自适应全覆盖（逐镜头决定：自适应或诚实标注"仅横屏"）。
- 不新增 AI 生成能力、不改后端、不改任务队列。
- 不重写 151 个镜头的动效本身——只动"参数消费"与"配色注入"。

---

## 3. 总体路线

| 阶段 | 内容 | 预估 | 杠杆 |
|---|---|---|---|
| 阶段 0 | 止血：schema 诚实化 + 机械 ground truth | ~0.5 天 | 假控件清零 |
| 阶段 1 | 配色批量可改（fixture 层 `useLook`） | ~1 天 | ~90 个镜头 |
| 阶段 2 | 文案逐镜头接参（分批） | 2–3 天/批 | 按类别递减 |
| 阶段 3 | 中文化、字数上限、画幅标注 | 伴随阶段 2 | 体验底线 |
| 样板 | `crane-rise-reveal` 全套改造（先行验证） | ~0.5 天 | 打样供验收 |

建议执行顺序：**阶段 0 → crane-rise-reveal 样板 → 阶段 1 → 阶段 2 分批 → 阶段 3 伴随**。样板验收通过后再批量铺开。

---

## 4. 阶段 0：止血——让界面诚实（已完成）

- [x] **0.1 注册表生成脚本扩展**：`scripts/generate-shot-registry.mjs` 增加静态扫描——正则提取每个镜头文件中的 `useShotProp('key'` 键名，写入注册表条目新字段 `editableKeys: string[]`（无则空数组）。重新生成 `packages/video-editor/src/demos/registry.generated.ts`。
  - 验收：151 条全部有 `editableKeys`；1.3 表中 6 个文件的键与扫描结果一致。
- [x] **0.2 废除分类兜底编造**：`packages/video-editor/src/demos/shot-schemas.ts` 的 `getShotSchema()` 改为——字段只允许来自 `editableKeys`（生成的 ground truth）∩ 精确登记表 `SPECIFIC_SHOT_SCHEMAS`（提供中文标签、控件类型、默认值、字数上限）；无交集则返回 `fields: []`。保留精确登记表键名与现有 overrides 兼容（不迁移已有工程数据）。
  - 完成：`getShotSchema` 现在只返回「标签 ∩ editableKeys」，分类兜底改为 `deriveCategorySchema()` 仅作标签来源。
  - 验收：对 `opening/crane-rise-reveal` 调用 `getShotSchema` 返回空字段；对 `opening/text-as-mask` 返回原 33 字段不变。
- [x] **0.3 检查器诚实提示**：`packages/video-editor/src/panels/inspector/ShotInspectorSection.tsx`——`fields` 为空时显示说明卡："该镜头为内置演示场景，文案与品牌为内置内容，暂不支持替换；时间轴上的裁剪、变速与排序仍然可用。"不再渲染任何假输入框（AI 填入卡 + 三个页签全部门控）。
- [x] **0.4 动效库角标**：`packages/video-editor/src/panels/shots/ShotLibraryPanel.tsx`——卡片按注册表信息加角标：`可改文案` / `可调配色` / `演示固定`。`packages/video-editor/src/demos/localization.ts` 的中文名不变。
- [x] **0.5 防回归测试**：新增 `packages/video-editor/tests/shot-schema-truth.test.mjs`（`npm run test:shots`）：断言注册表 `editableKeys` 与源码扫描一致（生成脚本与测试共用 `scripts/lib/shot-editable-keys.mjs`）；断言 `getShotSchema` 不返回任何假字段；断言已适配 6 镜头仍暴露真实可编辑字段；断言未适配镜头返回空字段。4/4 通过。
- [x] **0.6 文档同步**：`docs/video-factory.md` §5.2 注册表字段说明补 `editableKeys` 与 `importPath`；`src/features/ip-video/composition/talk-shot-catalog.ts` 顶部注释说明"假字段问题已由阶段 0 解决"（其拒插逻辑本身不变）。

**阶段 0 完成判据：** 任意镜头在检查器里看到的每个控件都真实生效；假控件数量 = 0。

---

## 5. 样板：crane-rise-reveal 全套改造（已完成）

目的：用一个镜头完整走通"配色注入 + 文案接参 + schema 登记 + 验收"，供用户验收后批量复制。

- [x] **5.1 配色**：`shots/opening/crane-rise-reveal/CraneRiseReveal.tsx` 模块顶层 `const L = LOOKS.porcelain` 改为组件内 `const L = useLook('porcelain')`（阶段 1 的 `useLook` 已实现于 `_fixtures/Look.tsx`）；映射：`customBg → surface 舞台底`、`customPrimary → accent 钴蓝`、`customSecondary → accent2 青绿`、`customInk → ink 墨色`。`RowView`/`Pill`/`World`/`Sweeps`/`BackDots` 等子组件均传入 L 或各自 useLook。
- [x] **5.2 文案**：`eyebrow`/`title`/`subline`/`brand`/`showBrandMark` 已接 `useShotProp`（默认值=原值，保持默认画面零变化）；12 行表格 `DATA` 保留为演示数据不开放。
- [x] **5.3 schema 登记**：`SPECIFIC_SHOT_SCHEMAS` 新增 `opening/crane-rise-reveal` 条目（5 字段中文标签+占位+默认值）。
- [x] **5.4 验收**：`npm run test:shots` 5/5 通过（含新样板断言）；`npm run typecheck` 无新增错误；`npm run verify:shots -- --only opening/crane-rise-reveal` 通过 10/10（真实 Chrome 管线出帧正常）。

**样板完成判据：** 默认画面零变化 + 改 4 色 4 文案实时生效 + 撤销/重做正常。

---

## 6. 阶段 1：配色批量可改（已完成）

- [x] **1.1 新增 `useLook`**：`_fixtures/Look.tsx` 实现 `useLook(name)`——读 `ShotPropsContext` 的 `colorTheme` 与 `customBg/customPrimary/customSecondary/customPanel/customInk`（经 `useShotProp` 读取，自动进 `editableKeys`），空值保持基础 look。支持 8 个 LookName + 6 个 UI 色盘名（dark-blue 等）映射。已随样板落地（2026-10-23）。
- [x] **1.1b 扫描口径扩展**：`scripts/lib/shot-editable-keys.mjs` 识别 `useLook(` 调用并补上 6 个配色键（否则间接消费的配色键会被误判不生效）。
- [x] **1.2 批次 A（样板）**：`opening/crane-rise-reveal` ✅ 完成。
- [x] **1.3 批次 B（opening 全部）**：10 个 opening 镜头已全部接入 `useLook`（dataviz-landscape-open / icon-field-colorize / magician-card-flourish / orbit-ring-title-open / spotlight-hero-card / stroke-segment-build / text-as-mask + 样板 crane-rise-reveal）。outro 中 logo-shrink-wordmark-lockup 已接文案（阶段 2 提前完成）；grain-dissolve / neon-triple-marquee / outro-group-photo-launch / ui-strip-away-outro / IconFlipBloomLogo / InputMorphsIntoLogo 未用 LOOKS（用 Fixtures.G / 自定义色板），按计划不强做，后续单独评估。
- [x] **1.4 批次 C：typography + data** ✅ 完成（2026-10-23）。15 个文件接入 `useLook`：typography 11 个（blur-slide / brace-expand / countdown-arc-scatter / flying-words / glitch-cycle / outline-word-fill / title-demote-to-label / type-assembly-moves~TextOnPath / type-rhythm-sync~FontWeightPump / word-relay-filmstrip / word-relay-geometry）+ data 4 个（chart-live-moves~AxisRescaleShockV2 / chart-live-moves~OscilloscopeStreamV2 / chart-live-moves~UnitDotSwarmRegroupV2 / gauge-readout-moves~TapeScrollFixedPointer）。`SEL/GRAD/GOLD/ACC/INK/TRACE` 等模块级派生色常量已下沉到组件内 `const L = useLook(...)` 之后（默认值=原硬编码值，默认帧零变化）。registry 23/151 有配色键；`test:shots` 5/5 通过。
- [x] **1.5 批次 D：ui-entrance / interaction / effects / rhythm / camera / transition** ✅ 完成（2026-10-23）。剩余 54 个模块级 `const L = LOOKS.x` 的镜头全部接入 `useLook`（camera 9 / effects 11 / interaction 7 / rhythm 4 / transition 13 / ui-entrance 10）。改造脚本分三步：① import 补 `useLook` + 主组件首行插 `const L = useLook('x')` + 删模块级 `const L = LOOKS.x`；② 模块级 L 派生色常量（`GOLD/ACC/TERRA/INK/NAVY/...` 约 19 处）下沉到组件内 `const L` 之后；③ 引用 `L.` 的模块级 helper 与组件内 indented 常量各自补自有 `useLook`（共 ~180 处），避免 TDZ/未定义引用。16 个文件初版出现 `useLook` 插入 `=> (` 箭头表达式体内部的语法错误，已用 `fix_paren.py` 31 处全部修正（把声明挪到表达式体之后）。终态：54 文件 TS 解析 0 诊断、无模块级 `const L = LOOKS`、无首个 `useLook` 之前的模块级 `L.` 引用。registry 重生成后 **77/151 镜头有配色键**（此前 23）；`npm run test:shots` 5/5；`npm run typecheck` 0 shots 错误（16 个工作区基线错误与本批次无关）。
- [x] **1.6 检查器配色页签全量开放** ✅ 完成（2026-10-23）。`getShotSchema` 在「标签 ∩ editableKeys」之后**独立追加**该镜头真实消费的标准配色字段组：`editableKeys ∩ STYLE_FIELD_ORDER`（colorTheme / customBg / customInk / customPanel / customPrimary / customSecondary，键序与 LOOK_COLOR_KEYS 一致），每个键由 `buildStyleField()` 生成 `category: 'style'` 的标准字段；`opening/text-as-mask` 精确登记的 6 个配色字段走同一追加通道（去重，不再重复登记）。`features.hasText/hasImageSlot` 改为只由文案/图片槽字段驱动，纯配色镜头不再被标成 hasText。诚实提示门控 `schema.fields.length === 0` 因此自动放行——纯配色镜头现在 fields = 6 个配色字段，能看到「视觉配色」页签（6 色盘卡 + 5 拾色器，渲染逻辑原本就与 schema 无关，无需改动）。`npm run test:shots` 6/6 通过；typecheck 0 shots 错误（16 个工作区基线错误不变）。
- [x] **1.7 每批验收**：`npm run verify:shots --all` 镜头渲染 151/151 通过、无 inkRatio 空白；追加 `--colors` 改色抽查通道（同帧渲染 默认 / colorTheme=ember / customPrimary=#ff00aa，比较像素差异比例），批次 B/C/D 各 ≥3 个镜头实测生效（B：crane-rise-reveal、dataviz-landscape-open、spotlight-hero-card；C：blur-slide、chart-live-moves~AxisRescaleShockV2、flying-words；D：carousel-3d、terminal-3d、scanline-annotate-focus、card-stack、line-carry-transition）。批次 A 为单镜头样板。

**注意**：91 个导入 LOOKS 的文件之外，其余约 60 个镜头自带色板——不强做，逐个评估工作量后决定是否纳入，宁缺毋滥。

---

## 7. 阶段 2：文案逐镜头接参（已完成，分批）

每镜头标准动作（模板）：
1. 找出最显眼的标题类硬编码字符串（页头/卡片头/品牌行）。
2. 改为 `useShotProp('key', 原值)`，默认值=原值保证默认画面零变化。
3. `SPECIFIC_SHOT_SCHEMAS` 补条目：中文标签 + `maxLength` + 占位提示。
4. 跑 `verify:shots` + shot-check 抽查。

批次与优先级：

- [x] **2.A opening（10，除样板9个）**：`dataviz-landscape-open`、`fracture`、`icon-field-colorize`、`magician-card-flourish`、`orbit-ring-title-open`、`stroke-segment-build`、`text-as-mask`、`spotlight-hero-card`、`crane-rise-reveal` 已接文案键；`letterspace-materialize` 为固定字形描边字标（`GLYPHS` 手绘路径），无自由文本槽，如实跳过。
- [x] **2.B outro（8）**：`grain-dissolve`、`neon-triple-marquee`、`outro-group-photo-launch`、`ui-strip-away-outro`、`ui-to-brand-morph~IconFlipBloomLogo`、`ui-to-brand-morph~InputMorphsIntoLogo`、`logo-shrink-wordmark-lockup` 全部完成。
- [x] **2.C typography（25）**：23 个有文案的镜头全部接参（含 `flying-words`、`outline-word-fill`、`gradient-word-sweep`、`marker-underline-title`、`title-demote-to-label`、`typewriter-moves`、`type-rhythm-sync~KaraokeFillSync` 等）；`pill-*` 两个纯色块槽位镜头按"无自由文案"处理。
- [x] **2.D ui-entrance（23）+ interaction（12）**：ui-entrance 20 个接参（`page-waterfall-wall`、`radial-wave`、`row-embed`、`wall-reveal-moves~WireframeDrawOn` 为截图/纯图形，跳过）；interaction 13 个全部接参。
- [x] **2.E data（6）+ effects（10）+ rhythm（8）**：data 8 个、rhythm 7 个（`rhythm-interrupt-moves` 纯画面无文案，跳过）、effects 19 个（`glow-flyline-moves~FlylineArc`、`impact-feedback~AnimeImpact`、`spotlight-sweep-moves~GlowWakeSleepPanel`、`SlideSpotlightPan` 为纯图形/线框占位，跳过）全部完成。
- [x] **2.F camera（13）+ transition（22）**：camera 13 个、transition 18 个完成；`camera/space-camera-moves~DroneDiveLanding` 纯航拍画面无文案，跳过。
- [x] **2.G 收尾**：`talk-shot-catalog.ts` 的 `demoReasons` 改为按 `editableKeys` 如实分流——已消费文案参数的镜头不再被说成"没有参数入口"，改为说明仍保留示例数据/固定布局/仅横屏；口播放行策略未扩大。

**批次完成判据**：该批每镜头——默认帧零变化、schema 无假字段、verify:shots 通过。

---

## 8. 阶段 3：中文化与画幅底线（伴随阶段 2，已完成）

- [x] **3.1 字数上限**：`ShotParamField` 新增 `maxLength`；本轮新增的每个 text 字段都带上限（中文按字符数，`Array.from()` 计数），检查器在输入框下方显示 `已用/上限` 并在超限时内联提示"建议精简"，**不静默截断**。
- [x] **3.2 溢出风险标注**：凡固定 1920×1080 + 绝对定位的文案字段，`description` 均写明"建议 ≤N 字/字符，超出可能出画（仅横屏）"，并注明字数变化会影响哪些时序（如逐字脉冲对称中心、打字删除帧）。
- [x] **3.3 画幅诚实标注**：动效库卡片右上角常驻「仅横屏」角标（tooltip 说明 1920×1080 构图、9:16 未适配）；检查器文案页签顶部同样提示。9:16 适配仍需单独立项，本计划不承诺。
- [x] **3.4 品牌标处理规范**：`_fixtures/Brand.tsx` 的 `ShotcraftMark` / `ShotcraftWordmark` 已是 `() => null`（第三方水印已彻底移除，`BRAND.name/short` 为空），因此**没有可被误当品牌露出的图形**；需要字标的镜头改为暴露 `brand` 文本文案键（默认空），不再假装有 `showBrandMark` 开关（样板 `crane-rise-reveal` 保留该开关，因为它的布局为此留了位）。任何批次都不宣称"可发布"。

---

## 9. 验收与回归工具（持续使用）

| 工具 | 用途 | 何时跑 |
|---|---|---|
| `npm run verify:shots --all` | headless 渲染中段帧 + inkRatio 抓空白 | 每批改完 |
| `/workbench/shot-check`（DEV） | 缩略图网格人工目检 | 每批改完 |
| 阶段 0.5 新测试 | schema 键 ⊆ 组件真实 `useShotProp` | 每次改 schema/组件 |
| 手动清单 | 改值→画面变→撤销→恢复 | 样板 + 每批抽查 ≥3 个 |

---

## 10. 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| 145 个文件逐项工作量超预期 | 阶段 2 拖长 | 严格分批交付；无文字镜头不强做；每批独立可验收 |
| 改动破坏默认出帧 | 回归 | 默认值=原值原则 + verify:shots inkRatio 对照 |
| 原始 demo 纹理/品牌许可 | 合规 | `showBrandMark` 开关 + 不默认宣称可发布（MIGRATION_PROVENANCE） |
| 中文长文案溢出 | 观感 | 3.1/3.2 字数上限与提示 |
| `useLook` 深合并性能 | 预览帧率 | memo 化；`ShotPropsContext` 已是稳定引用（frame-context.tsx 注释有先例） |

---

## 11. 执行进度（每次更新本节）

**最后更新：2026-10-23**

| 里程碑 | 状态 | 进度 | 备注 |
|---|---|---|---|
| 诊断与方案设计 | ✅ 完成 | — | 根因、证据链、ground truth 清单见 §1 |
| 本计划文档 | ✅ 完成 | — | `docs/shot-editability-plan.md` |
| 阶段 0 止血（§4） | ✅ 完成 | 6/6 | 0.1–0.6 全部完成；`npm run test:shots` 4/4 通过；typecheck 无新增错误（13 个为工作区基线既有） |
| 样板 crane-rise-reveal（§5） | ✅ 完成 | 5/5 | useLook + 5 文案键 + schema 登记完成；test:shots 5/5 通过 |
| 阶段 1 配色批量（§6） | ✅ 完成 | 7/7 | useLook 已实现；批次 A（样板）/B（opening 10 个）/C（typography+data 15 个）/D（其余 54 个）已完成，**77/151 镜头有配色键**（其余镜头自带独立色板，按计划不强做）；1.6 检查器配色页签全量开放；1.7 全量真实 Chrome 渲染 151/151 通过、无 inkRatio 空白，并新增 `--colors` 抽查通道，B/C/D 各 ≥3 个镜头实测改色生效 |
| 阶段 2 文案分批（§7） | ✅ 完成 | 7/7 | 2.A–2.F 全部完成：约 120 个镜头接入 `useShotProp` 文案键（默认值=原字面量，保证默认帧零变化），约 20 个镜头经核查为纯图形/截图/固定字形而无自由文案，如实跳过并记录理由；2.G 已按新现状修订 `talk-shot-catalog.ts` 的 `demoReasons` |
| 阶段 3 中文/画幅（§8） | ✅ 完成 | 4/4 | 3.1 `maxLength` + 检查器字符计数/超限提示；3.2 每个新字段的 `description` 都写了字数建议与溢出风险；3.3 动效库卡片「仅横屏」角标 + 检查器提示；3.4 品牌标已彻底置空（`ShotcraftMark → null`），需要字标处改为可编辑 `brand` 文本键，不假装有开关 |

**代码改动记录**

| 日期 | 改动 | 结果 |
|---|---|---|
| 2026-10-23 | 阶段 0.1–0.6：`scripts/lib/shot-editable-keys.mjs`（新）、`scripts/generate-shot-registry.mjs`（+editableKeys/importPath）、`registry.generated.ts`（重生成）、`shot-schemas.ts`（废除假字段）、`ShotInspectorSection.tsx`（诚实提示）、`ShotLibraryPanel.tsx`（角标）、`shot-schema-truth.test.mjs`（新，test:shots）、`docs/video-factory.md`、`talk-shot-catalog.ts` | `npm run test:shots` 4/4 通过；`npm run typecheck` 无新增错误 |
| 2026-10-23 | 样板 crane-rise-reveal：`_fixtures/Look.tsx` 实现 `useLook`、`CraneRiseReveal.tsx` 接入配色+5 文案键、`shot-schemas.ts` 登记 schema、`shot-schema-truth.test.mjs` 更新断言 | `npm run test:shots` 5/5 通过；`npm run typecheck` 无新增错误 |
| 2026-10-23 | `npm run verify:shots -- --only opening/crane-rise-reveal`（真实 Chrome 管线） | ✅ 通过 10/10（管线在真实浏览器成功出帧，inkRatio 正常）；面板数据/拖动/导出带音频等附带失败为既有功能缺陷，非本次改动引入 |
| 2026-10-23 | 修正 CraneRiseReveal 重复 HEAD_TRIG 常量；useLook 支持 6 个 UI 色盘名映射 | test:shots 5/5；typecheck 无新增错误 |
| 2026-10-23 | 批次 B：opening 10 个镜头全部接入 `useLook`（DatavizLandscapeOpen/IconFieldColorize/MagicianCardFlourish/OrbitRingTitleOpen/SpotlightHeroCard/StrokeSegmentBuild/TextAsMask/CraneRiseReveal）；`shot-editable-keys.mjs` 识别 useLook 调用自动补 6 个配色键 | `npm run test:shots` 5/5 通过；注册表 12/151 镜头有可编辑键 |
| 2026-10-23 | 批次 C：typography 11 个 + data 4 个（共 15 文件）接入 `useLook`；模块级派生色常量 `SEL/GRAD/GOLD/ACC/INK/TRACE` 下沉组件内；registry 重生成 | `npm run test:shots` 5/5 通过；注册表 23/151 镜头有配色键；`npm run typecheck` 仅剩工作区基线既有错误（timeline/insert-track-defaults/TalkWorkspace 等 15 个，非本批次引入） |
| 2026-10-23 | 批次 C 作用域修复：`TitleDemoteToLabel` 的模块级 `Title` 补 `const L = useLook('paper')` + 局部 `SEL`；`FontWeightPump` 的 `GRAD`、`WordRelayGeometry` 的 `GOLD` 从 helper 之后前移到 `const L = useLook(...)` 之后（消除 TDZ/未定义引用）；删除原组件尾部冗余声明 | `npm run test:shots` 5/5 通过；三文件 TS 解析 0 诊断；typecheck 无 shots 相关错误（仅剩 16 个既有基线错误，其中一个为 VideoFactoryPage `project` 未定义的既有错误） |
| 2026-10-23 | 批次 D：54 个文件接入 `useLook`（camera 9 / effects 11 / interaction 7 / rhythm 4 / transition 13 / ui-entrance 10）；模块级 L 派生色常量下沉组件内；~180 处 helper/局部常量补自有 `useLook`；`fix_paren.py` 修正 31 处 `useLook` 误插入 `=> (` 表达式体的语法错误；registry 重生成 | 54 文件 TS 解析 0 诊断；无残留模块级 `const L = LOOKS`；`npm run test:shots` 5/5 通过；注册表 **77/151** 镜头有配色键（此前 23）；typecheck 0 shots 错误（16 个既有基线错误不变） |
| 2026-10-23 | 1.6 检查器配色页签全量开放：`shot-schemas.ts` 的 `getShotSchema` 追加标准配色字段组（`editableKeys ∩ STYLE_FIELD_ORDER` → `buildStyleField`，`category: 'style'`，text-as-mask 精确登记走同通道去重）；`features.hasText/hasImageSlot` 只由文案/图片槽字段驱动；`shot-schema-truth.test.mjs` 更新 2 处断言（circle-match-iris → 6 配色字段 + 新增独立通道断言；crane-rise-reveal → 11 字段） | `npm run test:shots` **6/6** 通过；纯配色镜头（如 circle-match-iris）诚实提示门控自动放行，可进「视觉配色」页签改色 |
| 2026-10-23 | 阶段 1.7 首轮全量真实 Chrome 渲染：修复已确认的 BrandFrameSnap / PanelToCanvasMaterialize / ImpactBurstKit / ExplodedView / ScanlineAssembleFlyin 组件 hook 作用域及重复声明；当前继续修复首轮结果中的剩余具体镜头错误 | `npm run verify:shots -- --all` 136/151 通过，15 失败、8 空白帧；targeted Vite build 已从入口转换失败推进到全图编译成功，后续全量结果待复验 |
| 2026-10-23 | 阶段 1.7 第二轮全量真实 Chrome 渲染；OverheadTabletopDrop / Terminal3D / AssembleThenTypeFlyin / OrbFlylineRelay / RadialRipplePhoneChips / ScoreSlam 等组件 hook 与常量作用域修复；Basic3DScene 修复后续验证发现的 `GOLD` 局部引用 | `npm run verify:shots -- --all` 148/151 通过，3 个渲染报错、10 个 inkRatio 空白；当前继续修复并待第三轮复验 |
| 2026-10-23 | 阶段 1.7 最终作用域修复：AutolayoutGapDial 的 `BLOCK_WIDTHS/GOLD`、QuadSplitParallelScenes 的 `ORANGE`、DiagramCascadeBuild 的 `A1/A2`、Carousel3D 的 `L`、CardStack 的 `L`、ScanlineAnnotateFocus 的 `MACHINE/MONO`、CardFlockTumble 的共享时间常量改回可见作用域；并修复 BrandFrameSnap / PanelToCanvasMaterialize / ImpactBurstKit 的组件 hook 重复声明 | `node parsecheck.mjs` 0 诊断；targeted Vite build 通过；`npm run test:shots` 6/6；`npm run verify:shots -- --all` 镜头渲染 151/151、无空白帧；命令整体 exit 1 仅因已有编辑器面板/拖动/编码附属检查失败（逐项见终端输出），非镜头帧回归。尚待检查器实时改色抽查 |

| 2026-10-23 | 阶段 2 全批（2.A–2.F）文案接参：约 120 个镜头组件在组件体内加 `useShotProp('key', 原字面量)` 并把 JSX 字面量替换为变量；`_fixtures/Look.tsx` 补 `useShotProp` 再导出（多个镜头文件已按此路径引入）；`shot-schemas.ts` 追加 ~110 条中文标签 + `maxLength` + 溢出/画幅说明；registry 重生成 | `node parsecheck.mjs` 0 诊断；targeted Vite build 通过（修掉 IconFieldColorize 的 `title` 命名冲突与 Fracture 组件缺 `};`）；`npm run test:shots` 6/6；`npm run verify:shots -- --all` 151/151 出帧、无空白帧 |
| 2026-10-23 | 阶段 3：`ShotParamField.maxLength` 类型 + 检查器字符计数与超限提示（`Array.from` 计中文）；文案页签顶部与动效库卡片「仅横屏」标注；`talk-shot-catalog.ts` 按 `editableKeys` 如实分流 `demoReasons` | 构建通过；`npm run test:shots` 6/6 |
| 2026-10-23 | 阶段 1.7 改色抽查通道：`verify-entry.tsx` 新增 `window.__shotVerifyColorCheck`（同帧渲染 默认 / colorTheme=ember / customPrimary=#ff00aa 并算像素差异），`scripts/verify-shot-render.mjs` 新增 `--colors id1,id2` | B/C/D 各 ≥3 个镜头实测：crane-rise-reveal(1/0.004)、dataviz-landscape-open(0.476/0.416)、flying-words(0.967/0.336)、blur-slide(1/0.366)、AxisRescaleShockV2(1/0.219)、carousel-3d(0.343/0.303)、terminal-3d(0.037/0.031)、scanline-annotate-focus(0.497/0.22)、card-stack(0.889/0.381)、line-carry-transition(1/0.247)；同时暴露 `typography/marker-underline-title` 为独立色板镜头（无配色键，符合 §6 的口径） |

**下一步行动**：本期计划（阶段 0–3）全部完成。剩余两项已另立计划：[`docs/shot-color-coverage-and-vertical-plan.md`](./shot-color-coverage-and-vertical-plan.md)（余下 74 个自带色板镜头接入 `usePalette`、竖屏 9:16 适配）。口播内容版白名单是否扩大仍由用户决定。附属校验里 `面板数据/片段拖动/导出带音频/整页装配` 的失败是编辑器既有缺陷（与镜头可编辑性无关），未在本计划范围内处理。

**进度更新方法**：完成任务勾选对应 `- [ ]` → 改 `- [x]`；更新 §11 表格状态/进度/日期；批次类任务在"代码改动记录"表追加一行（日期 / 批次号 / verify:shots 结果）。
