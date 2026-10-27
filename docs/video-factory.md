# 视频工厂（Video Factory）实现方案

> 参考项目：`video-shotcraft`（Apache-2.0，commit `43bd349`）。
> 本文件是实现的唯一依据。

---

## 0. 目标

1. **新建「视频工厂」页面**：纯浏览器剪辑台，左库 → 中舞台 → 右属性 → 下多轨时间轴。
2. **移植参考项目 152 个动效 demo**，成为可拖上时间轴的镜头库。
3. **用这套能力升级 IP 口播视频**：IP 页复用同一批镜头与同一套渲染器。

---

## 1. 已定决策

| # | 问题 | 决定 |
|---|---|---|
| D1 | 动效档位 | **152 个全部移植、全部可用**。差异只体现在卡片角标 `高保真 / 近似` |
| D2 | AI 选镜头 | **不做**。用确定性规则映射（标点分段 + 信息密度 + 配方） |
| D3 | IP 与工厂工程隔离 | 两边复用编辑器能力，工程与素材分库存储；无同工程继续精修入口 |
| D4 | 音效 | **全部实现**：149 SFX + 5 BGM 全量进库、可拖轨、可调包络、导出带声音 |
| D5 | 资源许可 | **本轮先不考虑**，优先让功能跑通；商用前再逐条核对 |

---

## 2. 移植可行性（实测）

| 指标 | 实测值 |
|---|---|
| demo 文件数 | 上游 **152 个 `.tsx`**，去重后登记 **151 个镜头**（`VerticalTicker.tsx` 是内部依赖，不是独立镜头；`crash-zoom-punch` 等 3 个目录含 2 个 demo） |
| 总代码量 | 39,102 行，均 257 行，最大 653 行 |
| **Remotion API 种类** | **15 个**（见 §3.2） |
| `@remotion/three` / `three` | **0 处**被 demo 使用 |
| `@remotion/google-fonts` | **0** |
| `Math.random` | 3 处（已替换为确定性 `random()`） |
| `Date.now` / `new Date` | **0** |
| 导出 `*_DURATION` | 139 个直接给数字；其余 12 个是表达式（`DUR`、`INTRO + CYCLES * BEAT + FIN + 48`），注册表生成器会做简单算术求值 |
| 依赖 `staticFile` 纹理 | 16 个 demo |

**结论**：策略是「**写 Remotion 兼容 shim + 逐字搬运源码**」，不是用 Canvas2D 重写。

### 2.1 为什么不用 Canvas2D 重写

demos 的视觉几乎全靠 CSS：

| CSS 能力 | 次数 | CSS 能力 | 次数 |
|---|---|---|---|
| `boxShadow` | 424 | `maskImage` | 83 |
| `linear-gradient` | 416 | `mixBlendMode` | 65 |
| `radial-gradient` | 257 | `perspective`/`rotateX/Y` | 109 |
| `filter:` | 241 | `clipPath` | 56 |

Canvas2D 无法表达，重写只会得到"像但不对"的廉价版本。保留 DOM/SVG 渲染是保住质感的前提。

---

## 3. 技术方案：Remotion 兼容运行时

### 3.1 原理

demos 是"给定帧号的纯函数组件"。提供同名 API 的本地实现后，源码**一行不改**跑在浏览器里：

```
video-shotcraft 源码（逐字复制）
        │  import { useCurrentFrame, interpolate, ... } from 'remotion'
        ▼
demos/runtime（本地 shim，同名同签名）
        │
        ▼
帧号 ──► React 渲染 ──► DOM/SVG ──► html-to-image 光栅化 ──► Canvas2D ──► mediabunny
```

### 3.2 shim 清单（15 个 API，实测修正）

初次统计漏了 4 个：`delayRender` / `continueRender` / `getRemotionEnvironment` / `CameraMotionBlur`。
前三个只有在真跑构建时才会暴露 —— `@ts-nocheck` 跳过了类型检查，错误直到 Rollup 解析具名导入才出现。
**结论：统计 demo 的 API 面必须用打包器验证，不能只靠正则手数。**

| API | 用量 | 文件 |
|---|---|---|
| `useCurrentFrame` | 148 | `runtime/frame-context.tsx` |
| `AbsoluteFill` | 131 | `runtime/absolute-fill.tsx` |
| `interpolate` | 56 | `runtime/interpolate.ts` |
| `Easing` | 43 | `runtime/interpolate.ts` |
| `staticFile` | 16 | `runtime/assets.tsx` |
| `Img` | 14 | `runtime/assets.tsx` |
| `useVideoConfig` | 10 | `runtime/frame-context.tsx` |
| `spring` | 9 | `runtime/interpolate.ts` |
| `CameraMotionBlur` | 4 | `runtime/motion-blur.tsx`（来自 `@remotion/motion-blur`） |
| `Freeze` | 3 | `runtime/absolute-fill.tsx` |
| `Sequence` | 2 | `runtime/absolute-fill.tsx` |
| `OffthreadVideo` | 1 | `runtime/video.tsx`（仅供 `ClipCard`） |
| `delayRender` | 1 | `runtime/render-gate.ts` |
| `continueRender` | 1 | `runtime/render-gate.ts` |
| `getRemotionEnvironment` | 1 | `runtime/render-gate.ts` |

**`delayRender` 为什么必须实现**：`typography/lead-word-zoom-assemble` 用它挂起渲染，
等它量完真实 DOM 文本宽度再 `continueRender`。若不实现，该镜头永远停在 `opacity: 0`，
导出的就是一帧空白 —— 而且**不报错**，是最难发现的一类失败。
管线在截图前 `await waitForRenderGate()`，并设 6 秒超时（宁可有警告也不能永久卡死）。

**边界规则**：`runtime/` 内禁止 import `remotion` 真包，只允许 `react` / `react-dom`。

### 3.3 插值与缓动（核心难点）

必须覆盖的真实用法：

| API | 用法 | 次数 |
|---|---|---|
| `interpolate(input, inputRange, outputRange, opts)` | 2 段值 + `extrapolateLeft/Right:'clamp'` + `easing` | 54 |
| `Easing.out(Easing.cubic)` | 标准缓出 | 38 |
| `Easing.out(Easing.quad)` | — | 21 |
| `Easing.bezier(x1,y1,x2,y2)` | 11 组不同参数 | 51 |
| `Easing.inOut(Easing.cubic)` | — | 8 |
| `Easing.inOut(Easing.quad)` | — | 7 |
| `Easing.out(Easing.back(1.4))` | 过冲 | 6 |
| `Easing.in(Easing.cubic)` / `(quad)` | — | 8 |
| `Easing.out(Easing.poly(4))` / `poly(5)` | 幂函数 | 3 |
| `Easing.inOut(Easing.sin)` / `in(sin)` | — | 3 |
| `Easing.linear` | — | 2 |
| `spring({frame, fps, config, durationInFrames?, durationRestThreshold?})` | 阻尼弹簧 | 9 |

实现要点：

