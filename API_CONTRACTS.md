# API 契约与接入状态

网页工作台使用 **模式 A：服务端代理**。浏览器不领租约、不解密信封、不持有厂商长期 Key；AI 与工具请求经本项目代理，并携带 `Authorization: Bearer <access_token>`。**换口型素材的 OSS policy 直传是特定例外**：浏览器先带 JWT 向平台取短期上传凭证，再向凭证指定的 HTTPS `upload_host` 提交预签名表单；该直传请求不带平台 JWT、Cookie 或长期 Key，不代表允许浏览器直连厂商生成接口。

- 开发/预览：Vite 代理 `/api`、`/v1`、`/media` → `VITE_API_PROXY_TARGET`（默认 `http://127.0.0.1:8080`）。
- 生产：Nginx 把 `/api/`、`/v1/`、`/media/` 反代到 `https://worker.no996ai.cn`（见 `deploy/nginx-agent.conf`）。

字段与联调依据为后端集成契约；外部文档来源统一登记在 `MIGRATION_PROVENANCE.md`，本仓开发以本文件的本地摘要为入口。VideoRetalk 的状态、留存与计费以换口型前端对接专册为准；旧 OpenAPI 或通用集成文字若仍写「提交即扣固定价 / 失败不退款」，与专册存在冲突，应按专册的「成功后按实际秒数结算」处理并反馈契约漂移，不能把旧文字当作现行收费规则。新增接口在 `src/api/` 增加薄封装；禁止在浏览器写死厂商 Key。

## 客户端与响应包装

`src/api/client.ts` 导出两个 axios 实例（时间戳/令牌逻辑共用）：

| 实例 | baseURL | timeout | 用途 |
|---|---|---|---|
| `api` | `/api/v1` | 30s | 认证、账号、TTS |
| `v1Api` | `/v1` | 120s | 工具、声音复刻 |

**响应包装并不统一，实现时以本表为准：**

| 接口 | 包装 | 读取方式 |
|---|---|---|
| `/api/v1/auth/*`、`/api/v1/account/*` | `data`（部分含 `meta`） | `res.data.data` |
| `/v1/tools/web_search` | `data` | `res.data.data`，缺失即抛错 |
| `/v1/audio/voices`（GET） | `data` 与 `meta` **同层** | `res.data.data` + `res.data.meta` |
| `/v1/audio/voices`（POST/refresh/DELETE） | `data`；DELETE 返回 204 无 body | `res.data.data` |
| `/api/v1/ai/audio/speech` | **无 `data` 包装** | 直接读 `res.data.url`、`res.data.source_url` |
| `/api/v1/ai/chat/completions` | **无 `data` 包装**（OpenAI 形状，用裸 `fetch`） | 直接读 `choices`、`usage` |

统一错误结构（服务端约定）：`{ data, error: { code, message, details }, trace_id }`。`src/api/errors.ts` 归一为 `ApiError{ code, status, traceId }`，并把 `402 + BALANCE_INSUFFICIENT` 追加「请前往「账号与资产」查看余额。」。`apiErrorMessage()` 会附带 `trace` 便于排查。**真实 API 失败时直出后端错误文案，不回退到假成功数据。**

## 认证与会话

后端统一账号体系（Go `/api/v1/auth/*`），会话通道固定 `session_channel: 'app'`（区别于管理控制台 `admin`，不设平台控制台工作空间权限门禁）。

