/**
 * 真实大模型 AI 文案精炼服务
 *
 * 调用项目统一的大模型网关，将长句、口语化文案浓缩为视觉冲击力强、字数合规的短视频黄金文案。
 */

import { chatCompletions } from '../../../api/chat'
import { isWorkbenchAiDemoMode } from '../../../api/workbench-ai'

export type AiRefineOptions = {
  text: string
  fieldLabel?: string
  maxChars?: number
}

const AI_REFINE_SYSTEM_PROMPT = `你是一位顶尖的短视频视觉导演与文案大师。
用户将给你一段当前视频镜头的文案。你的任务是将其提炼为极具视觉冲击力、节奏感强、适合在动效镜头中呈现的精炼文案。

【原则】
1. 提炼核心痛点或关键卖点，剔除口语废话。
2. 保持在指定字数内（默认4-8字），简洁醒目。
3. 严格只输出精炼后的纯文字内容，禁止包含引号、句号、解释或任何多余字符。`

export async function refineTextWithAi({
  text,
  fieldLabel = '主标题',
  maxChars = 8,
}: AiRefineOptions): Promise<string> {
  const cleanInput = text.trim()
  if (!cleanInput) return ''

  // 本地纯演示模式下兜底
  if (isWorkbenchAiDemoMode()) {
    return cleanInput
      .replace(/[，。！？、…,.!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars)
  }

  try {
    const userPrompt = `字段定位：${fieldLabel}
目标字数：${maxChars} 字以内
当前文案：${cleanInput}

请直接输出精炼后的爆款文案：`

    const response = await chatCompletions({
      messages: [
        { role: 'system', content: AI_REFINE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 60,
    })

    const result = response.choices?.[0]?.message?.content?.trim()
    if (result) {
      // 过滤可能残留的引号
      return result.replace(/^["'“‘]|["'”’]$/g, '').slice(0, maxChars + 2)
    }
  } catch (err) {
    console.warn('AI 文案精炼调用异常，回退本地提取:', err)
  }

  // 网络异常或兜底回退
  return cleanInput
    .replace(/[，。！？、…,.!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
}
