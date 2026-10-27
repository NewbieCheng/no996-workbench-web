/**
 * 人设生成的演示应答器。
 *
 * 演示模式不调用正式模型，但返回结构必须与正式输出一致（围栏 Markdown），
 * 以便校验步骤与页面渲染走同一条路径。
 */
import type { MockResponder } from '../../../agent'
import { IP_PROFILE_FENCE } from '../lib/account-card.ts'
import type { ProfileKind } from '../../../services/persona'

function fieldOf(messages: Array<{ role: string; content: string }>, key: string): string {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n')
  const match = new RegExp(`-\\s*${key}：\\s*(.+)`).exec(userText)
  return match?.[1]?.trim() || '待补充'
}

function buildUserMarkdown(messages: Array<{ role: string; content: string }>): string {
  const name = fieldOf(messages, '公开姓名或昵称')
  const occupation = fieldOf(messages, '职业身份、行业与年限')
  const products = fieldOf(messages, '产品或服务')
  const audiences = fieldOf(messages, '服务人群')
  const pain = fieldOf(messages, '客户场景与原话')
  const redPersona = fieldOf(messages, '人设红线')
  const redContent = fieldOf(messages, '内容红线')
  const redStyle = fieldOf(messages, '风格红线')
  return `# 人设定位 Profile

## 一、人物优势

- 真实优势：${occupation}（演示归纳，非正式模型结论）
- 可放大的竞争力：能把${products}讲成目标人群听得懂的方案

## 二、目标人群与需求

- 核心客户：${audiences}
- 典型场景：需要${products}却缺少清晰表达与承接
- 三大痛点：${pain}
- 当前替代方案及其不足：通用内容服务难贴合其具体业务
- 购买动机：希望有可核对、可重复使用的定位与表达

## 三、3 套人设定位方案

### 定位方案 A：专业权威型

- 基础身份：${occupation}
- 核心优势：把复杂业务拆成可执行表达
- 精准用户：${audiences}
- 核心需求：建立可信专业形象
- 细分赛道：与${products}直接相关的服务
- 差异化价值：用真实经历支撑表达，不堆头衔
- 可信背书：问卷中已提供的相关经历与案例
- 产品承接：${products}
- 一句话专业定位：帮${audiences}把${products}说清楚并承接服务
- 三个人格标签：专业、清晰、可核对
- 一句记忆点表达：先把真实优势讲明白

### 定位方案 B：垂直细分型

- 基础身份：面向特定人群的${occupation}
- 核心优势：熟悉该类客户的具体场景
- 精准用户：${audiences}中最需要优先服务的一群人
- 核心需求：解决眼前具体问题
- 细分赛道：更窄的场景化服务
- 差异化价值：只服务一类人，表达更准
- 可信背书：代表案例与客户原话
- 产品承接：现有或计划中的对应服务
- 一句话专业定位：专门服务${audiences}
- 三个人格标签：专注、贴地、好懂
- 一句记忆点表达：只做这一类人真正要的

### 定位方案 C：实战差异化型

- 基础身份：能上手交付的${name || occupation}
- 核心优势：方法可复用、结果可描述
- 精准用户：愿意尝试新做法的${audiences}
- 核心需求：看到和别人不一样的做法
- 细分赛道：以方法差异为主的表达
- 差异化价值：给步骤和边界，而不是口号
- 可信背书：可核实成果或「暂无」
- 产品承接：${products}
- 一句话专业定位：用可执行方法帮客户落地
- 三个人格标签：实操、直给、守边界
- 一句记忆点表达：能做的才说，不能承诺的不说

## 四、3 套账号包装建议

### 专业型

- 账号昵称建议：${name || '专业定位号'}
- 账号简介：${occupation}，为${audiences}提供${products}。
- 置顶内容主题：如何判断这项服务是否适合你

### 亲和型

- 账号昵称建议：${name || '陪跑记录'}
- 账号简介：和你一起把${products}讲明白、做落地。
- 置顶内容主题：客户常问的三个真实场景

### 差异化型

- 账号昵称建议：先讲清楚再承接
- 账号简介：不堆头衔，用方法和边界说明我能帮你什么。
- 置顶内容主题：和其他做法相比，我具体不同在哪

## 五、禁止事项与表达红线

- 人设红线：${redPersona === '待补充' ? '暂无特别限制' : redPersona}
- 内容红线：${redContent === '待补充' ? '暂无特别限制' : redContent}
- 风格红线：${redStyle === '待补充' ? '暂无特别限制' : redStyle}`
}

function buildCompanyMarkdown(messages: Array<{ role: string; content: string }>): string {
  const name = fieldOf(messages, '企业名称')
  const industry = fieldOf(messages, '所属行业')
  const business = fieldOf(messages, '主营业务版图')
  return `# 企业全貌资料

## 企业与赛道定位

- 企业名称：${name}
- 行业赛道：${industry}
- 主营业务版图：${business}
- 企业愿景与发展使命：成为${industry}领域可信赖的专业服务伙伴（演示归纳）

## 目标市场与受众结构

- 核心服务客群/市场：需要${business}支持的中小企业与成长型团队

## 企业核心壁垒与竞争优势

- 核心竞争壁垒：贴近客户场景的交付经验与可复用方法论（演示补全，非正式模型结论）`
}

export function createPersonaMockResponder(kind: ProfileKind): MockResponder {
  const fence = kind === 'user' ? IP_PROFILE_FENCE : 'companyprofile'
  return (request) => {
    const messages = request.messages as Array<{ role: string; content: string }>
    const body = kind === 'user' ? buildUserMarkdown(messages) : buildCompanyMarkdown(messages)
    return `\`\`\`${fence}\n${body}\n\`\`\``
  }
}