| 方法 | 路径 | 用途 | 关键参数 |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | 密码登录 / 邮箱验证码登录 | 密码：`{ credential, password, mode: 1\|2, session_channel, captcha_id?, captcha_code? }`；验证码：`{ email, code, mode, session_channel }` |
| `POST` | `/api/v1/auth/register` | 注册 | `{ email, phone, password, code, invite_code?, display_name?, session_channel }` |
| `POST` | `/api/v1/auth/verification-codes` | 发送邮箱/短信验证码 | `{ purpose: 'register'\|'reset_password'\|'login', email?, phone?, target?, captcha_id?, captcha_code?, locale? }`；60 秒倒计时，服务端 `retry_after_seconds` 节流 |
| `GET` | `/api/v1/auth/captcha?type=click` | 行为点选验证码 | 返回 `{ id, svg, prompt, icon_target, sequence }` |
| `POST` | `/api/v1/auth/refresh` | 刷新令牌 | `{ refresh_token }`；由 `client.ts` 裸 axios 调用（避免拦截器递归） |
| `POST` | `/api/v1/auth/reset-password` | 验证码重置密码 | `{ email, code, new_password }` |
| `POST` | `/api/v1/auth/logout` | 登出 | `{ refresh_token }`；失败被吞，本地仍清理 |
| `GET` | `/api/v1/auth/permissions` | 权限 | 已封装（`src/auth/permissions.ts`），**当前无调用点** |

**凭据存储**：`no996_wb_access`、`no996_wb_refresh`、`no996_wb_remember`（记住我时用 localStorage，否则用 sessionStorage），与管理后台及其他系统隔离。

**请求拦截**：按 URL 白名单跳过鉴权（`login`、`register`、`verification-codes`、`refresh`、`captcha`、`reset-password`、`invitations`、`accept`），其余自动注入 `Authorization`。

**401 处理**：单例刷新 Promise，换取新 token 后重放原请求；刷新失败清理 token 并跳转登录页。

**路由守卫**：`src/App.tsx` 在 `/workbench` 容器级做单点守卫，未登录一律 `<Navigate to="/login" replace />`；`authStatus === 'booting'` 期间只渲染占位，不渲染路由。**目前没有角色或权限级守卫。**

## 生成与账号接口

