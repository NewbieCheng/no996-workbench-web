import { useState } from 'react'
import { ArrowRightIcon, ArrowLeftIcon, SparklesIcon, CheckCircle2Icon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import type { AgentRunSnapshot } from '../../../../agent'
import {
  extractPartialFirstArrayString,
  extractPartialJsonField,
} from '../../../../agent/partial-json-field'
import { AgentStepRunCard } from '../../../../components/agent/AgentStepRunCard'
import { SOCIAL_WIZARD_OUTLINE_STAGES } from '../../agent/wizard-outline-stages'
import type { WizardImagePlan, WizardOutlinePlan } from '../types'

type StepOutlinePlanProps = {
  platform: 'xhs' | 'wechat'
  outline: WizardOutlinePlan
  onChange: (patch: Partial<WizardOutlinePlan>) => void
  onNext: () => void
  onBack: () => void
  planning?: boolean
  planningError?: string | null
  onRetry?: () => void
  /** 视频/纯文本素材走“只复刻文案”时允许没有图片规划。 */
  allowNoImages?: boolean
  /** 第 5 步规划大纲的真实运行快照。 */
  snapshot?: AgentRunSnapshot | null
  onCancel?: () => void
}

export function StepOutlinePlan({
  platform,
  outline,
  onChange,
  onNext,
  onBack,
  planning = false,
  planningError,
  onRetry,
  allowNoImages = false,
  snapshot,
  onCancel,
}: StepOutlinePlanProps) {
  const [selectedTitleIdx, setSelectedTitleIdx] = useState(0)
  const outlineRaw = snapshot?.stages.find((stage) => stage.id === 'plan-outline')?.streamingContent ?? ''
  const outlineTitle = extractPartialFirstArrayString(outlineRaw, 'suggestedTitles')
  const outlineHook = extractPartialJsonField(outlineRaw, 'hook')
  const outlineStreamText = [
    outlineTitle ? `候选标题：${outlineTitle}` : '',
    outlineHook ? `开篇钩子：${outlineHook}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const outlineStreamHint = outlineRaw
    ? `已接收 ${outlineRaw.length.toLocaleString('zh-CN')} 字，正在解析标题、钩子与分段…`
    : '正在等待模型返回规划内容…'

  function updateImagePlan(index: number, patch: Partial<WizardImagePlan>) {
    const imagePlans = [...outline.imagePlans]
    if (imagePlans[index]) {
      imagePlans[index] = { ...imagePlans[index], ...patch }
      onChange({ imagePlans })
    }
  }

  function updateSectionHeadline(index: number, val: string) {
    const nextSections = [...outline.sections]
    if (nextSections[index]) {
      nextSections[index] = { ...nextSections[index], headline: val }
      onChange({ sections: nextSections })
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">步骤 5/6</span>
            <span>内容大纲与视觉规划</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            确认本次创作的核心脉络
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI 提炼了爆款逻辑骨架，您可快速调整小标题与分段，随后一键启动图文重绘
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl">
            <ArrowLeftIcon className="size-3.5 mr-1" />
            <span>上一步</span>
          </Button>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={planning} className="rounded-xl gap-1.5">
              <SparklesIcon className="size-3.5" />
              <span>重新规划</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!planning && !planningError && outline.imagePlans.length > 0 ? (
        <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">整组图片的统一视觉风格</h3>
            <Textarea value={outline.visualStyle} onChange={(event) => onChange({ visualStyle: event.target.value })} rows={2} className="text-xs" aria-label="统一图片风格" />
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">逐张图片规划与上图文字</h3>
              <p className="text-xs text-muted-foreground">每张图的标题、说明和角标会由工作台排版叠加，保证文字准确清晰。</p>
            </div>
            {outline.imagePlans.map((image, index) => (
              <article
                key={image.index}
                className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 agent-reveal"
                style={{ animationDelay: `${140 + index * 70}ms` }}
              >
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-foreground">图片 {image.index} · {image.role === 'cover' ? '封面' : `正文图${image.sectionIndex ? `（第 ${image.sectionIndex} 段）` : ''}`}</div>
                  <label className="block space-y-1 text-[11px] text-muted-foreground">画面内容
                    <Textarea value={image.visualDescription} onChange={(event) => updateImagePlan(index, { visualDescription: event.target.value })} rows={3} className="text-xs text-foreground" aria-label={`图片 ${image.index} 画面内容`} />
                  </label>
                </div>
                <div className="grid gap-2">
                  <label className="space-y-1 text-[11px] text-muted-foreground">上图标题
                    <Input value={image.titleText} maxLength={32} onChange={(event) => updateImagePlan(index, { titleText: event.target.value })} className="text-xs text-foreground" aria-label={`图片 ${image.index} 上图标题`} />
                  </label>
                  <label className="space-y-1 text-[11px] text-muted-foreground">辅助文字
                    <Input value={image.supportingText} maxLength={48} onChange={(event) => updateImagePlan(index, { supportingText: event.target.value })} className="text-xs text-foreground" aria-label={`图片 ${image.index} 辅助文字`} />
                  </label>
                  <label className="space-y-1 text-[11px] text-muted-foreground">角标
                    <Input value={image.badgeText} maxLength={12} onChange={(event) => updateImagePlan(index, { badgeText: event.target.value })} className="text-xs text-foreground" aria-label={`图片 ${image.index} 角标`} />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {planning || planningError ? (
        <AgentStepRunCard
          title={platform === 'xhs' ? '规划小红书图文大纲' : '规划公众号长文大纲'}
          status={planningError ? 'failed' : 'running'}
          snapshot={snapshot}
          defs={SOCIAL_WIZARD_OUTLINE_STAGES}
          streamingText={outlineStreamText}
          streamHint={outlineStreamHint}
          emptyHint="模型正在返回标题、钩子与分段规划；完成后会显示为可编辑表单。"
          detailTitle="内容规划 · 执行过程"
          onCancel={onCancel}
          onRetry={onRetry}
        />
      ) : null}
      {planningError && !planning ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <span>{planningError}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>重试规划</Button>
        </div>
      ) : null}

      {!planning && !planningError ? <>
      {/* 推荐爆款标题候选 */}
      <div className="p-5 rounded-2xl border border-border/70 bg-card shadow-sm space-y-3 agent-reveal">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            点击选择心仪的爆款标题
          </h3>
        </div>
        <div className="space-y-2">
          {outline.suggestedTitles.map((t, idx) => {
            const isSelected = selectedTitleIdx === idx
            return (
              <div
                key={t}
                style={{ animationDelay: `${idx * 55}ms` }}
              onClick={() => {
                  setSelectedTitleIdx(0)
                  onChange({ suggestedTitles: [t, ...outline.suggestedTitles.filter((_, titleIndex) => titleIndex !== idx)] })
                }}
                className={`p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-center justify-between agent-reveal ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/30 font-semibold'
                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <span>{t}</span>
                {isSelected && <CheckCircle2Icon className="size-4 text-primary shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Hook 黄金前三秒开头 */}
      <div className="p-4 rounded-xl border border-border/60 bg-muted/30 space-y-1.5 agent-reveal" style={{ animationDelay: '70ms' }}>
        <span className="text-[11px] font-semibold text-primary uppercase">Hook 黄金吸睛导语</span>
        <Textarea value={outline.hook} onChange={(event) => onChange({ hook: event.target.value })} rows={2} className="text-xs bg-transparent border-0 focus-visible:ring-1 resize-y" aria-label="开篇钩子" />
      </div>

      {/* 分段分镜与配图规划 */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          {platform === 'xhs' ? '分镜卡片与核心段落' : '核心章节框架'}
        </h3>

        <div className="space-y-3">
          {outline.sections.map((sec, idx) => (
            <div
              key={sec.index}
              className="p-4 rounded-xl border border-border/70 bg-card shadow-sm space-y-2 agent-reveal"
              style={{ animationDelay: `${120 + idx * 70}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="size-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <Input
                  value={sec.headline}
                  onChange={(e) => updateSectionHeadline(idx, e.target.value)}
                  className="h-8 text-xs font-semibold bg-background"
                />
              </div>

              <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <label className="p-2 rounded-lg bg-muted/40 block text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">配图画面构思：</span>
                  <Textarea value={sec.visualDescription} onChange={(event) => {
                    const nextSections = [...outline.sections]
                    nextSections[idx] = { ...nextSections[idx], visualDescription: event.target.value }
                    onChange({ sections: nextSections })
                  }} rows={2} className="mt-1 min-h-12 text-[11px] bg-background" aria-label={`第 ${idx + 1} 段视觉描述`} />
                </label>
                <label className="p-2 rounded-lg bg-muted/40 block text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">核心要点草案：</span>
                  <Textarea value={sec.bodyDraft} onChange={(event) => {
                    const nextSections = [...outline.sections]
                    nextSections[idx] = { ...nextSections[idx], bodyDraft: event.target.value }
                    onChange({ sections: nextSections })
                  }} rows={2} className="mt-1 min-h-12 text-[11px] bg-background" aria-label={`第 ${idx + 1} 段内容草案`} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部行动号召 CTA */}
      <div className="p-4 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-between text-xs agent-reveal" style={{ animationDelay: '180ms' }}>
        <div className="space-y-0.5">
          <span className="text-[11px] font-semibold text-primary">行动号召 (CTA)</span>
          <Textarea value={outline.conclusion} onChange={(event) => onChange({ conclusion: event.target.value })} rows={2} className="text-xs bg-transparent border-0 focus-visible:ring-1 resize-y" aria-label="结尾行动号召" />
        </div>
      </div>
      </> : null}

      {/* 底部控制 */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <Button variant="outline" onClick={onBack} className="rounded-xl">
          上一步
        </Button>
        <Button onClick={onNext} disabled={planning || Boolean(planningError) || !outline.sections.length || (!allowNoImages && !outline.imagePlans.length)} className="rounded-xl gap-2 font-medium bg-primary text-primary-foreground shadow-sm hover:shadow">
          <SparklesIcon className="size-4" />
          <span>确认大纲并启动生成</span>
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