- `Easing` 必须是**可组合的高阶函数**：`Easing.out(fn) = t => 1 - fn(1 - t)`，`Easing.in(fn) = t => fn(t)`，`Easing.inOut(fn)` 按 0.5 分段。写成"枚举常量"会让 152 个动效全崩——这是最容易出错的地方。
- `Easing.bezier` 用 Newton-Raphson 求 t，可照抄 `shots/_fixtures/Polish.tsx` 的 `bezier` 实现（已实测可用）。
- `spring` 必须是物理积分，`config:{damping, stiffness, mass}` 三参数都要生效，否则 9 个 demo 的节奏全错。

### 3.4 帧渲染管线

`demos/pipeline/dom-frame-renderer.ts`：

```ts
export type DomFrameRenderer = {
  renderFrame(frame: number): Promise<HTMLCanvasElement>
  dispose(): void
}
export function createDomFrameRenderer(input: {
  load: () => Promise<React.ComponentType>
  width: number; height: number; fps: number; durationInFrames: number
  assetBase: string
}): DomFrameRenderer
```

流程（**顺序不可调换**，错了就截到空白或错字）：
隐藏容器挂载 → `createRoot().render()` → `nextPaint` → `document.fonts.ready` → `waitForImages` → `waitForRenderGate` → `nextPaint` → `htmlToImage.toCanvas(node, { width, height, pixelRatio: 1, cacheBust: false, skipFonts: true })` → 返回 canvas。

必须处理的细节：

1. **字体**：渲染前必须 `document.fonts.ready`，否则首帧字形错乱。
2. **`pixelRatio: 1`**：否则按设备 DPR 放大，导出尺寸不对。
3. **`cacheBust: false`**：每帧带时间戳会让图片重新请求。
4. **DOM 尺寸固定** + `overflow:hidden`，不依赖外部布局。容器用 `left:-100000px` 移出视口，
   **不能**用 `display:none`（那样 `html-to-image` 量不到尺寸）。
5. **`skipFonts: true`**：字体已在页面加载，每帧内联字体数据会拖垮性能。
6. **串行队列**：同一时刻只渲染一帧，避免 React 并发渲染互相打断。
7. **`resetRenderGate()` 在每帧开始前调用**：有的 demo 只在挂载时 `delayRender` 一次，
   不清掉遗留的闸门，第二帧就会一直等一个永远不会再关闭的门。

### 3.5 与现有渲染器的关系

| 层级 | 适用 | 渲染方式 |
|---|---|---|
| L1 文本/图形组件 | `catalog.ts` 的 32 组件 | Canvas2D 原生（现有 `renderers.ts`） |
| L2 动效镜头 | 151 个移植 demo | DOM/SVG → 光栅化 |
| L3 用户素材 | 视频/图片/音频 | Canvas2D `drawImage`（现有） |

`compositor.ts` 按元素类型分派。**它必须保持同步**（预览每帧都调它），
所以镜头帧先由调用方异步准备好，再通过注入的 `shotFrameResolver({ elementId, shotId, localTimeUs, durationUs })`
同步取用。预览（`PlayerSurface`）与导出（`ExportController`）注入的是同一个 `ShotFrameCache`，
只有分辨率不同 —— 这样「预览＝成片」是结构性保证，不是靠两处代码自觉对齐。

**按 `elementId` 而非 `shotId` 索引镜头帧**：同一镜头可以在同一帧出现两次
（不同 `rate` 或裁剪），按 `shotId` 索引会串帧。

---

## 4. 目录结构（已落地）

```
packages/video-editor/src/demos/
├── runtime/                  # Remotion 兼容 shim（15 个 API）
│   ├── index.ts              ✅ 统一出口
│   ├── frame-context.tsx     ✅ useCurrentFrame / useVideoConfig / useT / FrameProvider
│   ├── absolute-fill.tsx     ✅ AbsoluteFill / Sequence / Freeze
│   ├── interpolate.ts        ✅ interpolate / Easing / spring / bezier
│   ├── assets.tsx            ✅ staticFile / Img / waitForImages
│   ├── video.tsx             ✅ OffthreadVideo（仅 ClipCard 用）
│   ├── motion-blur.tsx       ✅ CameraMotionBlur（4 个 demo）
│   ├── render-gate.ts        ✅ delayRender / continueRender / getRemotionEnvironment
│   └── determinism.ts        ✅ mulberry32 PRNG
├── pipeline/
│   └── dom-frame-renderer.ts ✅ DOM 光栅化管线
├── shots/                    ✅ 151 个 demo 源码（10 分类，逐字复制）
│   ├── _fixtures/            ✅ 6 个共享件（Motion/Polish/Brand/Look/Fixtures/PageCam2D）
│   ├── _textures/            ✅ 25 个纹理（live-layout.json 等）
│   ├── camera/ (14)  data/ (9)  effects/ (23)  interaction/ (13)
│   ├── opening/ (10) outro/ (7) rhythm/ (8)   transition/ (18)
│   └── typography/ (25)  ui-entrance/ (24)
├── assets/lib/               ✅ ClipCard / VerticalTicker 等 12 个公共件
└── registry.generated.ts     ✅ 构建时生成，禁止手改（151 条）

packages/video-editor/src/render/
└── shot-cache.ts             ✅ 预览 LRU + 导出全分辨率 + resolveShotFrame

packages/video-editor/src/media/
├── pcm.ts                    ✅ 解码 / 包络 / 软限幅
├── audio-mixer.ts            ✅ mixDocumentAudio 多轨混音
├── audio-playback.ts         ✅ AudioMixPlayback 预览同步
├── insert-audio.ts           ✅ 音频元素插入
├── probe-audio.ts            ✅ 时长探测
└── audio-manifest.generated.ts ✅ 149 SFX + 5 BGM

packages/video-editor/public/
├── sfx/<16 类>/*.mp3         ✅ 149 个
├── bgm/*.mp3                 ✅ 5 首
└── demos/textures/live/*     ✅ 25 个（注意在 live/ 子目录下，与 staticFile 路径一致）

src/features/video-factory/
├── VideoFactoryPage.tsx      ✅ 页面骨架与三栏装配
├── FactoryToolbar.tsx        ✅ `VideoFactoryPageChrome`（挂 `Page` actions / workbench-tool 顶栏）
├── QuickAssemblyWizard.tsx   ✅ 两步向导
├── lib/use-factory-project.ts ✅ 工程加载 + 800ms 防抖自动保存
├── lib/use-preview-audio.ts  ✅ 预览实时混音播放
├── lib/segment-script.ts     ✅ 文案分段（纯算法）
├── lib/map-shots.ts          ✅ 段落→镜头（确定性规则）
├── lib/insert-audio.ts       ✅ 音频插入薄封装
├── lib/upload-asset.ts       ✅ 素材上传
├── lib/demo-document.ts      ✅ 演示工程
└── dev/ShotCheckPage.tsx     ✅ DEV-only 镜头渲染自检（/workbench/shot-check）

scripts/
├── rewrite-demo-imports.mjs  ✅ demo import → 本地 runtime + @ts-nocheck + 去 Math.random
├── generate-shot-registry.mjs ✅ 注册表生成（缺时长硬失败）
├── generate-audio-manifest.mjs ✅ 音频清单生成
└── vite-plugin-video-editor-assets.mjs ✅ /demos/* 与 /video-editor/* 资源路由
```