| 方法 | 路径 | 用途 | 前端模块 |
|---|---|---|---|
| `GET` | `/api/v1/models/default-chat` | 解析平台默认聊天 `model_code`（文本对话链首位） | `src/api/models.ts` 的 `resolveDefaultChatModel()` |
| `GET` | `/api/v1/models/default-tts` | 默认 TTS `model_code`、`default_voice`、`platform_voices` | `resolveTtsSynthesisConfig()` |
| `GET` | `/api/v1/models/default-lipsync` | 默认口型替换 `model_code` | `resolveDefaultLipsyncModel()` |
| `GET` | `/api/v1/models/default-vision` | 默认可视对话 `model_code`（带图 chat） | `resolveVisionChatModel()` |
| `POST` | `/api/v1/ai/chat/completions` | LLM 对话（OpenAI 形状，支持 tools 与 SSE 流式；`model` 可省略，服务端按是否含图选择 chat / vision 能力链默认） | `src/api/chat.ts`；由 `src/agent/clients.ts` 统一封装，浏览器不解析或发送模型标识。流式时解析 `choices[].delta.content` 与 `delta.reasoning_content`；本地验收 `npm run verify:chat-stream`（需 `WORKBENCH_ACCESS_TOKEN`） |
| `POST` | `/api/v1/ai/images/generations` | 图片生成与图生图；`model` 可省略，服务端选 `image-generation` 链首位；`image` 可选 URL 或 data URI 参考图 | `src/api/images.ts`；浏览器发送提示词、尺寸、数量及必要的母本图像引用 |
| `POST` | `/api/v1/ai/videos/generations` | 视频生成；`model` 可省略，服务端选 `video-generation` 链首位 | 由对应业务薄封装调用 |
| `POST` | `/api/v1/ai/videos/retalk` | 口型替换；`model` 可省略，服务端选 `lipsync` 链首位 | `src/api/video-retalk.ts`；浏览器只发送素材引用与任务参数 |
| `POST` | `/v1/tools/web_search` | 网页搜索（`queries: string[]`） | `src/api/tools.ts`；由 `src/agent/clients.ts` 暴露给 `kind: 'tool'` 阶段 |
| `POST` | `/v1/tools/web_fetch` | 网页抓取（`url`，默认 DeepSeek `POST /v1/tools/fetch` 源） | `src/api/tools.ts` 的 `webFetch()`；通用网页正文；按次计费，反爬见 `WEB_FETCH_BLOCKED_BY_SITE` |
| `POST` | `/v1/tools/wechat_fetch` | 微信公众号专用抽取（`url` → `kind` / `title` / `account` / `content` / `images[]`） | `src/api/tools.ts` 的 `wechatFetch()`；公众号向导「单链接采集」经 `src/services/wechat-article/resolve-wechat-article-url.ts` 映射首图为 `coverUrl`（专用接口关闭时回退 `web_fetch`） |
| `POST` | `/api/v1/ai/audio/speech` | TTS（请求省略 `model`，由后端使用 voice-synthesis 链首位；直配与高阶配音共用） | `src/api/tts.ts` |
| `GET` | `/v1/audio/voices` | 列出自己的复刻音色 + `meta` | `src/api/voice-clone.ts` |
| `POST` | `/v1/audio/voices` | multipart 创建复刻；`target_model` 可省略，由 voice-enrollment 默认配置裁决 | `VoicePage` |
| `POST` | `/v1/audio/voices/{id}/refresh` | 轮询审核 | `VoicePage` |
| `PATCH` | `/v1/audio/voices/{id}` | 重命名（body：`{ display_name }`，最长 32 字）；失败时前端保留本机 `localStorage` 别名兜底 | `src/api/voice-clone.ts` |
| `DELETE` | `/v1/audio/voices/{id}` | 删除音色 | `VoicePage` |
| `GET` | `/api/v1/account/balance` | 积分余额 | `AccountPage` |
| `GET` | `/api/v1/account/ledgers?page=&page_size=` | 流水（兼容数组或 `{items}`） | `AccountPage` |
| `GET` | `/api/v1/tenant/info` | 当前登录用户所属企业信息（企业账号） | `src/api/tenant.ts`；由 `AccountPage` 显示企业名称 |
| `GET` | `/api/v1/announcements/feed-version?channel=workbench` | 公告 feed 修订号（可匿名；支持 ETag / 304） | `src/api/announcements.ts`；顶栏 Provider 先探活再拉列表 |
| `GET` | `/api/v1/announcements/active?channel=workbench` | 当前有效公告列表（无 `body_md`；可匿名；ETag） | 同上；`sessionStorage` 缓存 revision |
| `GET` | `/api/v1/announcements/{id}` | 已发布公告详情（含 Markdown 正文；可匿名） | 公告弹窗选中时加载 |
| `GET` | `/api/v1/announcements?channel=&page=&page_size=` | 历史公告（需 JWT） | 公告弹窗「历史」页签 |

管理端 CRUD 在 `/api/v1/admin/announcements`（平台运营控制台「运营 → 公告管理」），工作台不调用写接口。

**`body_md` 正文格式**（详情接口返回、工作台用 `render-announcement-body.ts` 渲染）：

- Markdown + GFM（标题、列表、表格、代码块、链接等）。
- 可选受控 HTML：`class` 仅允许 `wb-ann-*`（如 `wb-ann-callout`、`wb-ann-callout--tip|warning|info`、`wb-ann-badge`、`wb-ann-divider`）；禁止 `style` / 事件属性。
- 服务端写入时会做 HTML 消毒（`internal/announcement`）；运营写法见管理台新建公告弹窗内「写法说明」。

### 默认模型解析（由后端网关负责）

业务 flow 与 `src/api/` 传输封装都不发送 `model`、`target_model`。`/api/v1/ai/chat/completions` 根据请求是否含图选择 chat / vision 能力链首位；图片、TTS、口型和视频生成分别使用对应能力链首位。省略默认模型时若能力链不可用，服务端返回明确错误，不由浏览器猜模型或回退到成功样例。

`GET /api/v1/models/default-*` 与 `src/api/models.ts` 的解析方法仍供调试、设置展示及音色目录使用，不作为生成请求的前置步骤。声音复刻创建同样省略 `target_model`，由服务端 voice-enrollment 默认配置裁决。模型链与模型可用性以服务端控制台为准。

