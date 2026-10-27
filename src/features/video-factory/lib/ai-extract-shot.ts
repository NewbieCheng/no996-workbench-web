/**
 * 单镜头 AI 一键智能拆解与全参数填充服务
 *
 * 用户粘贴一段口播文案或产品业务台词，真实大模型自动将输入拆解为
 * 该镜头所需的主标大字、正文阐述、看板各卡片标题、KPI 指标数据与匹配配色方案。
 */

import { chatCompletions } from '../../../api/chat'
import { isWorkbenchAiDemoMode } from '../../../api/workbench-ai'
import type { ShotSchema } from '../../../../packages/video-editor/src/demos/shot-schemas'

export type AiExtractShotOptions = {
  inputText: string
  shotId: string
  schema: ShotSchema
}

const EXTRACT_SHOT_SYSTEM_PROMPT = `你是一位顶尖的视频动效导演与数据可视化专家。
用户将给你一段业务台词/文案，以及目标视觉镜头所需的参数字段清单。
你的任务是将这段文案提炼、拆解并填满镜头所需的所有参数字段，使视频镜头画面极具视觉冲击力与专业数据质感。

【要求】
1. 核心大字/主标题（如 text, title）：控制在 2-6 个字以内，极具冲击力。
2. 正文/副标（如 subline）：控制在 10-18 个字以内，言简意赅。
3. 看板与图表（如 dashboardTitle, kpi1Label, kpi1Value, kpi2Label, kpi2Value, chartTitle 等）：
   - 如果用户输入包含具体业务数据，则提取对应指标与数值；
   - 如果用户输入没有具体数字，请根据其业务语境合理生成专业、可信、震撼的数据（例如 2.48M、42s -18%、99.4%、+328%）。
4. 视觉主题（如 colorTheme）：从 dark-blue(深蓝科技)、neon-purple(极光暗紫)、cyber-teal(赛博青绿)、obsidian-gold(曜石黑金)、sunset-orange(活力暖阳)、porcelain-light(极简瓷白) 中挑选最契合业务氛围的一款。
5. 必须且只能输出严格合法的 JSON 对象，对象的键必须对应所给字段清单中的 key，值的类型统一为字符串。禁止输出任何 Markdown 说明或额外文字。`

export async function extractShotParamsWithAi({
  inputText,
  shotId,
  schema,
}: AiExtractShotOptions): Promise<Record<string, string>> {
  const cleanInput = inputText.trim()
  if (!cleanInput) return {}

  // 本地演示模式兜底
  if (isWorkbenchAiDemoMode()) {
    const fallbackOverrides: Record<string, string> = {}
    const words = cleanInput.split(/[\s,，。！!？?]+/).filter(Boolean)
    const primary = words[0]?.slice(0, 6) || '智造未来'
    const secondary = words.slice(1).join(' ').slice(0, 16) || 'AI 全流程智能驱动'

    for (const field of schema.fields) {
      if (field.isSlot) continue
      if (field.key === 'text' || field.key === 'title' || field.key === 'brand') {
        fallbackOverrides[field.key] = primary
      } else if (field.key === 'subline' || field.key === 'slogan') {
        fallbackOverrides[field.key] = secondary
      } else if (field.key === 'highlightWord') {
        fallbackOverrides[field.key] = primary.slice(0, 4)
      } else if (field.key === 'dashboardTitle') {
        fallbackOverrides[field.key] = `${primary}实时大盘`
      } else if (field.key === 'kpi1Label') {
        fallbackOverrides[field.key] = '总曝光吞吐'
      } else if (field.key === 'kpi1Value') {
        fallbackOverrides[field.key] = '3.86M'
      } else if (field.key === 'kpi2Label') {
        fallbackOverrides[field.key] = '综合转化率'
      } else if (field.key === 'kpi2Value') {
        fallbackOverrides[field.key] = '+28.4%'
      } else if (field.key === 'colorTheme') {
        fallbackOverrides[field.key] = 'cyber-teal'
      } else if (field.defaultValue) {
        fallbackOverrides[field.key] = field.defaultValue
      }
    }
    return fallbackOverrides
  }

  // 组装字段描述供大模型精准对齐
  const fieldDescriptions = schema.fields
    .filter((f) => !f.isSlot)
    .map((f) => `- ${f.key} (${f.label}): 类型=${f.type}, 示例/默认值=${f.defaultValue || f.placeholder || ''}`)
    .join('\n')

  const userPrompt = `【镜头ID】: ${shotId}
【用户业务输入文案】:
${cleanInput}

【镜头所需填写的参数清单】:
${fieldDescriptions}

请直接输出符合上述字段要求的完整 JSON 字典：`

  try {
    const response = await chatCompletions({
      messages: [
        { role: 'system', content: EXTRACT_SHOT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    })

    const content = response.choices?.[0]?.message?.content?.trim() || ''
    // 去除 ```json 代码块外壳
    const cleanJson = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```$/, '')
      .trim()

    if (cleanJson.startsWith('{') && cleanJson.endsWith('}')) {
      const parsed = JSON.parse(cleanJson)
      const sanitized: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' || typeof v === 'number') {
          sanitized[k] = String(v)
        }
      }
      return sanitized
    }
  } catch (err) {
    console.warn('AI 拆解镜头参数失败，回退基础赋值:', err)
  }

  // 异常兜底
  return {
    text: cleanInput.slice(0, 6),
    title: cleanInput.slice(0, 6),
    subline: cleanInput.slice(0, 20),
  }
}