**import 路径已对齐**：shots 全部位于 `shots/<category>/<name>/`，因此 `../../_fixtures/x`、`../../_textures/x` 天然正确。`rewrite-demo-imports.mjs` 只改三类：`from 'remotion'` → 本地 runtime、`from '@remotion/motion-blur'` → 本地 runtime、`Math.random()` → 确定性 `random()`。

**两个必须知道的构建细节**：

1. **`@ts-nocheck`**：移植文件逐字来自上游，不打算二次改造。项目级 `noUnusedLocals` 之类规则检查它们只会产生噪音，因此整文件跳过类型检查。代价是**类型错误会被推迟到 Rollup 解析阶段** —— 例如 `interface` 被当作值导入（`CamKey2D` / `TickerColumn`）在 `tsc` 阶段通过，打包时才报 `is not exported by`。
2. **`interface` 必须用 `import type`**：`PageCam2D.tsx` 的 `CamKey2D`、`VerticalTicker.tsx` 的 `TickerColumn` 都是类型。5 个文件需改写。

---

## 5. 数据模型变更

### 5.1 新增元素类型：动效镜头

`core/project.ts`：

```ts
export type ShotClipElement = BaseElement & {
  type: 'shot'
  shotId: string                    // 'opening/spotlight-hero-card'
  sourceDurationFrames: number
  slots?: Record<string, string>
  overrides?: Record<string, string>
  rate: number
  transform: TransformBox
  animations?: ElementAnimations
}
```

`TrackElement` 追加 `ShotClipElement`，`TrackType` 追加 `'shot'`。

**兼容性**：不升 `schemaVersion`，旧工程照常读。`schema.ts` 校验 `shotId` 在注册表内、`sourceDurationFrames > 0`、`rate ∈ [0.25, 4]`。

### 5.2 镜头注册表（自动生成）

`demos/registry.generated.ts`：

```ts
export type ShotDefinition = {
  shotId: string           // 'opening/spotlight-hero-card'
  category: string
  name: string
  summary: string
  durationInFrames: number
  defaults: { fps: number; width: number; height: number }
  load: () => Promise<{ default: React.ComponentType } | Record<string, React.ComponentType>>
  fidelity: 'high' | 'approx'   // CameraMotionBlur 的 4 个标 approx
  editableKeys: readonly string[] // 组件源码中真实调用 useShotProp('key') 的键（升序）；空 = 演示固定场景
  importPath: string             // 组件源码位置（相对 demos/，无扩展名），供工具侧静态分析
}
```

**editableKeys 是可编辑性的唯一真值**（2026-10-23 阶段 0 引入）：由 `scripts/lib/shot-editable-keys.mjs` 的 `extractEditableKeys` 从组件源码机械提取，生成脚本与回归测试（`npm run test:shots`）共用同一口径。`shot-schemas.ts` 的 `getShotSchema()` 只返回「标签 ∩ editableKeys」——检查器里出现的每个字段都保证写入 overrides 后被渲染消费，分类兜底推导的假字段已在入口处物理拦截。**阶段 1（2026-10-23）起**，组件内出现 `useLook(` 调用时扫描口径自动补上 6 个配色键（`colorTheme` + 5 路 `custom*`），`getShotSchema` 再把 `editableKeys ∩` 标准配色键独立追加为 `style` 字段组——纯配色镜头因此能进检查器「视觉配色」页签，不再被诚实提示卡整体挡住。改造计划与进度看板见 `docs/shot-editability-plan.md`。

生成脚本 `scripts/generate-shot-registry.mjs`：

1. 扫描 `demos/shots/**/*.tsx`
2. 抽取 `export const (\w+)_DURATION\s*=\s*(\d+)`（139 个命中）
3. 剩余 13 个从 `gallery/api/library.json` 的 `duration` 解析帧数
4. 抽取导出组件名（`export const (\w+): React.FC`）
5. 合并 `summary` / `category`
6. 产出 `registry.generated.ts`

**硬校验**：任一条缺 `durationInFrames` 即 `process.exit(1)`。挂到 `predev` / `prebuild`。

---

## 6. 音效与音乐

### 6.1 两条链路的音频现状（实测）

| 链路 | 编码器 | 音频轨 | 结论 |
|---|---|---|---|
| **IP 口播视频** | `ip-video/lib/encoding/offline.ts` | ✅ `AudioSampleSource` + `addAudioTrack()`，逐帧交错写 ≤1/30 秒 planar PCM | **已有，可移植** |
| **视频工厂** | `packages/video-editor/src/media/mediabunny-adapter.ts` | ❌ 只有 `addVideoTrack` | **缺失，需接入** |
| 其他入口 | `panels/export/ExportPanel.tsx` → 同一 adapter | ❌ 导出无声 | 随工厂一起修 |

**可复用的现成实现**：

| 能力 | 位置 |
|---|---|
| PCM 解码（音频 Blob → planar Float32） | `ip-video/lib/encoding/audio.ts` 的 `decodeAudioPCM` |
| `PCM` 类型与 48kHz 常量 | `ip-video/lib/encoding/policy.ts` |
| 逐帧交错写音频样本 | `ip-video/lib/encoding/offline.ts` 第 56–66 行 |
| 编码降级（avc/aac → vp9/opus） | `ip-video/lib/encoding/capabilities.ts` |
| 30Hz RMS 包络 | `ip-video/lib/encoding/audio.ts` 的 `analyzeAudioEnvelope` |

**需要新写的只有两件**：

1. **多轨混音器**（IP 只处理单条音频；工厂要混多条）
2. **预览实时播放**（IP 用 `<audio>`；工厂需 `AudioBufferSourceNode` 同步）

### 6.2 落地方式：抽公共层

| 文件 | 内容 |
|---|---|
| `media/pcm.ts`（新） | `PCM`、`decodeAudioPCM`、`analyzeAudioEnvelope`、`abortable`、`yieldTask` |
| `media/audio-mixer.ts`（新） | `mixDocumentAudio(doc, assets, opts): Promise<PCM>` |
| `media/mediabunny-adapter.ts`（改） | `encodeVideo` 增 `pcm` 入参 + `AudioSampleSource` + `addAudioTrack` |
| `ip-video/lib/encoding/*`（改） | 改引公共层，删除重复实现 |

**降级链**：`avc+aac → MP4`；任一不可用 → `vp9+opus → WebM`；全不可用 → 明确报错，**绝不静默产出无声 MP4**。

### 6.3 音效资产

| 项 | 实测值 |
|---|---|
| SFX | **149 个**（16 类：transition 23 / ui 18 / impact 14 / data 13 / text 13 / camera 10 / light 10 / paper 10 / film 8 / mech 8 / fluid 5 / scifi 5 / counter 4 / glass 4 / crowd 3 / riser 1） |
| BGM | **5 首**（约 24MB） |
| 体积 | 约 32MB |
| 位置 | `packages/video-editor/public/sfx/`、`public/bgm/` |
| 面板 | `panels/audio/SfxLibraryPanel.tsx`：16 类折叠、搜索、试听、拖拽上轨 |

