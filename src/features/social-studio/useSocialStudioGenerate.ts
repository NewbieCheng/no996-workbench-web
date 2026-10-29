import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyOperationError, notifyOperationWarning, toast } from '../../lib/toast'
import {
  createAgentClients,
  createMemorySink,
  hardCheckSummary,
  isAbortError,
  runHardCheck,
} from '../../agent'
import {
  buildSocialImagePrompts,
  generateSocialImages,
} from '../../services/social-studio/generate-social-images'
import { prepareAttachmentsFromItems } from '../../lib/chat-attachments/prepare'
import type { AttachmentUploaderItem } from '@no996/ui/attachment-uploader'
import { isWorkbenchAiDemoMode } from '../../api/workbench-ai'
import { useWorkbenchTaskActions } from '../../services/workbench-tasks'
import type { SocialComposeTaskPayload } from './agent/task-types'
import { useSocialComposeTask } from './run/useSocialComposeTask'
import { readMaterialCaptureSession } from './material-import/material-capture-session-store'
import type { SocialStudioBrief, SocialStudioPlatform } from './creative/social-studio-brief-types'
import type { SocialContentMode } from './studio-types'
import { SOCIAL_COMPOSE_FLOW_ID } from './agent/stages'
import { runSocialComposeFlow } from './agent/social-compose-flow'
import { splitLeadingArticleHeading } from './creative/article-heading'
import { pushRewriteRequirementHistory } from './rewrite/rewrite-requirement-history'
import { runSocialRewriteFlow } from './rewrite/run-social-rewrite-flow'
import { SOCIAL_REWRITE_FLOW_ID } from './rewrite/stages'
import {
  createEmptyRewriteSession,
  type SocialStudioRewriteSession,
  type SocialStudioRewriteSettings,
} from './rewrite/social-studio-rewrite-types'

export type UseSocialStudioGenerateOptions = {
  platform: SocialStudioPlatform
  contentMode: SocialContentMode
  brief: SocialStudioBrief
  personaContent?: string
  attachmentItems?: AttachmentUploaderItem[]
  onTitle: (title: string) => void
  setContent: (value: string) => void
  onSummary?: (summary: string) => void
  onGeneratedImages?: (urls: string[]) => void
  /** 长文改写：左侧正文 */
  sourceTitle?: string
  sourceBody?: string
  rewriteSettings?: SocialStudioRewriteSettings
  onRewriteSession?: (session: SocialStudioRewriteSession | null) => void
}

