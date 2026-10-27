# 迁移来源与 UI 复用登记

本文件是**唯一**记录外部来源的地方（约束见 `AGENTS.md`「独立项目」）。以下来源只作历史登记，**不构成安装、构建或运行依赖**；本项目不读取这些目录。

## 1. 来源与边界

| 用途 | 来源路径 |
|---|---|
| 桌面端主来源 | `F:/Dev/Desktop-Projects/不加班智能团-desktop` |
| 交互参考（仅表单与字段） | `F:/UserData/Desktop/运营社逆向`、`/agent-factory-web` |
| Social Studio WYSIWYG（TipTap preview 编辑、MD/HTML 互转、图文图廊） | `F:/Dev/Desktop-Projects/my-new-plugin`（`src/editor/core/conversion-service.ts`、`components/workspace/utils/utils.ts` 节选、`article-preview-panel`、`image-text-preview-panel` 节选；无代码模式/AI/违禁词） |
| 后端契约候选 | `F:/Dev/Desktop-Projects/不加班智能团后端/.worktrees/v1-backend` |
| 产品定位与分析 Skill（方法论、正式报告模板、网页端 PRD 与线框原型） | `D:/社交工具/xwechat_files/wxid_wq09nrejrlhv12_066b/msg/file/2026-10/2-产品定位与分析 skill`（`product-positioning-analysis/SKILL.md`、`assets/report-template.md` 及同名 PRD / 线框 / Mermaid 文档；只内联方法论与模板正文，无运行时代码或依赖） |

迁移只修改本项目 `F:/Dev/Desktop-Projects/不加班工作台-web`。未迁入密钥、IPC、认证运行时、DSH 内核、模型供应层或后端服务；来源仓库保持只读，导出/复制不改动其工作树与 index。

## 2. 公共 UI 快照（`packages/ui/src/`）

`vite.config.ts` 与 `tsconfig.app.json` 把 `@no996/ui/*` 指向本项目 `packages/ui/src`，依赖由本项目根 `package.json` 独立安装；本项目**不是**桌面 pnpm 工作区，`packages/ui/package.json` 只记录快照包名与依赖。`src/index.css` 直接 `@import` 其 `glass-tokens.css`、`glass-components.css`、`module-layout.css`，并用 `@source '../packages/ui/src'` 供 Tailwind v4 扫描。

**快照文件**：`button`、`card`、`input`、`textarea`、`input-group`、`field`、`label`、`separator`、`select`、`checkbox`、`spinner`、`tooltip`、`dialog`、`dropdown-menu`、`glass-menu`、`glass-menu-dropdown`、`glass-menu-classes`、`badge`、`empty`、`skeleton`、`feedback`、`PageShell`、`module-layout`、`utils` 及 `glass-tokens.css`、`glass-components.css`、`module-layout.css`、`scrollbar.css`、`ui-surface-tokens.css`、`wizard-steps.css`。

**当前实际引用**（13 个子路径）：`button`、`card`、`dialog`、`dropdown-menu`、`empty`、`feedback`、`input`、`module-layout`、`PageShell`、`select`、`skeleton`、`tooltip`、`utils`。其余为必要依赖闭包，未被页面直接引用。

迁入的是**本次页面所需的闭包**，不是桌面组件库全量迁移。组件保留本地依赖与 `data-slot` 等契约；Dialog 关闭按钮的辅助文案中文化；页面错误、浏览器复制与下载在网页装配层实现。没有复用依赖 Shell 的组件运行时。

## 3. 适配差异（相对来源）