### 6.4 卡点

`features/video-factory/lib/beat-detect.ts`：`OfflineAudioContext` 解码 → 能量包络 → 自相关求 BPM → 节拍网格。面板标注「Web 端估算，误差 ±2 BPM」，吸附默认关闭。

---

## 7. 实现阶段

### 7.0 先行验证 ✅

让 `outro/grain-dissolve`（纯 SVG，无图片依赖、无 CSS 3D、无 motion-blur）出第一帧画面。

**跑通即证明整条路线成立；跑不通则停下改方案，不进入后续阶段。**

落地方式有两个入口，都指向同一条 `createDomFrameRenderer` 管线：

1. `src/features/video-factory/dev/ShotCheckPage.tsx` —— `/workbench/shot-check`（仅 DEV），带缩略图网格，人工看。
2. `verify-shot.html` + `src/features/video-factory/dev/verify-entry.tsx` —— 独立页，不经路由与鉴权，供脚本驱动。

`npm run verify:shots --all` 用真实 headless Chrome 逐镜渲染中段帧，并额外统计**非空像素占比**
（`inkRatio`）—— 这一项专门抓「出帧了但整幅空白」的静默失败，只靠「没抛异常」是抓不到的。

**实测结果（Chrome 155，960×540，跑全部 151 个镜头）**：

| 指标 | 结果 |
|---|---|
| 成功出帧 | **151 / 151** |
| 渲染失败 | 0 |
| 近乎全空白 | 0 |
| 单帧耗时 | 中位 **234ms**，最快 92ms，最慢 4558ms |

最慢的 4558ms 一个是 `lead-word-zoom-assemble` 这类要等 `delayRender` 量 DOM 的镜头
（首次加载字体 + 布局测量）。这决定了导出长片时**必须**给真实进度而不是假进度条。

### 7.1 P0 · Remotion 兼容运行时 ✅

| # | 任务 | 文件 | 难点 | 状态 |
|---|---|---|---|---|
| P0.1 | 帧上下文 | `runtime/frame-context.tsx` | `useCurrentFrame` 被调 148 次，必须零成本；`Sequence` 内返回相对帧 | ✅ |
| P0.2 | 容器与时间轴 | `runtime/absolute-fill.tsx` | `Sequence` 超出范围不渲染；`Freeze` 支持 `active` 且切换不重挂载 | ✅ |
| P0.3 | 插值与缓动 | `runtime/interpolate.ts` | `Easing` 必须是高阶函数；`spring` 必须物理积分 | ✅ |
| P0.4 | 资源与图片 | `runtime/assets.tsx` | 图片未加载完截帧会得到空白 | ✅ |
| P0.5 | 视频元素 | `runtime/video.tsx` | 仅 `ClipCard` 用；`OffthreadVideo` 映射到 `<video>` 并按帧 seek | ✅ |
| P0.6 | 运动模糊 | `runtime/motion-blur.tsx` | 与 Remotion 原版质感不同（卡片标「近似」） | ✅ |
| P0.7 | 确定性随机 | `runtime/determinism.ts` | 替换 3 处 `Math.random` | ✅ |
| P0.8 | 帧渲染管线 | `pipeline/dom-frame-renderer.ts` | 字体 / `pixelRatio` / `cacheBust` / DOM 尺寸 / 闸门 | ✅ |
| P0.9 | 统一出口 | `runtime/index.ts` | demo 的 `import ... from 'remotion'` 改为指向此文件 | ✅ |
| P0.10 | 渲染闸门 | `runtime/render-gate.ts` | `delayRender` 未实现会静默产出空白帧 | ✅ |

**已用真实构建验证**：`npx vite build` 通过，151 个 demo 全部打包成功（168 个 JS chunk / 5.9MB）。

### 7.2 P1 · 镜头注册表与库面板

| # | 任务 | 文件 | 难点 | 状态 |
|---|---|---|---|---|
| P1.1 | 注册表生成脚本 | `scripts/generate-shot-registry.mjs` | 12 个 demo 的时长是表达式，需简单算术求值；一目录多文件时 shotId 用 `~` 去重 | ✅ |
| P1.2 | 镜头库面板 | `panels/shots/ShotLibraryPanel.tsx` | 151 张缩略图不能一次渲染，需 `IntersectionObserver` 懒出图 | ✅ |
| P1.3 | 拖拽协议 | 面板内联 `dataTransfer` | 只传纯 JSON | ✅ |
| P1.4 | 缩略图 IndexedDB 缓存 | — | 跨会话复用缩略图 | ⬜ 本轮不做（每次会话重出图，可接受） |

### 7.3 P2 · 时间轴、合成与音频

| # | 任务 | 文件 | 难点 | 状态 |
|---|---|---|---|---|
| P2.1 | 元素类型与校验 | `core/project.ts`、`core/schema.ts` | 新增分支不破坏旧工程校验 | ✅ |
| P2.2 | 镜头命令 | `core/commands/shot-commands.ts` | `durationUs` 与 `sourceDurationFrames / rate` 必须一致 | ✅ |
| P2.3 | 合成器分派 | `render/compositor.ts` | 必须保持同步；镜头帧由外部注入 | ✅ |
| P2.4 | 帧缓存 | `render/shot-cache.ts` | 低分辨率预览（120MB 预算）+ 导出全分辨率不缓存 | ✅ |
| P2.5 | 导出接入 | `core/export/controller.ts` | 每帧先异步准备镜头帧，再同步合成 | ✅ |
| P2.6 | 片段外观 | `panels/timeline/TimelineClip.tsx` | 镜头占两行（名称 + 时长） | ✅ |
| P2.7 | 公共 PCM 层 | `media/pcm.ts` | 只搬音频相关，不搬画幅常量 | ✅ |
| P2.8 | 多轨混音器 | `media/audio-mixer.ts` | `playbackRate` 变速改音高（v1 接受，UI 明示） | ✅ |
| P2.9 | 导出写音频轨 | `media/mediabunny-adapter.ts` | 每帧 `await` 背压；混音失败必须抛出而非静默产无声片 | ✅ |
| P2.10 | 音效库面板 | `panels/audio/SfxLibraryPanel.tsx` | 149 个文件不能预加载，试听复用单个 `Audio` | ✅ |
| P2.11 | 预览实时混音 | `features/video-factory/lib/use-preview-audio.ts` | 只在播放/暂停/大跳转时重建节点 | ✅ |
| P2.12 | 音频包络面板 | `panels/audio/AudioEnvelopePanel.tsx` | — | ✅ |
| P2.13 | 节拍估算与吸附 | `src/features/video-factory/lib/beat-detect.ts`、`panels/timeline/snapping.ts` | 自相关在弱节拍上给出半拍/双拍错误 | ✅ 已实现，界面标估算 + 置信度 |

