/**
 * @file source-create.ts
 * 执行器：一键从分享链接采集素材并调用后端 AI 进行二次创作
 *
 * 当前只服务「小红书笔记」与「公众号文章」两个入口；
 * titles / video-script / live-script 分支保留仅用于解析历史任务。
 */

import { chatCompletions } from '../../../api/chat'
import { buildUserChatMessage } from '../../../lib/chat-attachments/build-message'
import { extensionClient } from '../../extension/extension-client'
import { materialRepository } from '../../materials/material-repository'
import type { WorkbenchTaskRepository } from '../repository'
import type { SourceCreatePayload, WorkbenchTaskRecord } from '../types'

export async function executeSourceCreate(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as SourceCreatePayload | undefined
  if (!payload) throw new Error('任务数据丢失')

  let title = payload.collectedTitle
  let content = payload.collectedContent
  let author = payload.collectedAuthor
  let coverUrl = payload.collectedCoverUrl
  let platform = payload.collectedPlatform

  // 1. 如果有链接且未预先采集，则调用插件桥接
  if (payload.sourceUrl && (!content || !title)) {
    await repo.patchJob(job.id, { subtitle: '正在通过插件采集内容…' })
    const collected = await extensionClient.resolveWork(payload.sourceUrl)
    title = collected.title || '无标题内容'
    content = collected.content || collected.title || ''
    author = collected.author || '未知作者'
    coverUrl = collected.coverUrl
    platform = collected.platformId

    // 自动保存到当前用户的本机素材库
    await materialRepository.saveCollectedItem(job.ownerUserId, collected)
  }

  // 2. 如果指定了本地素材 ID
  if (payload.materialId && (!content || !title)) {
    const mat = await materialRepository.getMaterial(job.ownerUserId, payload.materialId)
    if (mat) {
      title = mat.title
      content = mat.content || mat.title || ''
      author = mat.author
      coverUrl = mat.coverUrl
      platform = mat.platformId
    }
  }

  await repo.patchJob(job.id, { subtitle: 'AI 正在深度改写与创作…' })

  // 3. 构建模型 Prompt
  const referenceInfo = `
【参考来源内容】
平台：${platform || '未知'}
作者：${author || '未知'}
原标题：${title || '未命名'}
原内容正文：
${content || '暂无详细正文'}
`.trim()

  const personaPrompt = payload.personaContent
    ? `\n【表达风格人设参考】：\n${payload.personaContent}`
    : ''
  const instructionPrompt = payload.instructions ? `\n补充要求：${payload.instructions}` : ''

  let systemPrompt = '你是专业的中文新媒体内容创作总监。'
  let userPrompt = ''

  if (payload.targetType === 'xiaohongshu') {
    systemPrompt = `你是小红书头部爆款创作者。请基于用户提供的参考素材，二次创作成一篇极具吸引力的小红书笔记。必须包含标题、正文（适当 emoji 排版、分段清晰、提炼痛点与干货）、互动提问及 3-5 个热门话题标签。`
    userPrompt = `${referenceInfo}${instructionPrompt}${personaPrompt}\n\n请直接输出完整的爆款笔记内容。`
  } else if (payload.targetType === 'wechat-article') {
    systemPrompt = `你是资深公众号主笔。请基于用户提供的参考素材，二次创作成一篇结构严谨、逻辑清晰、有深度思考与实践价值的深度公众号长文。`
    userPrompt = `${referenceInfo}${instructionPrompt}${personaPrompt}\n\n请输出完整的深度文章，包含主标题及正文各级章节。`
  } else if (payload.targetType === 'titles') {
    systemPrompt = `你是爆款标题专家。请基于素材提炼 5 个高点击率标题候选，格式为 JSON: {"sections":[{"label":"候选 1","content":"标题内容"}]}`
    userPrompt = `${referenceInfo}${instructionPrompt}${personaPrompt}`
  } else {
    // 历史任务兼容：titles / video-script / live-script 曾在「导入参考来源」里生成 JSON 小节。
    // 新任务不再走这里（标题与脚本已改为各自的 Agent 流程，见 features/titles 与 features/script-lab）。
    systemPrompt = `你是短视频脚本主编。请基于参考素材整理出包含开场黄金3秒、核心论点/步骤、画面建议和行动号召的完整口播分段脚本。格式为 JSON: {"sections":[{"label":"阶段","content":"内容"}]}`
    userPrompt = `${referenceInfo}${instructionPrompt}${personaPrompt}`
  }

  const isJsonFormat =
    payload.targetType === 'titles' ||
    payload.targetType === 'video-script' ||
    payload.targetType === 'live-script'

  const userMessage = payload.chatAttachments?.length
    ? buildUserChatMessage(userPrompt, payload.chatAttachments)
    : { role: 'user' as const, content: userPrompt }

  const result = await chatCompletions({
    messages: [
      { role: 'system', content: systemPrompt },
      userMessage,
    ],
    response_format: isJsonFormat ? { type: 'json_object' } : undefined,
    temperature: 0.8,
    signal,
  })

  const rawReply = result.choices[0]?.message?.content || ''
  if (!rawReply.trim()) throw new Error('AI 生成未返回内容')

  let updatedPayload: SourceCreatePayload = {
    ...payload,
    collectedTitle: title,
    collectedContent: content,
    collectedAuthor: author,
    collectedCoverUrl: coverUrl,
    collectedPlatform: platform,
  }

  if (isJsonFormat) {
    try {
      const parsed = JSON.parse(rawReply) as { sections?: Array<{ label: string; content: string }> }
      updatedPayload.sections = parsed.sections || [{ label: '生成结果', content: rawReply }]
    } catch {
      updatedPayload.sections = [{ label: '生成结果', content: rawReply }]
    }
  } else {
    updatedPayload.articleContent = rawReply
  }

  await repo.patchPayload(job.payloadId, updatedPayload)
  await repo.patchJob(job.id, {
    status: 'succeeded',
    subtitle: '创作完成',
    finishedAt: Date.now(),
  })
}