**联调检查**：登录后触发一次生成，在 DevTools 检查 chat、image、speech、retalk 请求体中没有 `model`；服务端日志/追踪应显示实际命中的能力链模型。模型不可用时应展示真实失败与 trace 信息。

### 生成类能力的统一内核

人设、爆款标题、视频脚本、直播脚本共用一个前端 agent 内核 `src/agent/`，浏览器内编排、经上述代理接口调用模型与搜索：

- 传输层只有 `src/api/chat.ts` 与 `src/api/tools.ts`；`src/agent/clients.ts` 把它们封装为 `AgentClients{ chat, search, isMock }`，业务 flow 不直接 import `src/api/*`。
- 远端模式返回真实后端错误；`VITE_WORKBENCH_AI_MODE=demo` 或 `VITE_PERSONA_USE_REMOTE=0` 时改用 `createMockAgentClients`，产出必须标注「演示」。
- 编排逻辑不得迁到服务端，密钥不得进浏览器。**不展示工具轨迹**：`kind: 'tool'` 的步骤只报「已执行检索」，检索原始返回不渲染、不进界面。
- 落库经 `AgentSink` 抽象：页面内运行用 `createMemorySink`，后台任务执行器用 `createTaskSink`（写任务 `payload`，`meta` 值必须是字符串）。

