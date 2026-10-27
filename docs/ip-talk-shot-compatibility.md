# IP 口播镜头兼容清单（2026-10-23）

## 准确范围

**6 个 content 候选已接线，145 项未适配。** 这里的 6 项是本项目去演示化的内容呈现，不是将原始 151 个演示整体开放；也不代表六项已完成浏览器或真实成片验收。旧版“0 / 151 可用”的结论已被本轮静态接线替代，原始演示和附带纹理仍不因此获得使用许可。

本轮整合仅使用文件工具阅读、修改源码和文档；未运行任何验证命令、测试、构建、类型检查、浏览器/CDP、模型或供应商调用。未修改生成注册表、工厂作品或用户数据。任务与导演方案的接线范围见 `docs/video-assembly.md`，外部来源与权利证据唯一登记于 `MIGRATION_PROVENANCE.md`。

## 六个内容候选

静态定义与实现：`packages/video-editor/src/demos/content-variants.tsx`。业务兼容判定和命令入口：`src/features/ip-video/composition/talk-shot-catalog.ts`、`talk-shot-commands.ts`；业务页面入口由宿主整合，不以本文代替页面验收。

| shotId | 内容呈现 | 精选 | 输入 |
| --- | --- | --- | --- |
| typography/blur-slide | 柔焦滑入 | 是 | text / subline |
| typography/flying-words | 文字纵深飞入 | 否 | text / subline |
| typography/outline-word-fill | 描边点亮 | 是 | text / subline |
| typography/gradient-word-sweep | 渐变扫光 | 否 | text / subline |
| typography/marker-underline-title | 马克笔划线 | 是 | text / subline |
| typography/title-demote-to-label | 标题收为标签 | 是 | text / subline |

六项均只接受必填单行纯文本：短标题最多 18 个 Unicode 码点、副标题最多 36 个；拒绝未知字段、空值与控制字符，不静默截断，不回退英文示例。内容版使用随实际画布宽高计算的标题、副标题区域；下方保留字幕空间，不加载原始演示品牌、截图、指标、纹理或音频。

其余 145 项没有对应内容版 loader，继续拒绝作为口播内容插入。完整原始目录仍由既有 `SHOT_CATALOG` 提供；具体原始入口、字段、素材槽位和禁用理由保留在业务兼容目录的 `source` / `demoFields` / `demoSlots` / `demoReasons`，不按分类 schema 猜测支持能力。名称含“背景”不代表无文案或无品牌，不据名称开放。

## 预览与导出的静态接线

- `TalkStage.tsx` 已开启 `PlayerSurface.layeredShots`。连续的非镜头画面共用 Canvas，遇到镜头就分层，依 `RenderPlan` 顺序交错；字幕单独置于视觉层之上，错误提示再置顶。旧工厂默认路径不被强制切换。
- `LiveShotLayer.tsx` 对 `presentation: 'content'` 只调用 `findContentShot`，找不到适配、参数非法或字体失败均明确报错，不加载原始 demo。更改文案、源帧长或 presentation 时重置加载/错误边界，不复用上一版失败状态。
- 实时与离线出帧共用 `FrameProvider`、`resolveShotFrame` 和同一个内容组件。fps 均取工程分数帧率，frame 按片段 startUs/rate 求值并夹到源帧范围；durationInFrames 均使用 element.sourceDurationFrames，不把裁剪后的预览时长换回原 demo 时长；width/height 均取工程画布，props 均为 slots 后合并 overrides。缩略图先按工程坐标出帧再缩小，不另行改变布局。
- 片段外框的 x/y/width/height/rotationDeg/opacity 关键帧，在实时分层预览与导出 `renderShotElement` 中都走 `evaluateElementTransform`；圆角与居中 cover 采用相同几何语义。此为源码一致性，不是像素对比结果。
- 镜头缓存 identity 已包含 shotId、presentation、instanceId、画布宽高、fps、源帧长与稳定序列化 props；预览帧键另含帧号和缩略图尺寸。渲染器有活跃计数与数量上限，旧参数实例按 LRU 释放；全分辨率导出帧不常驻缓存。
- 六个内容版独立等待普惠体 400 / 700 的真实 loaded face，不依赖当前字幕选用了哪款字体。宿主已在 `src/main.tsx` 注册普惠体 CSS；字幕字体选择保持独立，十款目录不等于把所有字体立即下载。