**P2.13 说明**：节拍检测走纯算法（能量包络 → 一阶差分 → 自相关 → 60–180 BPM 约束）。合成鼓点实测 90/120/150 BPM 全部还原。拍点吸附默认**不启用**，用户点「检测音乐节拍」后才把拍点并入吸附参考点 —— 弱节拍上的半拍/双拍歧义不该悄悄影响用户已经排好的片段。

### 7.4 P3 · 视频工厂页面

| # | 任务 | 文件 | 难点 | 状态 |
|---|---|---|---|---|
| P3.1 | 导航与路由 | `app/navigation.ts`、`App.tsx`、`app/workbench-surface.ts` | `navigation.ts` 是唯一导航来源 | ✅ |
| P3.2 | 文案 | `locales/{zh-CN,en-US}/videoFactory.json` | 不硬编码中文 | ✅ |
| P3.3 | 页面骨架与皮肤 | `features/video-factory/VideoFactoryPage.tsx`、`styles/video-factory.css` | 深色令牌限定 `.vf-studio`，不污染全局 | ✅ |
| P3.4 | 工程持久化 | `features/video-factory/lib/use-factory-project.ts` | 800ms 防抖自动保存 | ✅ |
| P3.5 | 顶栏 | `FactoryToolbar.tsx` → `Page` `actions` + `VideoFactoryPageChrome` | 操作反馈走 `lib/page-notice.ts` → 墨囊 Toast；`project.error` 走 `useNotifyOperationMessage` | ✅ |
| P3.6 | 时间与变速面板 | `panels/timing/TimingPanel.tsx` | — | ✅ |
| P3.7 | 面板装配 | 页面 + 各面板 | `PlayerSurface` 新增 props 全部可选，IP 页行为不变 | ✅ |
| P3.8 | 素材上传 | `features/video-factory/lib/upload-asset.ts` | 探测宽高与时长、存 Blob | ✅ |

### 7.5 P4 · 用户输入 → 一键出片

```
第1步 输入   粘贴口播文案（实时显示切分结果与预估时长）
             可选：段落间插转场、是否覆盖现有镜头轨
第2步 复核   逐条显示「这句文案 → 哪个镜头 → 为什么选它 → 多长」
第3步 生成   落到镜头轨 → 直接可播 / 可改 / 可导出
```

| # | 任务 | 文件 | 难点 | 状态 |
|---|---|---|---|---|
| P4.1 | 分段算法 | `src/features/video-factory/lib/segment-script.ts` | 确定性（无随机）；过长句按逗号再切 | ✅ |
| P4.2 | 段落 → 镜头映射 | `src/features/video-factory/lib/map-shots.ts` | 按内容特征选池（数字→数据、疑问→强调）；理由要可展示 | ✅ |
| P4.3 | 向导 UI | `src/features/video-factory/QuickAssemblyWizard.tsx` | 三步；回退保留表单状态 | ✅ |
| P4.4 | **配音接入真实 TTS** | `src/features/video-factory/lib/synthesize-voice.ts` | 复用 `enqueueIPVideoAudio`；任务失败必须抛出，取消必须停掉后台任务 | ✅ 已接，含失败/取消路径 |
| P4.5 | 编码画幅参数化 | `src/features/ip-video/lib/encoding/capabilities.ts` | 去掉写死 1080×1920 | ⬜ 未做（工厂导出走通用 mediabunny 路径，不依赖它） |
| P4.6 | 生成进度 | — | 光栅化耗时不稳定 | ✅ 导出面板有真实百分比进度；配音有任务状态轮询显示 |

**P4.4 说明**：向导第三步可以勾选「同时生成配音」，选音色、调语速。走的是 IP 口播视频**已经上线**的
`ip_video_audio` 后台任务链路 —— 不新建接口、不新建计费路径，计费仍由服务端裁决。
界面明确写出「会产生相应的用量」，不会在用户不知情时扣费。

**平台门槛必须提前显示**：仓储 createIPVideoAudioJob 有两条硬校验 —— 文案 ≥ 20 字、语速 0.8–1.5。
向导最初把语速滑块做成 0.5–2.0 且不提示字数下限，用户点了「生成」才会撞上仓储报错，白等一轮。
现在滑块范围就是 0.8–1.5，不足 20 字时直接标红并禁用提交按钮。
这个问题是**真实入队验证**才会暴露的：假 actions 永远不校验，只有真走一遍仓储才会被拦。

**取消路径曾有一个真 bug**：最初只在轮询循环开头检查 `abort`，导致「正在等待轮询时点取消」
不会调 `cancelTask` —— 后台任务继续跑、继续计费，用户以为停了。现在统一到
`cancelAndThrow()` 一个入口，并在 `catch` 里再兜一次底。这条用假后端验证过：
`取消停任务` 检查项从 ❌ 变 ✅。

### 7.6 P5 · IP 口播视频升级

当前 IP 口播只挂载 `composition/TalkWorkspace.tsx`。本节模板链路为既有底层实现记录，已无页面入口；新版工作区、分库存储与入口删除规则以 `video-assembly.md`「宿主接入」为准。

| # | 任务 | 文件 | 难点 | 状态 |
|---|---|---|---|---|
| P5.1 | `TemplateProject` 增镜头层 | `src/features/ip-video/lib/template-project.ts` | 缺省必须合法，不破坏旧数据 | ✅ `shots?: TemplateShot[]`，可选字段 + 校验 |
| P5.2 | `TemplatePainter` 画镜头层 | `src/features/ip-video/lib/template-renderer.ts` | 同步 `draw()` 不能改 async | ✅ `setBackdrop(frame, opacity)` 先注入再同步绘制 |
| P5.3 | 动效背景选择面板 | `src/features/ip-video/components/ShotBackdropPanel.tsx` | 151 个镜头的分类与搜索 | ✅ 分类 + 搜索 + 起止/变速/透明度 |
| P5.4 | 编辑器挂载面板 | `ip-video/editor/TemplateEditor.tsx` | 走已有历史栈 `commit` | ✅ |
| P5.5 | 三条绘制链路接异步出帧 | `shot-backdrop.ts`、`video-renderer.ts`、`encoding/offline.ts`、`TemplateCanvas.tsx` | 预览/实时录制/离线编码三处都要「先 await 出帧、再同步 draw」 | ✅ 三处都接 |
| P5.6 | IP 与视频工厂工程隔离 | `composition/use-talk-project.ts` | 项目与素材必须同时隔离 | IP 使用独立 `ip-video` 仓储；同工程跳转入口已删除 |
| P5.7 | IP 音视频导出 | `composition/TalkWorkspace.tsx` | 导出按来源读取对应素材库 | 走统一后台导出；`ip-composition` 只读 IP 工作区 |
| P5.8 | **`AssemblyControlPanel` 换真镜头库** | `src/features/ip-video/components/AssemblyControlPanel.tsx` | 原为两个 `<select>`；换掉会变更已上线面板行为 | ✅ 已换：保留真实生效的排版预设，并嵌入 `ShotLibraryPanel`（151 个镜头，点一下即加到背景层） |