人设本机副本存 IndexedDB `no996-workbench-persona`；云端 CRUD 仍待仓储 API。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8080` | 代理目标 |
| `VITE_BASE_PATH` | `/` | 部署子目录前缀 |
| `VITE_WORKBENCH_AI_MODE` | `remote` | 设 `demo` 切本地样例/mock（含发布面板禁用） |
| `VITE_CHAT_MODEL` | 未设 | 仅供默认模型接口诊断脚本使用，不用于生成请求 |
| `VITE_VISION_CHAT_MODEL` | 未设 | 仅供默认模型诊断，不用于生成请求 |
| `VITE_PERSONA_USE_REMOTE` | 未设 | 设 `0` 强制人设 mock |

## IP 口播视频

`/workbench/ip-video` 复用现有模型代理、正式 TTS、数字人成片与本机公共编辑器；不调用仅为建议的 `/script/extract`、`/cover`、`/render`、`/task/:id`。

- `ip_video_create` 后台任务通过 `src/agent/` 的统一客户端调用 `/api/v1/ai/chat/completions`；浏览器内执行方向建议、按需写稿、受限剪辑方案与本机校验，不传模型标识、不执行模型生成代码。任务只产出方案，不嵌套等待配音任务。输入与结果仅保存在按账号隔离的本机任务库，不能称为云端作品。
- `ip_video_audio` 沿用 `createSpeech` 和 `POST /api/v1/ai/audio/speech`；只在用户检查文稿及音色并确认后入队。原声或已有配音优先，不因更换风格、镜头或切换视图自动重新配音。正式费用由服务端结算。
- 已有视频不进行隐式语音转写；没有文稿时可保留原声与画面，制作字幕需要用户提供原文或 SRT。字幕估时不是识别或逐字对齐。链接正文仍经 `extractIPVideoScript` 的既有扩展采集桥获取，缺正文明确失败。
- 当前视频导出走 `video_factory_export`，`source: ip-composition`，经公共 `ExportController` 与 Mediabunny 在本机浏览器编码 MP4、混入真实配音和视频原声；能力不足或缺素材时明确失败。本机合成本身不调用服务端渲染或扣费接口，合成期间保持标签页打开。
- 当前口播工程与素材库为 `no996-ip-video-editor-v1`，视频工厂为 `no996-video-editor-v1`，内部继续按账号 scope 隔离；没有跨库兜底读取、自动搬迁或删除工厂作品。方案应用到同一工程并支持撤销；作品版本变化时保留当前修改，可将原方案另存副本。
- 演示使用显式 mock，应标注“演示”，不进入正式任务队列、不提交 TTS、不展示模拟余额或假扣费。纯文字/照片预览不代表已生成人物说话。

## 数字人：真实换口型（模式 A，2026-10-16）

用户已批准站内真实换口型，并与 IP 视频的画中画、分段、字幕及本机编码衔接。以下为契约与源码接线记录，**不代表网页已通过真实收费、浏览器播放/下载或产品验收**，后端专册的既有真机记录也不等于本网页验收。

| 方法 | 路径 | 本地封装与包装 |
|---|---|---|
| `GET` | `/api/v1/ai/uploads/policy?capability=lipsync&kind=video\|audio\|ref_image` | `src/api/media-uploads.ts` 的 `uploadLipsyncAsset` 使用通用策略入口；不传模型，由服务端按 lipsync 链解析 |
| `GET` | `/api/v1/ai/videos/retalk/upload-policy?kind=…` | 专册登记的专用凭证入口，返回裸 policy；不是上述通用包装，不可混读 |
| `POST` | `/api/v1/ai/videos/retalk` | `src/api/video-retalk.ts` 的 `submitRetalk`；裸任务对象 |
| `GET` | `/api/v1/ai/videos/retalk/tasks/{task_id}` | `getRetalkTask`；裸任务对象 |
| `POST` | `/api/v1/ai/videos/retalk/tasks/{task_id}/cancel` | `cancelRetalkTask`；成功后再查询服务端权威状态，不在本机猜测取消成功 |

### 上传与输入

- `video` / `audio` 与可选 `face_reference` 使用 `oss://` 临时引用或无需登录可访问的公网 HTTP(S) URL，不接受 blob URL、localhost、内网地址或 base64。口型模型由服务端 `lipsync` 能力链解析。
- policy 直传表单包含 `OSSAccessKeyId`、`Signature`、`policy`、`x-oss-object-acl`、`x-oss-forbid-overwrite`、`key`、`success_action_status=200`，**`file` 必须最后追加**。key 与返回的 `oss://` 引用共用同一规范化文件名，上传需在 `expire_in_seconds` 内完成。`direct: true` 的当前通道要求提供公网 URL，不假装本地文件已上传。
- 大小取 policy 与模型限制的更严值：视频 ≤300 MB、音频 ≤30 MB、参考图 ≤10 MB。模型视频/音频时长 2–120 秒；视频 15–60 fps、边长 640–2048；参考图宽高比 ≤2、最长边 ≤4096。浏览器可读取的元数据与上传大小校验不替代服务端最终校验。
- 临时上传 **48 小时失效**，且厂商明确不用于生产环境、高并发与压测；它不是生产永久素材库。长期素材需要另行接入稳定对象存储。本机项目中的原始 Blob 与一次任务使用的临时引用应分开管理，过期重新上传，不把 `oss://` 当作永久资源地址。
- 人物临时引用只在同一素材、同一模型下缓存最多 **47 小时**，过期后从本机原片重新上传；48 小时是服务端临时存储期限，不是永久素材承诺。驱动音频支持上传文件、读取已完成的直配音频任务或使用经实际时长读取的公网 URL，不能提交 `blob:` 或站内相对路径给上游。
- 多人视频需指定人脸参考图；传 `query_face_threshold`（120–200）时必须同时传参考图。音频长于视频时需明确选择：`video_extension=false` 按较短者截断；`true` 按倒放/正放扩展原视频，不能宣称生成了新动作。

### 状态、恢复与收费