export function useSocialStudioGenerate(options: UseSocialStudioGenerateOptions) {
  const { t } = useTranslation('socialPublish')
  const [generating, setGenerating] = useState(false)
  const [stageLabel, setStageLabel] = useState('')
  const [rewriteProgress, setRewriteProgress] = useState(0)
  const [generationReady, setGenerationReady] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const markGenerationReady = useCallback(() => setGenerationReady(true), [])
  const clearGenerationReady = useCallback(() => setGenerationReady(false), [])
  const composeSink = useMemo(() => createMemorySink(SOCIAL_COMPOSE_FLOW_ID), [])
  const rewriteSink = useMemo(() => createMemorySink(SOCIAL_REWRITE_FLOW_ID), [])
  const { enqueueSocialCompose } = useWorkbenchTaskActions()
  const activeActionRef = useRef<'compose' | 'images_only'>('compose')
  const targetType = options.platform === 'xhs' ? 'xiaohongshu' : 'wechat-article'

  const composeTask = useSocialComposeTask({
    targetType,
    mode: 'studio',
    onText: (text) => {
      if (activeActionRef.current === 'compose') options.setContent(text)
    },
    onResult: (result) => {
      if (activeActionRef.current === 'compose') {
        options.onTitle(result.title)
        options.setContent(result.content)
        options.onSummary?.(result.summary)
      }
      if (result.imageUrls.length > 0) {
        options.onGeneratedImages?.(result.imageUrls)
      }
      setGenerationReady(true)
      setGenerating(false)
      setStageLabel('')
      if (result.warnings?.length) {
        notifyOperationWarning(result.warnings[0], { id: 'social-generate', raw: true })
      }
    },
    onError: (message) => {
      setGenerating(false)
      setStageLabel('')
      notifyOperationError(message, { id: 'social-generate' })
    },
  })

  const isRewriteMode =
    options.contentMode === 'article' && Boolean(options.sourceBody?.trim()) && options.rewriteSettings

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    void composeTask.cancel()
    setGenerating(false)
    setStageLabel('')
    setRewriteProgress(0)
  }, [composeTask])

  const generate = useCallback(async () => {
    if (isRewriteMode && options.rewriteSettings && options.onRewriteSession) {
      const body = options.sourceBody?.trim() || ''
      if (!body) {
        notifyOperationWarning(t('rewriteSourceRequired'), { id: 'social-generate', raw: true })
        return
      }
    setGenerationReady(false)
    setGenerating(true)
    setStageLabel('')
    setRewriteProgress(0)
    options.onRewriteSession(createEmptyRewriteSession())

      const ac = new AbortController()
      abortRef.current = ac
      const session = createEmptyRewriteSession()

      try {
        if (options.rewriteSettings.rewriteRequirement.trim()) {
          pushRewriteRequirementHistory(options.rewriteSettings.rewriteRequirement)
        }

        const clients = createAgentClients()

        const result = await runSocialRewriteFlow({
          platform: options.platform,
          settings: options.rewriteSettings,
          sourceTitle: options.sourceTitle || '',
          sourceBody: body,
          personaContent: options.personaContent,
          clients,
          sink: rewriteSink.sink,
          signal: ac.signal,
          onStageLabel: setStageLabel,
          onProgress: setRewriteProgress,
          onPass1Delta: (chunk) => {
            session.pass1Body += chunk
            options.onRewriteSession?.({ ...session })
          },
        })

        session.pass1Body = result.pass1Body
        session.pass2Payload = result.pass2
        session.secondPassSkipped = result.secondPassSkipped
        options.onRewriteSession?.({ ...session })

        const finalBody = result.pass2?.body || result.pass1Body
        if (options.brief.hardCheck && finalBody) {
          const check = runHardCheck({ text: finalBody, mode: 'video' })
          if (!check.pass) toast.message(hardCheckSummary(check))
        }
        setGenerationReady(true)
      } catch (e) {
        if (isAbortError(e)) return
        notifyOperationError(e instanceof Error ? e.message : String(e), { id: 'social-generate' })
      } finally {
        setGenerating(false)
        setStageLabel('')
        setRewriteProgress(0)
        abortRef.current = null
      }
      return
    }

    const topic = options.brief.topic.trim()
    if (!topic) {
      notifyOperationWarning(t('briefTopicRequired'), { id: 'social-generate', raw: true })
      return
    }

    // 正式模式：统一入队。演示模式继续走下面的页内流程（演示不入队，也不伪造云端结果）。
    if (!isWorkbenchAiDemoMode()) {
      setGenerationReady(false)
      setGenerating(true)
      setStageLabel('正在提交图文生产任务…')
      activeActionRef.current = 'compose'
      options.onRewriteSession?.(null)
      options.setContent('')
      options.onTitle(topic.split('\n')[0]?.slice(0, 200) || topic.slice(0, 200))

      try {
        const chatAttachments = options.attachmentItems?.length
          ? await prepareAttachmentsFromItems(options.attachmentItems, {
              onNotice: (message) => notifyOperationWarning(message, { raw: true }),
            })
          : undefined
        const payload: SocialComposeTaskPayload = {
          action: 'compose',
          mode: 'studio',
          platform: options.platform,
          contentMode: options.contentMode,
          targetType,
          brief: options.brief,
          personaContent: options.personaContent,
          chatAttachments,
        }
        const taskId = await enqueueSocialCompose({
          payload,
          route: options.platform === 'xhs' ? '/workbench/xiaohongshu' : '/workbench/wechat-article',
          title: topic.split('\n')[0]?.slice(0, 60) || '图文创作',
          subtitle: `${options.platform === 'xhs' ? '小红书' : '公众号'} · 灵感创作`,
        })
        composeTask.bindTask(taskId)
      } catch (error) {
        setGenerating(false)
        setStageLabel('')
        notifyOperationError(error instanceof Error ? error.message : String(error), {
          id: 'social-generate',
        })
      }
      return
    }

    setGenerationReady(false)
    setGenerating(true)
    setStageLabel('')
    options.onRewriteSession?.(null)
    options.setContent('')
    options.onTitle(topic.split('\n')[0]?.slice(0, 200) || topic.slice(0, 200))
    if (options.onSummary && options.brief.summary.trim()) {
      options.onSummary(options.brief.summary.trim())
    }

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const session = readMaterialCaptureSession()
      const sessionItem = session?.items?.[0] ?? null

      const chatAttachments = options.attachmentItems?.length
        ? await prepareAttachmentsFromItems(options.attachmentItems, {
            onNotice: (message) => notifyOperationWarning(message, { raw: true }),
          })
        : undefined

      const clients = createAgentClients()

      let streamed = ''
      const result = await runSocialComposeFlow({
        platform: options.platform,
        brief: options.brief,
        contentMode: options.contentMode,
        personaContent: options.personaContent,
        chatAttachments,
        sessionItem,
        clients,
        sink: composeSink.sink,
        signal: ac.signal,
        onDelta: (chunk) => {
          streamed += chunk
          options.setContent(streamed)
        },
        onStageLabel: setStageLabel,
      })

      if (!result.body.trim()) {
        throw new Error(t('briefGenerateEmpty'))
      }

      let generatedBody = result.body.trim()
      if (options.contentMode === 'article') {
        const separated = splitLeadingArticleHeading(generatedBody)
        if (separated.title) {
          options.onTitle(separated.title)
          generatedBody = separated.body
          options.setContent(generatedBody)
        }
      }

      if (options.brief.hardCheck) {
        const check = runHardCheck({ text: generatedBody, mode: 'video' })
        if (!check.pass) {
          toast.message(hardCheckSummary(check))
        }
      }

      // 若为图文模式且需要配图，尝试调用真实生图 API 生成配图
      if (options.onGeneratedImages && options.brief.imageCount > 0) {
        if (clients.isMock) {
          toast.message('演示模式不会调用云端生图服务；配图可通过本地素材预览。')
        } else {
          setStageLabel('正文撰写完成，正在按主题生成原创配图…')
          const targetCount = Math.min(options.brief.imageCount, 4)
          const imageSize = options.platform === 'xhs' ? '1024x1365' : '1024x1024'
          const prompts = (result.imagePrompts ?? []).filter((p) => p.trim()).slice(0, targetCount)
          const failureMessages: string[] = []
          const imageUrls = await generateSocialImages({
            prompts: prompts.length > 0 ? prompts : [options.brief.topic || '原创配图'],
            size: imageSize,
            nPerPrompt: 1,
            signal: ac.signal,
            onFailure: (error) => {
              const message = error instanceof Error ? error.message : String(error)
              failureMessages.push(message)
              console.warn('[useSocialStudioGenerate] 文生图接口调用失败:', error)
            },
          })
          if (imageUrls.length > 0) {
            options.onGeneratedImages(imageUrls)
            toast.success(`已成功生成 ${imageUrls.length} 张原创配图`)
          } else {
            const detail = failureMessages[0]?.trim()
            toast.message(
              detail
                ? `正文已生成，但配图失败：${detail}`
                : '正文已生成，但配图服务未返回图片；可稍后重试或上传本地图片。',
            )
          }
        }
      } else if (options.contentMode === 'image_text' && options.brief.imageCount > 0) {
        toast.message(t('briefImagesPending'))
      }

      setGenerationReady(true)
    } catch (e) {
      if (isAbortError(e)) return
      notifyOperationError(e instanceof Error ? e.message : String(e), { id: 'social-generate' })
    } finally {
      setGenerating(false)
      setStageLabel('')
      abortRef.current = null
    }
  }, [composeSink, composeTask, enqueueSocialCompose, isRewriteMode, options, rewriteSink, t, targetType])

  /** 仅生成配图，不重写正文（已有文章时用）。 */
  const generateImagesOnly = useCallback(async () => {
    if (!options.onGeneratedImages) {
      notifyOperationWarning('当前模式不支持单独生成配图。', { id: 'social-generate', raw: true })
      return
    }
    if (!isWorkbenchAiDemoMode()) {
      setGenerating(true)
      setStageLabel('正在提交配图生成任务…')
      activeActionRef.current = 'images_only'
      try {
        const payload: SocialComposeTaskPayload = {
          action: 'images_only',
          mode: 'studio',
          platform: options.platform,
          contentMode: options.contentMode,
          targetType,
          brief: options.brief,
          personaContent: options.personaContent,
          existingTitle: options.sourceTitle,
          existingContent: options.sourceBody,
        }
        const taskId = await enqueueSocialCompose({
          payload,
          route: options.platform === 'xhs' ? '/workbench/xiaohongshu' : '/workbench/wechat-article',
          title: (options.sourceTitle || options.brief.topic || '图文创作').slice(0, 60),
          subtitle: `${options.platform === 'xhs' ? '小红书' : '公众号'} · 只生成配图`,
        })
        composeTask.bindTask(taskId)
      } catch (error) {
        setGenerating(false)
        setStageLabel('')
        notifyOperationError(error instanceof Error ? error.message : String(error), {
          id: 'social-generate',
        })
      }
      return
    }
    const targetCount = Math.min(Math.max(1, options.brief.imageCount || 1), 4)
    setGenerating(true)
    setStageLabel('正在按主题生成原创配图…')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const clients = createAgentClients()
      if (clients.isMock) {
        toast.message('演示模式不会调用云端生图服务；配图可通过本地素材预览。')
        return
      }
      const imageSize = options.platform === 'xhs' ? '1024x1365' : '1024x1024'
      const prompts = buildSocialImagePrompts({
        title: options.brief.topic.trim() || '原创配图',
        style: `${options.brief.expressionStyle}, ${options.brief.voiceTone}`,
        count: targetCount,
      }).slice(0, targetCount)
      const failureMessages: string[] = []
      const imageUrls = await generateSocialImages({
        prompts: prompts.length > 0 ? prompts : [options.brief.topic || '原创配图'],
        size: imageSize,
        nPerPrompt: 1,
        signal: ac.signal,
        onFailure: (error) => {
          failureMessages.push(error instanceof Error ? error.message : String(error))
        },
      })
      if (imageUrls.length > 0) {
        options.onGeneratedImages(imageUrls)
        toast.success(`已成功生成 ${imageUrls.length} 张原创配图`)
      } else {
        notifyOperationError(
          failureMessages[0]?.trim() || '配图服务未返回图片；请稍后重试或上传本地图片。',
          { id: 'social-generate' },
        )
      }
    } catch (e) {
      if (isAbortError(e)) return
      notifyOperationError(e instanceof Error ? e.message : String(e), { id: 'social-generate' })
    } finally {
      setGenerating(false)
      setStageLabel('')
      abortRef.current = null
    }
  }, [composeTask, enqueueSocialCompose, options, t, targetType])

  return {
    generating,
    stageLabel,
    rewriteProgress,
    isRewriteMode,
    generate,
    generateImagesOnly,
    cancel,
    generationReady,
    markGenerationReady,
    clearGenerationReady,
    composeTask,
  }
}