| 位置 | 差异 |
|---|---|
| `src/components/WorkbenchUI.tsx` | 用 PageShell、ModuleLayout、Card、Button、Select、Badge、Empty、Skeleton、WizardSteps 做装配；其中 `Field` 是网页标签与校验装配，**未直接使用**快照的完整 `field.tsx` |
| `module-layout` | 功能页经 `WorkbenchUI.Page` 的 `moduleId` 接入：人设默认 720、双栏工具页默认 1120；可拖最大宽 ≈ 列宽 − 48px；偏好键 `no996.<moduleId>.contentWidth`，策略版本 `no996.wb.contentWidth.policyRevision` 递增时启动清空旧偏好，`≤767px` 隐藏把手 |
| `src/app/navigation.ts` | 自建目录，含旧地址兼容跳转；非桌面 ModuleManifest |
| `src/app/WorkbenchLayout.tsx` | 侧栏、顶栏、移动导航、语言与主题菜单按桌面视觉重写；**未**复制 Shell bridge、工作区标签、拖拽服务或聊天状态 |
| `src/features/auth/*`、`src/auth/*`、`src/api/client.ts` | 源为后端 Admin 登录体系，裁掉平台控制台专属逻辑与权限门禁，统一 `session_channel: 'app'`，令牌隔离为 `no996_wb_*` 前缀 |
| `src/styles/*` | `theme.css` 为桌面浅色/深色语义令牌的网页快照；壳层、登录与领域页面样式为网页重写。`src/styles/agent-ui.css` 收拢 `.agent-*` / `.split-pane*` 等共享生成页样式，各页只保留 `.script-lab*` / `.sl-*` / `.titles-*` 等领域前缀 |
| `src/agent/*` | 统一 agent 内核为**本项目新增**，无桌面对应实现；流程声明与阶段执行由 `defineFlow` + `StageRunner` 提供，页面不自行拼装过程状态 |
| 复制/下载反馈 | 复制成功仅在实际写入剪贴板后提示，失败提示手动复制；下载提示为「已提交浏览器下载」，不等同确认磁盘已落盘 |

**视觉来源边界**：桌面 `apps/shell/src/shell/ProductSidebar.tsx` 只作视觉参考，未整体运行。首页与功能页是同一组件系统下的**新装配**，没有桌面原页可作逐像素对照；视觉迁移、页面完成与真实业务接入是三个不同的交付范围。

## 4. 品牌、字体与登录素材

- **字体**：源 Shell `apps/shell/src/fonts/alibaba-puhuiti.css` + `@pinhai/ali-fonts@1.0.4`（Alibaba PuHuiTi 3.0 Regular/Medium/SemiBold/Bold）→ 本项目 `src/fonts/alibaba-puhuiti.css`，由 `src/main.tsx` 引入；`--font-sans` / `--font-heading` 与桌面一致为 `"Alibaba PuHuiTi"`。npm 依赖随本项目独立安装，不经桌面路径引用。
- **品牌标志**：源 `apps/shell/public/brand/` → 本项目 `public/brand/` 与 `public/desktop/apps/shell/public/brand/`；登录表单区 `LoginWorkbenchLockup` 与桌面 `BrandLogo` 一致，浅色用 `logo-horizontal-color.svg`、暗色用 `logo-horizontal-white.svg`（同 viewBox，切换主题尺寸一致）。
- **登录轮播图**：源 `apps/shell/public/login-hero/slide-{1,2,3}.png` → 本项目 `public/desktop/apps/shell/public/login-hero/` 静态副本，网页使用相对 `BASE_URL` 的本地地址。该目录保留来源路径便于追溯；`public/desktop/` 只是静态来源分组，**不是**运行时桌面依赖。
- **登录页视觉**：品牌侧栏参考 Paper Design `GrainGradient`（`@paper-design/shaders-react`）实现颗粒渐变背景，Windows / Mac「下载桌面端」为占位按钮；左侧表单支持个人 / 企业身份切换，配分栏专用样式 `src/styles/login-split-auth.css`；底部为「其他登录方式」图标栏；平台运营账号经 `WorkspaceLoginDialog` 单页密码登录。

## 5. 业务字段与模板来源

- 参考桌面 `src/app/PromptToolPage.tsx`、`src/lib/promptTools.ts` 的表单到结果交互 → 本项目 `src/prompts/text-tools.ts`。保留主题/人群、数量、形式、时长、卖点与痛点等字段，并增加示例、重置、取消、编辑与逐项操作。原 `src/features/text-tools/TextToolPage.tsx` 的页面实现**已删除**：爆款标题迁到 `src/features/titles/`（agent 引擎），视频 / 直播脚本迁到 `src/features/script-lab/`。
- 人设的 agent loop 统一到 `src/agent/`（内核）+ `src/features/persona/agent/`（流程），页面在 `src/features/persona/**`：分身卡片、表单、骨架过场、结构化预览、Markdown 编辑、AI 微调；默认空列表，需用户新建或「填入示例」。系统规则与输出围栏意图来自桌面 `brain.profile-gen.*.md` 与 Main `profile-generation.ts`，落在 `src/prompts/persona.ts`。
- 公众号 `src/prompts/article.ts` 使用有限排版模板并对用户文本转义，输出 HTML 不含本机封面。富文本粘贴兼容性尚未实测。
- **从零新增、无桌面对应实现**：统一 agent 内核（`src/agent/`）、爆款标题流程（`src/features/titles/agent/`）、视频/直播脚本实验室（`src/features/script-lab/`，含提词器导出）、图文发布编排（`src/services/social-publish/`）、插件桥（`src/services/extension/`）与后台任务（`src/services/workbench-tasks/`）。
- 朋友圈运营参考桌面 Moments 的周排期 → 七字段配置 → 逐天文案交互，落在本项目 `src/features/moments/`。存储只走浏览器 IndexedDB（`src/services/moments/idb-repository.ts`），不接桌面 SQLite / Skill / 发布 / CRM。生成走现有 agent 内核；产品与活动为自由文本，不引用桌面产品知识库。