**P5.8 说明**：这里原本被列为「不做」，理由是「改已上线链路有风险」。按要求改掉了 ——
做法是**保留**那两个真正起作用的排版下拉（它们改标题/字幕的颜色与位置），把镜头库作为**新增区块**
嵌进同一面板，点击即写入 `project.shots`。这样既满足「IP 也换上镜头库」，也没有破坏原有排版能力：
两个下拉的行为一个字没动。

**P5 的完成方式**（这条要说清楚，因为它决定了「复用」到底意味着什么）：

`TemplatePainter.draw()` 保持**同步**，没有改成 async —— 改它会牵动实时录制、离线编码、worker 与预览四处，
风险远大于收益。改为注入：

```
调用方：await backdrop.frameAt(project, time)   → Canvas | null
        painter.setBackdrop(frame, opacity)     → 同步存起来
        painter.draw(context, time)             → 同步绘制（内部把 frame 铺到背景层）
```

三处调用方（实时录制 `video-renderer.ts`、离线编码 `encoding/offline.ts`、预览 `TemplateCanvas.tsx`）
都在 `draw` 前 `await` 一次。`ShotBackdropRenderer` 内部按 `(shotId, frame)` 去重，
所以预览以 30fps 反复问同一帧时不会重复光栅化。

**已验证**（`npm run verify:shots`，真实 headless Chrome）：

| 检查项 | 结果 |
|---|---|
| 逐镜出帧（`--all`） | **151 / 151** 通过，0 失败、0 空白 |
| IP 模板复合动效背景 | ✅ `ink=1`，背景区铺满 |
| 镜头库数据 | 151 张卡、10 个分组 |
| 音效库数据 | 16 个分组，搜索框提示含 149 |
| 三栏装配 | ✅ 镜头库 / 音效库 / 舞台 / 时间轴 / 时间变速 / 音量包络 全部挂载，镜头成功入轨 |
| 拖放入轨 | ✅ 派发真实 `DragEvent` + `DataTransfer`，镜头数 0 → 1 |
| 片段拖动 | ✅ 真实 mousedown/mousemove/mouseup，2.0s → 2.8s，一次撤销回到原位 |
| 节拍检测 | ✅ 合成鼓点：90→90.9、120→120、150→150 BPM |
| 配音链路 | ✅ 入队 / 轮询 / 取回 / 失败抛出 / 取消停任务 全部正确 |
| 新增界面 | ✅ IP 组装面板已嵌镜头库且保留排版下拉；向导三步可达并带配音控件 |
| 配音入队 | ✅ 真实写入 IndexedDB：ip_video_audio 任务落库，payload 文案与语速正确 |
| **导出带音频** | ✅ 真的编码一次 MP4（46KB）后 `probe` 读回 `hasAudio=true`；无音频元素时返回静音 PCM 而非 `null` |

**「导出有声音」这条是怎么证的**：验证页真的构造 1 秒 440Hz 正弦波 PCM + 1 秒 320×180 视频，
调 `encodeVideo({ pcm })` 编出 MP4，再用 `MediabunnyMediaAdapter.probe` 读回来确认 `hasAudio === true`。
只看代码里写了 `addAudioTrack` 是证明不了的 —— 编码器完全可能静默忽略不支持的音频配置。

**拖放这条链路曾经是断的**：镜头库能拖（写了 `dataTransfer`），但时间轴**没有任何 `onDrop` 处理器**，
所以拖到轨道上什么都不会发生，而且不报错。这是纯人工测试也很容易漏掉的问题 —— 只有真派发一次
`DragEvent` 才能确认。修复点在 `panels/timeline/TimelineTrackView.tsx`：
`onDragOver` 必须 `preventDefault()`（否则浏览器不允许 drop），落点用
`getBoundingClientRect()` 换算成时间轴时间（不用 `offsetX`，避免受横向滚动影响）。
音频走 `onDropAudio` 回调交给宿主 —— 面板拿不到 Blob（音频是 public 下按需 fetch 的大文件）。

**为什么这些验证必须真跑浏览器**：单帧耗时中位 229ms、最慢 4264ms，这个差距只有在真浏览器里
才量得出来；`inkRatio` 抓的是「出帧了但整幅空白」，`jsdom` 里没有真实光栅化，测不出来；
三栏装配抓的是「单个面板都对，拼一起就崩」。这些都不是 mock 测试能覆盖的。

IP 复合的做法：把 `opening/spotlight-hero-card` 挂到 `TemplateProject.shots`，用真实的
`TemplatePainter` + `ShotBackdropRenderer` 画一帧并统计背景区非空像素。
这不是靠断言「函数被调用了」，而是真的画出像素再测。

**`AssemblyControlPanel` 已按要求改成含镜头库**（见 P5.8）：保留原有排版下拉，新增镜头库区块。

---

## 8. 界面设计

### 8.1 布局

```
┌─ 顶栏（workbench-tool chrome）──────────────────────────────────┐
│ AI 一键出视频 · 工程名 │ 撤销 重做 │ 文件菜单 · 导出 …              │
├──────────┬──────────────────────────────┬──────────────────────┤
│ 左库     │ 监视器（宽=画幅比例自适应，无左右黑边） │ 右属性               │
│ 可收起   │ 角标点击切换 9:16/16:9/1:1/3:4/4:3   │ 可收起               │
│ 素材/镜头│ 走带 ▶ ◀ ▶ 帧步进 循环 分辨率·fps      │ 内容与样式/字幕/…     │
├──────────┴──────────────────────────────┴──────────────────────┤
│ 时间轴（可收起为细条；收起态写入 sessionStorage `vf-studio-panels`） │
└─────────────────────────────────────────────────────────────────┘
```

实现要点：`use-studio-layout` 按 `vf-main` 可用高度与侧栏宽度计算 `--vf-stage-w/h`，中间列 `flex: 0 0` 贴画幅；`PlayerSurface` 传 `stageSize` + `compactViewport`；画幅切换走 `SetCanvasRatioCommand`（缩放已有元素 transform，可撤销）。

### 8.2 深色导播台皮肤（限定作用域）

```css
.vf-studio {
  --background: #0b0d10;  --card: #14171c;      --border: #23272e;
  --foreground: #e9ecf1;  --muted: #1b1f25;     --muted-foreground: #8b93a1;
  --primary: #2f81f7;     --primary-foreground: #ffffff;
}
```

只作用于 `.vf-studio`，不改任何面板组件（沿用 `live-script` 深色导播台先例）。

### 8.3 三处必要体验升级

| 升级 | 现状 | 目标 |
|---|---|---|
| 时间轴片段 | 单行 `[视频]` + 文本 | 两行：镜头名 + 时长；颜色分轨（镜头蓝 / 字幕青 / 音效紫 / 转场黄） |
| 轨道头部 | 单图标 + 三按钮 | 类型色块 + 片段数 + M/S/H/L |
| 空态 | 写死「9:16 视频编排舞台」 | 按实际画幅显示 + 「从镜头库拖入」引导 |

### 8.4 响应式