- 真实状态仅有 `QUEUED`、`SUBMITTED`、`RUNNING`、`SUCCEEDED`、`FAILED`、`CANCELED`、`EXPIRED`。**接口没有真实完成百分比**；只展示状态、可用的排队位置与等待估计，不把本地动画或上传字节进度当作生成进度。
- 仅远端 `QUEUED` 可取消；已提交上游返回 `409 TASK_NOT_CANCELABLE`，应保留原状态并允许刷新。尚未发出的本地排队任务可仅在本机撤销，不能据此声称远端任务已停止。
- `QUEUED` 每 5 秒查一次，`SUBMITTED` / `RUNNING` 每 15 秒；观察上限分别 10 / 30 分钟，到限只暂停自动观察并允许手动刷新，不判远端失败。页面隐藏/登出停止观察，恢复后沿用已保存的远端任务号（remoteId，即服务端 `task_id`），不重新提交。
- 同一业务提交固定并持久化 `client_request_id`；网络结果不确定时由用户用原标识确认，禁止自动生成新标识重提。`EXPIRED`/404 显示「任务不存在或已过期，请重新提交」，不自动重跑。`429 USER_CONCURRENCY_LIMIT` 与 `QUEUE_SATURATED` 区分，后者遵守 `Retry-After`。
- 本机任务 kind 为 `digital_human_retalk`，共用后台任务库和账号隔离。远端任务观察不应长期占用普通本机生成队列；恢复使用既有任务号与幂等标识。源码具体持久化字段以任务 payload 为准。
- 专册现行口径是 **`SUCCEEDED` 后按 `ceil(usage.video_duration) × 每秒单价` 结算一次**；排队、取消、拒绝与 `FAILED` 不扣分，提交前仍校验余额。单价由模型目录提供，实际金额以 `points_charged` 为准，不在前端固定单价或用缺失用量推算零费用。成功且附结算警告仍交付产物，不诱导重复提交。

### 成品与本机合成

- 正常 `video_url` 为站内 `/media/video/…`，默认留存 **7 天**（运维可调），可用于播放/下载，但不是永久托管承诺。到期 404 应显示保留期提示。
- 镜像落盘失败时，`SUCCEEDED` 可能附 `error`，`video_url` 回退到上游地址，此时仅 **24 小时**有效，应提示尽快下载。**`source_url` 不持久化到业务库，也不作下载按钮或长期素材引用**。
- 数字人项目、段落版本、原片与已保存的成片 Blob 在本机 IndexedDB；IP 视频消费选中版本或用户本机素材进行画中画、分段剪辑、字幕与浏览器编码。该合成不调用服务端渲染/扣费接口；远端媒体需可被浏览器跨域读取，否则提示下载后导入，不能绕过跨域约束或伪造导出成功。
- IP 视频合成的字幕估时不是语音识别或真实逐字对齐；画中画也不等于抠像。具体本机公开资产见 `docs/reusable-assets.md`。

## 媒体地址

TTS 返回的站内相对路径（如 `/media/audio/xxx.wav`）由 `src/api/media.ts` 的 `resolveMediaUrl()` 拼 `window.location.origin`；上游 OSS 的 `http://` 直链会被升级为 `https://`，避免 HTTPS 页面下的混合内容拦截。

## 扩展桥接（协议 1.1.0，给插件实现方）

网页工作台与知源扩展通过隔离内容脚本中继通信（`postMessage` + 严格 origin 校验），协议版本常量 `WORKBENCH_BRIDGE_PROTOCOL_VERSION = '1.1.0'`。类型与常量在 `src/services/extension/workbench-bridge-contract.ts`，插件侧需保持字段一致并在 `workbench-bridge-service` 的 `handleRequest` 中实现下列方法。