`src/prompts/*.ts` 中保留的是字段定义与创作要求；真实模型调用统一走后端代理（见 `API_CONTRACTS.md`），演示模式产生的样例为本地确定性内容并明确标注。

## 6. 验证证据

构建、已测与未测项以 `README.md`「验收现状」为准。本项目**没有**在移走全部来源目录或新机器上重新安装依赖；独立性由项目内快照与本地别名配置支持，构建成功不替代新环境安装验收。

## 7. 视频渲染与媒体选型

现状与实现边界见 `docs/video-assembly.md`。付费渲染方案（Remotion）已由用户放弃，不安装、不采购。字幕动效研究只作为设计参考（来源和许可证见 §9），不引入 Remotion 运行时。本项目当前实际只用现有 Canvas2D + `mediabunny@1.61.6`；下列其余条目仅为候选（未安装、未验证成片）。

- **Mediabunny 1.61.6，MPL-2.0（已接入）**：[官方仓库](https://github.com/Vanilagy/mediabunny)、[锁定版许可](https://raw.githubusercontent.com/Vanilagy/mediabunny/v1.61.6/LICENSE)。商业组合使用可行，分发时履行声明与受覆盖源码义务，不等于 MIT。
- **WebAV 开源核心，MIT（只作参考，未引入）**：[官方仓库](https://github.com/WebAV-Tech/WebAV)、[已核对 commit 许可](https://raw.githubusercontent.com/WebAV-Tech/WebAV/42dd6fd65ccbda39c729265c14aab56ac4d28235/LICENSE)。[WebAV Pro](https://github.com/WebAV-Tech/WebAV-Pro) 为另行商业 SDK，不套用核心 MIT 结论。
- **D3 shape 3.2.0 / scale 4.0.2（ISC）、ease 3.0.1（BSD-3-Clause）**：图表几何与比例尺候选，[d3-shape](https://d3js.org/d3-shape)。引入前分别核对许可，不得把所有 D3 包统一写成 MIT。
- **Lottie-web 5.13.0（MIT 播放器）**：可选装饰动效候选；接入前须核对无表达式 Canvas 构建、禁止外链，动画本体许可逐件核查。

候选版本不等于已接入版本。正式安装前确认确切 LICENSE、依赖闭包、NOTICE 与浏览器构建；不默认安装付费扩展。

## 8. 简洁口播字幕：本地字体目录与许可（2026-10-23 整合）

`src/features/ip-video/editor/caption-fonts.ts` 提供十种真实字体目录，保留既有普惠体作为默认（700），其余九款通过本项目 npm 依赖独立分发（均选实际存在的 400 字重）。本节字体不改变全局字体、不引入系统字体冒充选项，也不依赖远程字体 CDN。已读取安装包的实际 `LICENSE`，并对本轮四款读取 `package.json`、`metadata.json` 和 `chinese-simplified-400.css`；CSS 明确使用真实 family、400 normal、无 unicode-range 的本地 woff2/woff 文件引用。这是文件审查，不是运行测试或浏览器验收。

| 目录名称 / 真实 family | npm 包与锁定版本 | 选用字重 / 本地 CSS | 字体许可证据 |
| --- | --- | --- | --- |
| 阿里巴巴普惠体 / `Alibaba PuHuiTi` | 既有 `@pinhai/ali-fonts@1.0.4`，未更换 | 700；既有 `src/fonts/alibaba-puhuiti.css` → `AlibabaPuHuiTi-3-85-Bold.woff2` | 沿用 §4 的既有来源；实际包内 [LICENSE](https://unpkg.com/@pinhai/ali-fonts@1.0.4/LICENSE) 为 Apache-2.0，但 [package.json](https://unpkg.com/@pinhai/ali-fonts@1.0.4/package.json) 标为 ISC，二者存在矛盾，不能据此把阿里字体本身重新认定为 ISC / OFL。保留既有字体授权边界，本次不新增或修改其字体文件。 |
| 思源宋体 / `Noto Serif SC` | `@fontsource/noto-serif-sc@5.3.1` | 400；`chinese-simplified-400.css` | **SIL OFL-1.1**；已读 [包内 LICENSE](https://unpkg.com/@fontsource/noto-serif-sc@5.3.1/LICENSE)，署名 Google Inc.；[元数据](https://unpkg.com/@fontsource/noto-serif-sc@5.3.1/metadata.json) 同样声明 OFL-1.1。 |
| 站酷庆科黄油体 / `ZCOOL QingKe HuangYou` | `@fontsource/zcool-qingke-huangyou@5.3.0` | 400；`chinese-simplified-400.css` | **SIL OFL-1.1**；已读 [包内 LICENSE](https://unpkg.com/@fontsource/zcool-qingke-huangyou@5.3.0/LICENSE)，Copyright 2018 The ZCOOL QingKe HuangYou Project Authors；上游 [googlefonts/zcool-qingke-huangyou](https://github.com/googlefonts/zcool-qingke-huangyou)。 |
| 站酷快乐体 / `ZCOOL KuaiLe` | `@fontsource/zcool-kuaile@5.3.0` | 400；`chinese-simplified-400.css` | **SIL OFL-1.1**；已读 [包内 LICENSE](https://unpkg.com/@fontsource/zcool-kuaile@5.3.0/LICENSE)，Copyright 2018 The ZCOOL KuaiLe Project Authors；上游 [googlefonts/zcool-kuaile](https://github.com/googlefonts/zcool-kuaile)。 |
| 马善政楷书 / `Ma Shan Zheng` | `@fontsource/ma-shan-zheng@5.3.1` | 400；`chinese-simplified-400.css` | **SIL OFL-1.1**；已读 [包内 LICENSE](https://unpkg.com/@fontsource/ma-shan-zheng@5.3.1/LICENSE)，Copyright 2018 The MaShanZheng Project Authors；上游 [googlefonts/mashanzheng](https://github.com/googlefonts/mashanzheng)。 |
| 站酷小薇体 / `ZCOOL XiaoWei` | `@fontsource/zcool-xiaowei@5.3.0` | 400；`chinese-simplified-400.css` | **SIL OFL-1.1**；已读 [包内 LICENSE](https://unpkg.com/@fontsource/zcool-xiaowei@5.3.0/LICENSE)，Copyright 2018 The ZCOOL XiaoWei Project Authors；上游 [googlefonts/xiaowei](https://github.com/googlefonts/xiaowei)。 |
| 思源黑体 / `Noto Sans SC` | `@fontsource/noto-sans-sc@5.3.1`（字体 v41） | 400；`chinese-simplified-400.css` → `files/noto-sans-sc-chinese-simplified-400-normal.woff2`（另有 woff） | **OFL-1.1**；实际包内 LICENSE 署名 `Google Inc.`；metadata 声明 100–900 与 variable wght，但本项目使用静态 400。 |
| 刘建毛草 / `Liu Jian Mao Cao` | `@fontsource/liu-jian-mao-cao@5.3.0`（字体 v24） | 400；`chinese-simplified-400.css` → `files/liu-jian-mao-cao-chinese-simplified-400-normal.woff2`（另有 woff） | **OFL-1.1**；Copyright 2018 The Liu Jian Mao Cao Project Authors；[上游](https://www.github.com/googlefonts/liujianmaocao)。 |
| 志莽行书 / `Zhi Mang Xing` | `@fontsource/zhi-mang-xing@5.3.0`（字体 v19） | 400；`chinese-simplified-400.css` → `files/zhi-mang-xing-chinese-simplified-400-normal.woff2`（另有 woff） | **OFL-1.1**；Copyright 2018 The ZhiMangXing Project Authors；[上游](https://github.com/googlefonts/zhimangxing)。 |
| 龙藏体 / `Long Cang` | `@fontsource/long-cang@5.3.0`（字体 v21） | 400；`chinese-simplified-400.css` → `files/long-cang-chinese-simplified-400-normal.woff2`（另有 woff） | **OFL-1.1**；Copyright 2018 The LongCang Project Authors；[上游](https://github.com/googlefonts/longcang)。 |

九款 OFL 字体允许商用、嵌入与随软件分发；不得将字体本身单独销售，分发字体时须保留对应版权声明与完整许可，修改时遵守保留字体名条款。生成的视频等作品不因此被要求采用 OFL。九包实际 LICENSE 的各自版权声明与共同的完整 OFL 1.1 正文已整合在 `public/licenses/ip-talk-fonts-OFL-1.1.txt`，供发布时随静态资源分发。此项不解决既有普惠体包装包声明与字体本身授权的证据差异。

被排除候选：上一轮实际核对过 `@fontsource/lxgw-wenkai@5.3.0`，真实 family `LXGW WenKai`、字体 v1.311、OFL-1.1，署名 Copyright 2021-2023 LXGW 与 Copyright 2020 The Klee Project Authors；metadata 声明 weights `[300, 500, 700]`、subsets `["latin"]`。因本轮要求真实 400，未将 500 冒称 400，已在上一轮从依赖移除，改用龙藏体。latin 元数据不用于推断它没有中文字形。本轮不安装或删除任何依赖。

本轮只用文件工具审查与修改，未执行验证命令、测试、构建、类型检查、浏览器/CDP 或模型调用。

## 9. IP 口播字幕风格参考（2026-10-22）

口播字幕沿用本项目 `packages/video-editor/src/render/captions.ts` 的 Canvas2D 绘制和句级 `CaptionCue` 时间。视频工厂镜头目录共有 151 个演示镜头，其中 25 个归为「字体排版」；检查 `packages/video-editor/src/demos/registry.generated.ts` 中该类候选后，没有把固定构图的整屏演示镜头嵌入字幕或人物背景：它们不提供面向任意竖屏口播的安全区，且多为固定演示文案/多层复杂画面。口播风格改用现有 Canvas 字幕背景、字体、颜色、布局与句级入退场组合；人物视频在普通套件中保持全幅，杂志观点套件才应用已有的左右分区构图。没有跨库读取/写入，也没有修改视频工厂工程或镜头注册表。

| 外部参考 | 仓库声明许可证 | 本项目借鉴范围 | 运行时/代码处理 |
| --- | --- | --- | --- |
| [reactvideoeditor/remotion-templates](https://github.com/reactvideoeditor/remotion-templates) | MIT（仓库许可证声明） | 逐句显现、弹跳与衬底切换的视觉思路 | 只借鉴概念；未复制模板代码，不安装 Remotion |
| [vshukla7/remotion-captions-themes](https://github.com/vshukla7/remotion-captions-themes) | MIT（仓库许可证声明） | 强调色、字幕层级及多种入场表现 | 逐词时间依赖不适配本项目；未复制代码或安装依赖 |
| [Fats403/remotion-captions-kit](https://github.com/Fats403/remotion-captions-kit) | MIT（仓库许可证声明） | 句段分页和不同文字层级的思路 | 仅作样式参考；未复制代码或安装依赖 |

实现用六套本地完整预设（字体、字号、位置、颜色/底色、版式和句级入场/退场），且依赖目录中已登记的本地字体。动画仅依 `CaptionCue.startUs` / `durationUs` 工作，不做逐词同步或 ASR（自动语音识别）承诺；预览和导出共用同一 Canvas 字幕绘制器。

## 10. IP 口播内容镜头与原始目录边界（2026-10-23）

`packages/video-editor/src/demos/content-variants.tsx` 是本项目的六个内容呈现，复用已登记的六个 shotId，但不加载对应原始演示组件、截图、纹理、品牌字标、音频或固定英文文案。它们仅消费用户提交的 text/subline，由本项目已有 React 帧运行时与普惠体绘制，未引入 Remotion、跨仓运行依赖或任意代码执行。准确范围是 6 个 content 候选已接线、145 项未适配，不能由此宣称 151 个原始演示均已获授权或可用于口播。

原始镜头及附带纹理仍缺逐件权利证据，不对整批原始目录作许可推断。内置 149 个音效与 5 首 BGM 同样缺逐件作者、许可及再分发证据，继续不开放试听、插入或下载；文件名和其他依赖的许可证不能替代这批素材授权。公开前应另行完成权利核实；本轮未复制或分发新的原始素材。

源码接线和本地版权许可落盘不等于成片验收。预览/导出、字幕和人物遮挡、9:16/16:9/1:1 画幅、字体嵌入与真实下载均尚未运行验收，具体状态见 `docs/ip-talk-shot-compatibility.md`。