| 断点 | 行为 |
|---|---|
| 桌面沉浸式 | 左/中/右 flex：两侧 `flex:1` 吃掉剩余宽度，中间宽度由画幅比例计算；左右栏顶栏有收起钮，收起为 ~40px 图标条 |
| ≥1440 | 侧栏展开宽约 256 / 300（CSS `--vf-rail-*-expanded`） |
| 1180–1440 | 224 / 268 |
| <980（非 immersive 页） | 纵向堆叠：舞台 → 时间轴 → 属性 |

### 8.5 能力对照

| 参考项目能力 | 本方案 |
|---|---|
| 剪映式多轨时间轴 | ✅ 复用 `TimelinePanel` |
| 素材库 | ✅ `MediaPanel` |
| 150 张镜头卡可拖上轨 | ✅ **151 张** |
| 149 音效 + 5 BGM | ✅ 全量 |
| schema 驱动属性面板 | ✅ `InspectorPanel` + `TimingPanel` |
| 预览与渲染逐帧一致 | ✅ 同一 `renderSceneToCanvas` |
| 一键导出 MP4 | ✅ `ExportPanel` + 音频轨 |
| 成片拆解导入 | ⚠️ 不需要（工程模型本身就是多轨） |
| Remotion Studio | ❌ 不做 |
| 剪映工程导出 | ❌ 不做 |
| 社交平台发布 | ❌ 不做 |
| 中/英/俄三语 | ⚠️ 中/英 |

---

## 9. 风险登记

| # | 风险 | 影响 | 应对 |
|---|---|---|---|
| R1 | `html-to-image` 渲染性能 | **实测**中位 229ms、最慢 4264ms（含首帧字体与 DOM 测量） | 预览低分辨率缓存 + 导出全分辨率；进度必须真实 |
| R2 | 光栅化保真度损失 | `backdrop-filter`、`mix-blend-mode`、CSS 3D 在 `foreignObject` 中可能失真 | 151 个镜头已逐个真渲染验证无空白；细粒度质感差异需人工看 |
| R3 | `CameraMotionBlur` 差异 | 4 个 demo 质感与 Remotion 原版不同 | 默认 CSS blur 近似；卡片标「近似」 |
| R4 | 3 处 `Math.random` | 逐帧抖动、不可复现 | ✅ 已全部替换为确定性 `random(seed)` |
| R5 | 151 个逐字移植的维护成本 | 上游更新无法同步 | `@ts-nocheck` + 文件头注释，不做二次改造 |
| R6 | 转场轨为空壳 | `doc.transitions` 可写但 `compositor` 不读 | 补 `evaluateTransitionProgress` 混合；未补前不摆空的转场轨 |
| R7 | IP 与工厂双模型漂移 | 两套文档模型各自演化 | 只共享「镜头注册表 + 渲染管线」，不合并文档模型；转换单向 |
| R8 | 浏览器内存 | 151 个镜头按需 `import()`；预览缓存 120MB 上限 | 已用动态 `load()` + `dispose()`；导出逐帧渲染不把全分辨率帧留在缓存里 |
| R9 | 字体缺失 | demo 依赖特定字重 | 映射到本地 `Alibaba PuHuiTi`，缺失降级并记录 |
| R10 | 工厂导出无音频 | 原 `encodeVideo` 只 `addVideoTrack` | ✅ 已接 `addAudioTrack`；混音失败会抛出，不静默产无声片 |
| R11 | 口播 TTS 音频入工厂 | IP 的 TTS 产物在本机 IndexedDB | 工厂读同一 blob 写入 `IndexedDBAssetRepository`，不重新合成 |
| R12 | 音频编码兼容性 | 部分浏览器无 `AudioEncoder` | 检测不到时明确报错，不静默产出无声片；提供 WebM/Opus |
| R13 | 音画同步漂移 | 逐帧光栅化耗时不均 | 按帧号而非墙钟推进 |
| R14 | 32MB 音频体积 | 全量打包拖慢首屏 | 按需 `fetch` 不进主包；面板懒加载 |
| R15 | 节拍检测精度 | Web 端自相关弱于 librosa，弱节拍上会给半拍/双拍 | ✅ 已实现并测通（90/120/150 BPM 均还原）；界面标注「估算」+ 置信度，拍点吸附需用户主动检测后才加入 |

---

## 10. 验收

### 10.1 自动化断言（只列真实存在的命令）

| 用途 | 命令 | 说明 |
|---|---|---|
| 类型检查 | `npm run typecheck` | 覆盖 `src` 与 `packages/*`；移植的 demo 带 `@ts-nocheck` |
| 构建 | `npm run build` | **这一条最关键** —— 151 个 demo 的具名导入错误只有打包器能发现 |
| 注册表重生成 | `node scripts/generate-shot-registry.mjs` | 缺时长 / 缺组件导出时硬失败 |
| 音频清单重生成 | `node scripts/generate-audio-manifest.mjs` | 扫描 public 目录，输出 149 SFX + 5 BGM |
| demo import 体检 | `node scripts/rewrite-demo-imports.mjs --check` | 有未改写文件时报错 |
| **六项真浏览器验证** | `npm run verify:shots` | 自动起 dev server（无则拉起、结束自动关），真 Chrome 跑：逐镜出帧 / IP 复合 / 面板数据 / 三栏装配 / 导出带音频 / 拖放入轨。加 `--all` 逐镜跑全部 151 个 |
| 文档一致性 | `npm run test:docs` | 核对可复用清单里的路径与标识名 |

**刻意没有为这个功能新增测试脚本。** 理由：核心风险是「151 个第三方组件能不能真渲染」，
这件事用单元测试断言不了 —— 必须靠 `/workbench/shot-check` 那种真跑一遍的自检页，
以及人工在浏览器里看画面。写一堆 mock 测试只会制造「测试通过但导出是黑屏」的假安全感。

### 10.2 人工验收清单

**A. 视频工厂页面**
- [ ] 侧栏「音视频」组出现「视频工厂」
- [ ] 全宽、深色导播台、三栏 + 底部时间轴
- [ ] 390×844 无横向溢出
- [ ] 新建 / 重命名 / 删除工程
- [ ] 刷新后工程还在
- [ ] 切换账号互不可见

**A2. 镜头渲染自检（先跑这个，再验收后面的）**
- [ ] 开发模式访问 `/workbench/shot-check`
- [ ] 点「开始检查」，全部 151 个镜头渲染
- [ ] 无缩略图的卡片即为失败，点开看具体错误
- [ ] 记下失败的 shotId（这是后续要修的真实问题）

**B. 镜头库**
- [ ] 显示 151 张卡，10 分类，数量真实
- [ ] 搜索可定位（按名称与摘要）
- [ ] 卡片显示真实时长
- [ ] 拖到时间轴 → 出现镜头片段
- [ ] 预览播放动画正确
- [ ] 裁剪 / 变速 / 撤销 / 重做同步正确
- [ ] 「近似」角标只出现在 4 个用了 CameraMotionBlur 的镜头上

**C. 音效**
- [ ] 16 分类齐全
- [ ] 点击试听有声音
- [ ] 拖到时间轴 → 出现音频片段
- [ ] 音量 / 淡入淡出可调
- [ ] BGM 可上独立音轨
- [ ] 多音轨同时播放不破音

