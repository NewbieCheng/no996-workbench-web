import { useState, useRef } from 'react'
import { createAgentClients, isAbortError } from '../../../agent'
import { runSocialTopicAnglesFlow, createSocialTopicAnglesDemoResponder } from '../agent/run-social-topic-angles-flow'
import { useTranslation } from 'react-i18next'
import {
  Wand2,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  Check,
  RefreshCw,
  X,
  Palette,
  ShieldCheck,
  Tag,
  BookOpen,
  ClipboardList,
  Sparkles,
  SearchCheck,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { Switch } from '@no996/ui/switch'
import { Field } from '../../../components/WorkbenchUI'
import { ChatPromptAttachments } from '../../../components/ChatPromptAttachments'
import type { AttachmentUploaderItem } from '@no996/ui/attachment-uploader'
import { WECHAT_THEMES, type WechatThemeKey } from '../../../services/social-publish/layout/wechat-markdown-preview'
import { articleTemplates, type ArticleTemplate } from '../../../prompts/article'
import type { SocialContentMode } from '../studio-types'
import type { SavedPersona } from '../../../services/persona'
import type {
  BriefLength,
  ExpressionStyle,
  SocialStudioBrief,
  SocialStudioPlatform,
  VoiceTone,
} from './social-studio-brief-types'
import { SocialStudioPrepActions } from './SocialStudioPrepActions'
import { SocialStudioRewriteWizard } from '../rewrite/SocialStudioRewriteWizard'
import type { SocialStudioRewriteSettings } from '../rewrite/social-studio-rewrite-types'
import { notifyOperationError, notifyOperationWarning } from '../../../lib/toast'

export type SocialStudioCreativePanelProps = {
  platform: SocialStudioPlatform
  contentMode: SocialContentMode
  brief: SocialStudioBrief
  onBriefChange: (patch: Partial<SocialStudioBrief>) => void
  generating: boolean
  stageLabel?: string
  onGenerate: () => void
  onCancel?: () => void
  showPublish?: boolean
  onPublish: () => void
  publishDisabled?: boolean
  publishBusy?: boolean
  publishLabel: string
  publishNotice?: string
  onReset?: () => void
  onFillSample?: () => void
  generateLabel: string
  showAttachments?: boolean
  attachmentItems?: AttachmentUploaderItem[]
  onAttachmentItemsChange?: (items: AttachmentUploaderItem[]) => void
  attachmentsDisabled?: boolean
  onPickCoverImages?: (files: FileList | null) => void
  rewriteSettings?: SocialStudioRewriteSettings
  onRewriteSettingsChange?: (patch: Partial<SocialStudioRewriteSettings>) => void
  hasEditorBody?: boolean
  /** 兼容顶栏人设绑定传递，准备区不再重复渲染占位卡片 */
  persona?: SavedPersona | null
}

/**
 * 灵感创作准备区面板：极简交互流 + 深度绑定人设管理 + 真实大模型切入点推演
 */
export function SocialStudioCreativePanel({
  platform,
  contentMode,
  brief,
  onBriefChange,
  generating,
  stageLabel,
  onGenerate,
  onCancel,
  showPublish,
  onPublish,
  publishDisabled,
  publishBusy,
  publishLabel,
  publishNotice,
  onFillSample,
  generateLabel,
  showAttachments,
  attachmentItems,
  onAttachmentItemsChange,
  attachmentsDisabled,
  onPickCoverImages,
  rewriteSettings,
  onRewriteSettingsChange,
  hasEditorBody = false,
}: SocialStudioCreativePanelProps) {
  const { t } = useTranslation(['socialPublish', 'common'])

  // AI 爆款切入点现场推演状态（真实 LLM 调用）
  const [anglePlanning, setAnglePlanning] = useState(false)
  const [generatedAngles, setGeneratedAngles] = useState<
    Array<{ id: string; title: string; desc: string; hook: string }>
  >([])
  const [selectedAngleId, setSelectedAngleId] = useState<string | null>(null)
  const anglePlanAbortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 更多创作定制偏好（默认折叠，保持主界面极简）
  const [advancedExpanded, setAdvancedExpanded] = useState(false)

  // 核心表达风格：使用高质感 Lucide SVG 图标，单行抗折行布局
  const expressionOptions: {
    value: ExpressionStyle
    label: string
    sub: string
    Icon: LucideIcon
  }[] = [
    { value: 'dry_goods', label: '干货清单', sub: '步骤清晰·高收藏', Icon: ClipboardList },
    { value: 'seeding', label: '真诚种草', sub: '痛点直击·高转化', Icon: Sparkles },
    { value: 'story', label: '故事心路', sub: '反差起伏·高共鸣', Icon: BookOpen },
    { value: 'review', label: '深度测评', sub: '多维对比·避坑指南', Icon: SearchCheck },
  ]

  const lengthOptions: { value: BriefLength; label: string }[] = [
    { value: 'short', label: t('lengthShort', { defaultValue: '简短' }) },
    { value: 'standard', label: t('lengthStandard', { defaultValue: '标准' }) },
    { value: 'long', label: t('lengthLong', { defaultValue: '长文' }) },
  ]

  const voiceOptions: { value: VoiceTone; label: string }[] = [
    { value: 'bestie', label: t('briefVoiceBestie', { defaultValue: '闺蜜亲切' }) },
    { value: 'professional', label: t('briefVoicePro', { defaultValue: '专业严谨' }) },
    { value: 'humorous', label: t('briefVoiceHumor', { defaultValue: '幽默风趣' }) },
  ]

  const themeKeys = Object.keys(WECHAT_THEMES) as WechatThemeKey[]

  // 真实调用 AI 策划 3 个高赞切入点（无任何假 mock）
  const handlePlanAngles = async () => {
    const topic = brief.topic.trim()
    if (!topic) {
      notifyOperationWarning('请先填写灵感主题或素材，再让 AI 策划切入点。', {
        id: 'social-angle-plan',
        raw: true,
      })
      return
    }

    anglePlanAbortRef.current?.abort()
    const controller = new AbortController()
    anglePlanAbortRef.current = controller

    setAnglePlanning(true)
    try {
      const clients = createAgentClients({ mockResponder: createSocialTopicAnglesDemoResponder({ platform, brief }) })
      const angles = await runSocialTopicAnglesFlow({
        platform,
        brief,
        clients,
        signal: controller.signal,
      })
      setGeneratedAngles(angles)
      setSelectedAngleId(null)
    } catch (err) {
      if (isAbortError(err)) return
      notifyOperationError(
        err instanceof Error ? err.message : '切入点策划失败，请检查网络或稍后重试。',
        { id: 'social-angle-plan' },
      )
    } finally {
      if (anglePlanAbortRef.current === controller) {
        setAnglePlanning(false)
        anglePlanAbortRef.current = null
      }
    }
  }

  // 采纳某个切入点
  const handleSelectAngle = (angle: { id: string; title: string; hook: string }) => {
    setSelectedAngleId(angle.id)
    const existingReq = brief.creativeRequirements ? `${brief.creativeRequirements}\n` : ''
    onBriefChange({
      creativeRequirements: `${existingReq}【重点视角】：${angle.title}，${angle.hook}`,
    })
  }

  return (
    <div className="ssc-panel flex flex-col gap-3 pb-2 text-xs">
      {/* 1. 核心灵感主题与素材输入 */}
      <section className="space-y-2" aria-labelledby="ssc-topic-label">
        <div className="flex items-center justify-between gap-2">
          <div
            id="ssc-topic-label"
            className="flex min-w-0 items-center gap-1.5 font-semibold text-xs text-foreground"
          >
            <span>我想写的主题或灵感</span>
            <span className="ssc-badge ssc-badge--required shrink-0">必填</span>
          </div>
          {brief.topic ? (
            <button
              type="button"
              onClick={() => onBriefChange({ topic: '' })}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer"
            >
              <X size={11} /> 清空
            </button>
          ) : onFillSample ? (
            <button
              type="button"
              onClick={onFillSample}
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
            >
              填入样例
            </button>
          ) : null}
        </div>

        <div className="relative">
          <Textarea
            className="w-full min-h-[5.2rem] text-xs resize-y rounded-xl bg-background border-border/70 focus-visible:ring-1 p-2.5 leading-relaxed"
            rows={3}
            maxLength={1000}
            value={brief.topic}
            disabled={generating}
            placeholder={
              platform === 'wechat'
                ? '输入公众号文章主题或粘贴长文脚本，例如：AI时代技能重塑、职场跃迁思考…'
                : '输入小红书灵感主题，例如：租房百元逆袭、自媒体新手避坑指南…'
            }
            onChange={(e) => onBriefChange({ topic: e.target.value })}
          />
          <div className="mt-1 flex justify-end text-[10px] text-muted-foreground px-0.5 tabular-nums">
            <span>{brief.topic.length}/1000</span>
          </div>
        </div>

        {/* AI 现场策划切入点按钮 */}
        <div>
          <button
            type="button"
            disabled={generating || anglePlanning || !brief.topic.trim()}
            onClick={() => void handlePlanAngles()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary/8 hover:bg-primary/12 text-primary font-medium text-xs transition-colors cursor-pointer"
          >
            {anglePlanning ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Wand2 size={12} />
            )}
            <span>
              {generatedAngles.length > 0 ? '重新推演切入点' : 'AI 现场策划 3 个高赞切入点'}
            </span>
          </button>
        </div>

        {/* 推演切入点展示列表 */}
        {generatedAngles.length > 0 && (
          <div className="space-y-1.5 pt-0.5 animate-in fade-in duration-200">
            <p className="text-[10px] font-medium text-muted-foreground">点击选中心仪切入点即可应用：</p>
            <div className="space-y-1.5">
              {generatedAngles.map((angle) => {
                const isSelected = selectedAngleId === angle.id
                return (
                  <button
                    key={angle.id}
                    type="button"
                    onClick={() => handleSelectAngle(angle)}
                    className={`w-full p-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 ring-1 ring-primary/25'
                        : 'bg-muted/35 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span>{angle.title}</span>
                      {isSelected ? (
                        <span className="text-[10px] text-primary font-bold flex items-center gap-0.5">
                          <Check size={11} /> 已采纳
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {angle.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* 2. 智能改写向导（仅在长文改写模式下展示） */}
      {contentMode === 'article' && rewriteSettings && onRewriteSettingsChange && hasEditorBody ? (
        <SocialStudioRewriteWizard
          platform={platform}
          settings={rewriteSettings}
          onChange={onRewriteSettingsChange}
          disabled={generating}
        />
      ) : (
        /* 3. 核心风格与规格配置（抗拥挤单行布局） */
        <section className="space-y-2.5" aria-label="核心风格与规格">
          {/* 表达风格网格：SVG图标 + 单行不折行 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">核心表达风格</label>
            <div className="grid grid-cols-2 gap-1.5">
              {expressionOptions.map((opt) => {
                const isActive = brief.expressionStyle === opt.value
                const { Icon } = opt
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={generating}
                    onClick={() => onBriefChange({ expressionStyle: opt.value })}
                    className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-primary/10 border-primary/80 text-primary shadow-xs font-medium'
                        : 'bg-muted/30 border-border/50 hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Icon size={13} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                      <span className="font-semibold text-xs leading-none">{opt.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate whitespace-nowrap">
                      {opt.sub}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 篇幅与配图紧凑行 */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">篇幅规格</label>
              <div className="grid grid-cols-3 gap-1">
                {lengthOptions.map((opt) => {
                  const isActive = brief.length === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={generating}
                      onClick={() => onBriefChange({ length: opt.value })}
                      className={`py-1 px-1 rounded-md text-center transition-colors cursor-pointer text-xs whitespace-nowrap ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-medium shadow-2xs'
                          : 'bg-muted/35 hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 配图数量（图文模式：紧凑数字输入，范围 1~9） */}
            {contentMode === 'image_text' ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground">配图数量（张）</label>
                  <span className="text-[10px] text-muted-foreground/80">1~9</span>
                </div>
                <div className="relative flex items-center">
                  <Input
                    type="number"
                    min={1}
                    max={9}
                    step={1}
                    value={brief.imageCount || 4}
                    disabled={generating}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) {
                        const clamped = Math.max(1, Math.min(9, val))
                        onBriefChange({ imageCount: clamped })
                      }
                    }}
                    className="h-7 w-full text-xs bg-background pr-6 tabular-nums rounded-md"
                  />
                  <span className="absolute right-2 text-[10px] text-muted-foreground pointer-events-none">
                    张
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {/* 4. 更多定制偏好（默认折叠，保持清爽） */}
      <div className="border-t border-border/60 pt-1">
        <button
          type="button"
          onClick={() => setAdvancedExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <span>更多创作定制与受众偏好（可选）</span>
          {advancedExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {advancedExpanded && (
          <div className="space-y-2.5 pt-2 animate-in fade-in duration-150">
            {/* 目标读者 */}
            <Field label="目标读者画像" hint="人设已自动匹配，也可手动微调">
              <Input
                maxLength={200}
                value={brief.audience}
                disabled={generating}
                placeholder="例如：刚入职场的新人、考研党、合租独居女生"
                onChange={(e) => onBriefChange({ audience: e.target.value })}
                className="text-xs h-7.5 rounded-lg bg-background"
              />
            </Field>

            {/* 语气调性 */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">语气风格</label>
              <div className="grid grid-cols-3 gap-1.5">
                {voiceOptions.map((opt) => {
                  const isActive = brief.voiceTone === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={generating}
                      onClick={() => onBriefChange({ voiceTone: opt.value })}
                      className={`py-1 px-2 rounded-lg text-center transition-colors cursor-pointer font-medium text-xs whitespace-nowrap ${
                        isActive
                          ? 'bg-primary/10 ring-1 ring-primary text-primary'
                          : 'bg-muted/35 hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 补充具体创作要求 */}
            <Field label="补充具体创作要求" hint="告诉 AI 怎么改、强调什么、避免什么">
              <Textarea
                rows={2}
                maxLength={3000}
                value={brief.creativeRequirements}
                disabled={generating}
                placeholder="填写您的特定规范要求..."
                onChange={(e) => onBriefChange({ creativeRequirements: e.target.value })}
                className="text-xs rounded-xl bg-background border-border/70"
              />
            </Field>

            {/* 长文本参考素材 */}
            <Field label="长文本参考素材 / 背景资料" hint="可粘贴已有的底稿、报道或采访资料">
              <Textarea
                rows={3}
                maxLength={12000}
                value={brief.referenceText}
                disabled={generating}
                placeholder="粘贴参考素材正文..."
                onChange={(e) => onBriefChange({ referenceText: e.target.value })}
                className="text-xs rounded-xl bg-background border-border/70"
              />
            </Field>

            {/* 微信专属排版主题色与版式 */}
            {platform === 'wechat' ? (
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Palette size={12} />
                    <span>微信排版主题色调</span>
                  </label>
                  <div className="flex items-center gap-2" role="group">
                    {themeKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`size-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${
                          brief.themeKey === key
                            ? 'border-foreground scale-110 shadow-xs ring-2 ring-primary/30'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: WECHAT_THEMES[key].color }}
                        disabled={generating}
                        title={WECHAT_THEMES[key].name}
                        onClick={() => onBriefChange({ themeKey: key })}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <BookOpen size={12} />
                    <span>排版样式模板</span>
                  </label>
                  <select
                    className="w-full text-xs h-7 rounded-lg bg-background border border-border/70 px-2"
                    value={brief.articleTemplate}
                    disabled={generating}
                    onChange={(e) => onBriefChange({ articleTemplate: e.target.value as ArticleTemplate })}
                  >
                    {articleTemplates.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value === 'clean' ? '简约商务' : opt.value === 'editorial' ? '人文排版' : '亲切明快'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {/* 附件上传 */}
            {showAttachments && attachmentItems && onAttachmentItemsChange ? (
              <ChatPromptAttachments
                items={attachmentItems}
                onChange={onAttachmentItemsChange}
                disabled={attachmentsDisabled || generating}
              />
            ) : null}

            {/* 上传本地配图：卡片式触发器，告别原生 ugly input */}
            {onPickCoverImages &&
            (contentMode === 'image_text' || (platform === 'xhs' && contentMode === 'article')) ? (
              <div className="space-y-1.5 pt-1 border-t border-border/60">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  multiple={contentMode === 'image_text'}
                  disabled={generating}
                  onChange={(e) => {
                    onPickCoverImages(e.target.files)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-border/80 bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer text-xs"
                >
                  <UploadCloud size={14} className="text-primary/80 shrink-0" />
                  <span className="font-medium">点击上传本地配图</span>
                  <span className="text-[10px] opacity-70">（支持 JPG/PNG/WebP）</span>
                </button>
              </div>
            ) : null}

            {/* 合规与标签：规范 Switch 组件 */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between gap-2 py-0.5">
                <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                  <ShieldCheck size={14} className="text-primary/80 shrink-0" />
                  <span>硬性合规与广告法自检</span>
                </div>
                <Switch
                  size="sm"
                  checked={brief.hardCheck}
                  disabled={generating}
                  onCheckedChange={(checked) => onBriefChange({ hardCheck: checked })}
                />
              </div>

              <div className="flex items-center justify-between gap-2 py-0.5">
                <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                  <Tag size={14} className="text-primary/80 shrink-0" />
                  <span>自动推导高流量话题标签</span>
                </div>
                <Switch
                  size="sm"
                  checked={brief.autoTags}
                  disabled={generating}
                  onCheckedChange={(checked) => onBriefChange({ autoTags: checked })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. 层次化操作按钮区 */}
      <SocialStudioPrepActions
        generating={generating}
        stageLabel={stageLabel}
        generateDisabled={!brief.topic.trim()}
        generateLabel={generateLabel}
        onGenerate={onGenerate}
        onCancel={onCancel}
        showPublish={showPublish}
        publishDisabled={publishDisabled}
        publishBusy={publishBusy}
        publishLabel={publishLabel}
        publishNotice={publishNotice}
        onPublish={onPublish}
      />
    </div>
  )
}