| 方法 | 状态 | 说明 |
|---|---|---|
| `connection.getStatus` / `accounts.list` / `accounts.connect` | 已有 | 连接与账号态；网页只收脱敏后的账号状态与公开元数据 |
| `materials.list` / `materials.read` | 网页与插件侧已接线，真实环境待联调 | `materials.list` 以 `{ offset, limit }` 分页返回不含正文的预览；用户确认后 `materials.read` 以 `{ ids }` 读取所选素材正文。导入当前账号的本机素材库，重复项跳过；旧插件提示更新。插件素材库本身为本机共享库，不按工作台账号隔离。 |
| `collection.resolve` | 已有（已增强） | 单链解析：`{ url }` → `{ ok, item?, error? }`。`item.content` 填正文（非仅标题）；`imageUrls` 为**正文图**并与 `mediaLayout.bodyImageUrls` 对齐；可选 `likes` / `comments` / `collects` / `mediaLayout` |
| `collection.search` | 新增 | 关键词批量（首期仅 `xiaohongshu`）：`{ platformId, keyword, limit: 5–20, filters? }` → `{ ok, items?, error? }`。`filters` 含 `minLikes` / `minComments` / `publishWithin` / `distance` / `collectMode` / `sortType` / `noteType` / `searchRange` |
| `asset.fetch` | 新增 | 网页直连 CDN 常因 CORS 失败，改由扩展代拉：`{ url }` → `{ ok, blobBase64?, mime?, error? }`；`blobBase64` 是原始字节 base64（非 data URL） |
| `channels.checkAuth` / `publish.start` | **扩展侧未实现** | 属发布能力；当前返回「未知的桥接方法」，网页端 `PublishToPlatformBar` 会看到该错误 |
| `session.*` | 新增 | 工作台登录态授权（协议 1.1.0 扩展字段，网页可不使用） |

`WorkbenchBridgeCollectedItem` 扩展字段：`likes?`、`comments?`、`collects?`、`mediaLayout?`。`WorkbenchBridgeMediaLayout` 含 `bodyImageUrls`（正文多图）、`coverUrls`（封面 Tab，通常 0~1）、`videoUrls`（可播放地址）、`firstBodySharesCoverAsset`（首图与封面同资产时附件条显示「封面」角标）。

**已知边界（不做假承诺）**：

1. `collection.search` 的 `filters.distance` / `filters.publishWithin` 当前通道不生效；`minLikes` / `minComments` 通过采集条件的互动下限生效。
2. `asset.fetch` 依赖 host 权限：各平台 CDN（`xhscdn` / `douyinpic` / `hdslb` / `bilivideo` / `byteimg` / `kximgs` …）已在 `host_permissions`；其余域名落在 `optional_host_permissions`，未授权时返回可操作的中文提示，不静默失败。单文件上限 20 MB。
3. 正式模式未实现 `collection.search` 时，关键词 Tab 会超时或报错；链接 Tab 仍可用 `collection.resolve`（1.0 插件）。演示模式（`VITE_WORKBENCH_AI_MODE=demo`）不调用扩展，使用 `material-import-mock.ts`。
4. 展示时 B 站 CDN 不设 `no-referrer`，其余平台设 `no-referrer`；失败走 `asset.fetch` 转 blob。抖音 / 小红书 / B 站单链解析在扩展内走 `resolveRecordImageCandidates`（与 scrape-local-preview 同源）。下游模型引用正文图见 `material-public-media.ts` 的 `getMaterialPublicImageUrls`。

**素材存储**：采集结果存当前浏览器 IndexedDB `no996-workbench-materials`，按 `ownerUserId` 隔离，不上传后端、不跨设备同步；默认仅存 https URL，`localStorage` 键 `no996-material-persist-images` 默认关闭，开启后才异步写入 IndexedDB 的模糊 JPEG 兜底字段（可一键清除）。凭证安全：社媒 Cookie 与账号密码留在浏览器内部，不回传网页。

## 接入状态与待提供资料

「已接入」指前端已通过本项目代理调用后端接口；资料未到位的能力保持待接入，**不挑选替代供应商、不造下载与媒体样例、不改收费规则**。