## 字体嵌入缓存

`packages/video-editor/src/demos/pipeline/dom-frame-renderer.ts` 在 `toCanvas` 传入 `fontEmbedCSS`。缓存限定在各渲染器内部，身份包含舞台实际使用的字体 family、对应 `@font-face` 规则全文及样式表来源地址；相同字体数量不再作为可复用依据。实际字体集或规则变化时重新嵌入；样式表无法读取时跳过缓存复用，仍调用既有字体嵌入逻辑。失败会清缓存，渲染器释放时一并释放缓存。

这是源码层修正，**实际导出的字形与嵌入结果仍待浏览器对照验收**，尤其需检查先渲染其他字体镜头、再渲染普惠体内容版的顺序，以及原地替换字体规则的情况。

字体分发文本已补齐：`public/licenses/ip-talk-fonts-OFL-1.1.txt` 保留九款 OFL 字体各自版权声明及完整许可。使用规则见 `docs/ip-talk-font-license-notes.md`；普惠体继续沿用既有授权边界，不由其他九款的 OFL 许可代替。

## 原始演示的既有阻塞

原始六个参数消费者不等于本轮六个内容版：前者包含首词推近、柔焦滑入、聚光卡片、文字蒙版、品牌锁定和数据轴缩放等，仍有固定原品牌、演示指标或横屏构图问题。原始首词推近的 highlightWord 读取不参与真实着色；原始柔焦滑入仍有固定刊头；聚光卡片仍有示例网页纹理；蒙版和数据图表仍含演示数据；品牌锁定仍有固定图标。内容版不会在失败时回退这些组件。

业务目录的 `TALK_SHOT_RENDER_BLOCKERS` 记录剩余运行验收和原始演示许可限制，不再把已接线的缓存身份与分层预览描述为尚未实现。其余 145 项原始演示仍未开放；页面入口、忙态、命令门禁与 AI 计划的静态接线不代表交互已验收。

## 32 组件 / 18 动效边界

已有自动组装目录仍不是全部视觉实现：32 个目录组件中，只有 title.opening、title.chapter、title.keyword、caption.sentence、info.steps 这 5 个语义分支具有对应编译；其余 27 项退化为文字/目录名。18 个动效中仅 motion.fade-in 与 motion.step-focus 有实际处理。新内容版不扩大这些数字，也不另造 AI 编辑器、时间轴或状态。

## 音效 / BGM 保持关闭

既有音频清单为 **149 个音效 / 5 首 BGM**，缺逐件作者、许可证与再分发权利证据。因此仍为 **0 / 149 音效、0 / 5 BGM 开放**，不提供内置音频试听、插入或下载；其他依赖、字体或渲染器的许可证不能替其授权。用户自行导入有权使用的音频继续走既有素材流程。

## 仍需人工验收

1. 逐项对照六项内容的实时预览与导出字体；尤其先出其他字体镜头再出内容版，并检查字体规则变化后的缓存失效。
2. 9:16 / 16:9 / 1:1、多帧率、裁剪和速率变化、首末帧、短/长中英文及缺字表现。
3. 同一 shotId 多实例不同文案、修改后重出片、跨工程隔离、缓存释放和失败恢复。
4. 人物/照片/镜头交错层序、字幕始终在上、全几何关键帧、旋转与圆角遮挡，以及真实 MP4 下载与音画同步。
5. 发布后独立许可文本可访问、所选字体真实加载；原始镜头素材与内置音频继续单独核实权利证据。

上述事项本轮均未运行验收，不以源码落盘替代完成声明。