**D. 导出**
- [ ] 有真实进度
- [ ] 可取消
- [ ] MP4 能播放
- [ ] **有声音**（音效 + BGM；口播需先从 IP 页带入或手动添加）
- [ ] 音画同步
- [ ] 画面与预览一致
- [ ] 导出 / 导入 JSON 往返等价
- [ ] 导出的 MP4「有声音」这一项已由 `npm run verify:shots` 自动验证（hasAudio=true），人工只需确认听感与音画同步

**E. 一键出片**
- [ ] 粘贴文案 → 实时看到切分结果
- [ ] 复核页每条都显示「文案 → 镜头 → 理由 → 时长」
- [ ] 三步可回退且不丢数据
- [ ] 「只生成镜头」能直接落地
- [ ] 第三步勾选配音 → 选音色/语速 → 生成（会真实调用 TTS，产生用量）
- [ ] 配音生成中可取消，且取消后后台任务确实停止
- [ ] 生成后镜头与配音都已入轨，可直接播放
- [ ] 导出成片，画面与声音都正确

**F. IP 视频升级**
- [ ] IP 口播与视频工厂的作品列表、改名、编辑、删除互不影响
- [ ] 「预制组件与动效镜头」面板里能看到 151 个镜头，点一下即加到背景
- [ ] 原有「视觉风格 / 主排版布局」两个下拉仍然生效（行为未变）
- [ ] 「动效背景」面板能调每个镜头的起止 / 变速 / 透明度
- [ ] 挂上动效后预览能看到动效铺在背景
- [ ] IP 导出含动效背景与配音
- [ ] IP 原模板快照未被覆盖

**H. 时间轴操作**
- [ ] 片段能整体拖动（不只调头尾）
- [ ] 拖动后按一次撤销即回到原位（不是要走很多步）
- [ ] 拖动时靠近其他片段边界会吸附
- [ ] 点「检测音乐节拍」后能看到 BPM 与拍点数
- [ ] 开启节拍吸附后，拖动会吸到拍点上
- [ ] 关掉磁吸后不再吸附

**G. 回归**
- [ ] IP 页面只保留新版口播工作区，无旧模板/成片或旧调试入口
- [ ] 数字人页面正常
- [ ] 声音克隆 / TTS 正常
- [ ] 其他页面无样式串味

---

## 11. 实现约束

1. 不改后端仓，不引入 Remotion / three.js / Google Fonts 依赖。
2. `runtime/` 内禁止 import `remotion`。
3. `registry.generated.ts` 禁止手改，只由脚本产出。
4. 界面数字必须真实（149 个 SFX 就写 149，不虚标）。
5. 音频导出不得静默降级为无声；不支持时必须报错。
6. 不新增聊天框、会话列表、全局通用过程侧栏（`AGENTS.md` 产品边界）。
7. 演示内容必须标注「演示」，不得冒充真实产物。
8. 不造第二套编辑器、时间轴或状态，全部落在 `@no996/video-editor` 的同一工程模型与命令系统上。

---

## 11.1 镜头配色与竖屏能力（第二期）

**配色（`usePalette`）**

- 77 个镜头用 `useLook`（整套色盘）；**66 个**自带色板的镜头走轻量层 `usePalette`，只开放 4 个槽位：
  `bg`（大面积底色）、`primary`（主强调）、`secondary`（次强调）、`ink`（主文字色）。
- 覆盖现状：**143 / 151** 个镜头有配色键。剩余 8 个登记在 `packages/video-editor/src/demos/color-fixed.json`
  （画面主体是整页截图或共享占位素材，改色没有可落地位置），生成进注册表 `colorFixed` / `colorFixedReason`；
  检查器对没有配色键的镜头**不再渲染**「预设主题 + 5 路拾色」，改成一句说明。
- `usePalette` 的默认值必须等于镜头原本的主色字面量 —— 这是"默认帧零变化"的唯一保证。
  组件里的子组件若自己也读颜色，必须在子组件内各自调用一次（`usePalette` 走 context，不会自动下发）。
- 背景是内置渐变（`Backdrop` 等共享 fixture）时，用 `PAL.isCustom ? PAL.bg : 原渐变` 或 `solid` 参数，
  否则用户改底色会被渐变完全盖住，看起来像"改了没反应"。

**竖屏（9:16）**

- `packages/video-editor/src/demos/vertical-presets.json` 给**全部 151 个**镜头登记构图方式：
  `cover`（按焦点裁切，构图/光效类）、`fit`（等比缩小留边，文字/表格/界面类）、`reflow`（镜头自带竖排重排）。
- `_fixtures/VerticalFrame.tsx` 负责把 1920×1080 内容装进竖屏画布；安全区 `VERTICAL_SAFE = { top: 180, bottom: 320 }`。
- `dom-frame-renderer` 的 `vertical` 选项：cover/fit 时 `useVideoConfig()` 仍报 1920×1080（镜头按设计空间作画），
  **reflow 时报告真实画布（1080×1920）**，镜头据此切布局分支。
- 编辑器预览/导出走 `render/shot-cache.ts`，画布为竖屏时自动把该镜头的 `vertical` 预设传给渲染器；
  画幅由现有 `CanvasRatioControl` 的 9:16 预设切换，导出分辨率沿用已有 720P/1080P 档位（取短边）。
- 首批 **19 个**镜头有真正的竖屏重排分支（原计划 20，`outro/logo-shrink-wordmark-lockup` 竖屏复核近全黑，已回退为 `fit`）（`vertical-presets.json` 里标 `reflow`），其余镜头在 9:16 下是
  「整体缩放 + 裁切/留边」，动效库卡片据此标注「横竖屏」或「仅横屏」，不夸大成"已适配 9:16"。

**验证入口**

- `npm run verify:shots -- --all`（横屏 151 个）、`--aspect 9:16`（竖屏）、`--colors <ids>`（改色通道像素差）、
  `--ids <ids>`（只跑指定镜头）、`--shots-dir <dir>`（导出 PNG 帧）、`--save-ink` / `--save-spread`（基线数据）。

---

## 12. 本轮不做

- 不接 AI 选镜头（`ip-video-assembly-v1` 保持注册不接线）。
- 不做付费渲染、不做服务端渲染农场。
- 不做 Remotion 工程导出（`workbench` 的 `?import=project`）。
- 不做剪映工程导出（依赖 Python）。
- 不做社交平台发布（需要 API Key）。
- 不做视频生成类 AI（文生视频），只做「已有素材 + 动效镜头」的剪辑合成。
- 资源许可逐条核对 —— 按用户指示暂不处理。

---

## 13. 文档维护

- `scripts/check-reusable-doc.mjs` 的扫描目录已包含 `packages/video-editor/src`，所以本文件与 `docs/reusable-assets.md` 里提到的**导出标识名**都会被机械核对。文档里写了名字却源码里没有，`npm run test:docs` 会失败。
- 新增可复用件必须**同时**登记进 `docs/reusable-assets.md`（那是给下一个功能查的清单）。
- 风险登记（§9）只增不删。风险解除时把「应对」改为「已解决 + 依据」。