| 功能 | 当前状态 | 待提供 / 待确认 |
|---|---|---|
| 认证与账号 | 已接 `/api/v1/auth/*`（登录、注册、验证码、刷新、登出、点选验证码） | 无。`GET /api/v1/auth/permissions` 已封装但暂无调用点 |
| 人设生成 | 已接 `chat/completions` + `web_search`；后台任务 `persona_generate` 内跑前端 agent loop | 云端人设仓储 API（账号隔离的 CRUD / 启用档）及与本机 IndexedDB 的同步策略 |
| 爆款标题 | 已接 `chat/completions`；`titles_generate` 内跑 8 步 flow，约 6 次模型调用 | 输出格式异常时前端报错，不回退样例 |
| 视频脚本 / 直播脚本 | 已接 `chat/completions`；`script_generate` 内跑 8 步 flow；可导出 Markdown 与自包含提词器 HTML | 同上 |
| 小红书 / 公众号图文 | 页内 `social-compose` Agent 流式；向导共用真实切入点与大纲 Agent flow；图片请求由后端按 image-generation 链解析默认模型 | 图片供应商 Key、参考图支持与费用需运维配置并验收；扩展 `collection.search` / `asset.fetch` 见上节 |
| 声音克隆 / TTS | 已接 `/v1/audio/voices` 与 `/api/v1/ai/audio/speech`；克隆积分读 `meta.points_per_clone` | 运维需配置复刻 Key 与音频存储；未配置时可能返回 503 `VOICE_CLONE_NOT_CONFIGURED` |
| 插件 / 采集与素材 | 桥接协议 `1.1.0`，Social Studio 向导的采集步骤已接网页侧，演示模式可 mock | 扩展侧补齐 `channels.checkAuth` / `publish.start`；官方商店上架 |
| 图文发布（一键发布） | 经插件桥 `publish.start`；演示模式下按钮禁用 | 各平台发布协议字段与失败回执；发布结果校验 |
| 数字人 | 已批准模式 A 真实换口型；API 薄封装、`digital_human_retalk` 任务观察、按账号隔离的本机项目/段落/版本源码已接线 | 真实上传/计费、取消竞争、刷新与换号恢复、地址过期、远端素材 CORS、前台编码音画同步、MP4/WebM 降级与实际下载的网页端验收；生产永久素材存储 |
| 图片生成 | 后端 `/api/v1/ai/images/generations` 已有能力链默认路由；网页请求不传 model | 供应商 Key、模型目录、参考图能力与计费配置需运维确认；图片失败不得用本地示例假装成功 |
| 会员与积分 | 纯展示：试用 0 元、专业月费 29 元（年付 23 元/月）、企业年费 299 元（年付 239 元）；无支付接口 | 生产商品配置、试用额度、积分赠送与各工具消耗规则、订单与退款流程 |
| 桌面端专属入口 | 侧栏展示 12 项但不可导航 | 各能力的网页替代方案或跳转目标 |

### 图片生成的接入约束

前端发送提示词、可选的母本参考图 `image`（URL 或 `data:image/...;base64`）、数量、尺寸/比例与界面选项；不发送模型标识。复刻流程有原图且用户未选择保留原图时使用图生图；逐张文字由网页排版合成，不交给生图模型绘制。平台密钥与供应商请求留在服务端，`image-generation` 能力链负责选择默认模型与上游适配。生产可用性、参考图能力、尺寸/数量限制、任务状态、超时与计费以服务端目录和实际配置为准。图片失败不得用本地示例假装成功。

### 生成网关契约（后端已实现）

正式生成接口由 Go 后端统一执行、计费与返回真实错误。网页请求体省略 `model`；后端按 chat / vision、image-generation、voice-synthesis、lipsync、video-generation 能力链解析首位默认模型。默认链不可用时返回明确的服务端错误，不会静默改用其他模型。声音复刻创建省略 `target_model` 时由 voice-enrollment 默认设置裁决。

前端不持有供应商密钥，不直连供应商。上线可用性仍取决于管理员配置能力链、模型目录、Key 池与计费信息；图片供应商实际配置、参考图能力及费用须以服务端验收为准。

## 通用原则

- 正式生成走既有 Go 后端，浏览器不持有厂商长期 Key，不另起服务或数据库。换口型预签名 OSS 上传是特定直传例外，不带平台 JWT/Cookie。
- 插件正式接入要验证 `origin`、`source`、协议版本、任务 ID 与目标页面，**禁止**传输平台 Cookie 或长期令牌。
- 正式接口失败时显示真实失败，不回退到成功样例；未确认的能力保持待接入，不编造接口、单价或产物。
