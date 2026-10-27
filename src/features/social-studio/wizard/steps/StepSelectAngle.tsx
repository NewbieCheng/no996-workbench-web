import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, ArrowRightIcon, ArrowLeftIcon, Lightbulb, Compass, Zap, RefreshCw } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { createAgentClients, isAbortError } from '../../../../agent'
import { notifyOperationError } from '../../../../lib/toast'
import { createDefaultBrief, type SocialStudioBrief } from '../../creative/social-studio-brief-types'
import { runSocialTopicAnglesFlow, createSocialTopicAnglesDemoResponder } from '../../agent/run-social-topic-angles-flow'
import type { IdeationTopicForm, TopicAngleOption } from '../types'

type StepSelectAngleProps = {
  platform: 'xhs' | 'wechat'
  topicForm: IdeationTopicForm
  selectedAngle: TopicAngleOption | null
  onSelect: (angle: TopicAngleOption) => void
  onNext: () => void
  onBack: () => void
}

const STYLE_MAP: Record<IdeationTopicForm['expressionStyle'], SocialStudioBrief['expressionStyle']> = {
  seeding: 'seeding', planting: 'seeding', dry_goods: 'dry_goods', story: 'story', review: 'review',
}

export function StepSelectAngle({ platform, topicForm, selectedAngle, onSelect, onNext, onBack }: StepSelectAngleProps) {
  const [angles, setAngles] = useState<TopicAngleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const brief = useMemo(() => ({
    ...createDefaultBrief(platform), topic: topicForm.topic, audience: topicForm.audience || '',
    expressionStyle: STYLE_MAP[topicForm.expressionStyle],
  }), [platform, topicForm])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void runSocialTopicAnglesFlow({ platform, brief, clients: createAgentClients({ mockResponder: createSocialTopicAnglesDemoResponder({ platform, brief }) }), signal: controller.signal })
      .then((result) => {
        const mapped = result.map((angle) => ({ id: angle.id, title: angle.title, angleConcept: angle.desc, targetPainPoint: angle.desc, recommendedHook: angle.hook }))
        setAngles(mapped)
        if (!selectedAngle || !mapped.some((angle) => angle.id === selectedAngle.id)) onSelect(mapped[0])
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return
        const message = cause instanceof Error ? cause.message : '切入点策划失败，请检查网络后重试。'
        setError(message)
        notifyOperationError(message, { id: 'social-wizard-angle-plan' })
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [brief, platform, retry])

  const activeAngle = selectedAngle || angles[0]

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary">步骤 2/6</span><span>AI 爆款切入点策划</span></div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">针对主题「{topicForm.topic}」，AI 策划了 3 个爆款角度</h2>
          <p className="text-xs text-muted-foreground mt-0.5">点击挑选最适合您的受众切入点，AI 将基于该角度生成结构化图文</p>
        </div>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={onBack} className="rounded-xl"><ArrowLeftIcon className="size-3.5 mr-1" />修改主题</Button><Button size="sm" onClick={onNext} disabled={loading || !angles.length} className="rounded-xl gap-1.5 font-medium">下一步：选择版式模板<ArrowRightIcon className="size-3.5" /></Button></div>
      </div>

      {loading ? <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card p-10 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" />AI 正在策划切入点…</div> : null}
      {error && !loading ? <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><span>{error}</span><Button variant="outline" size="sm" onClick={() => setRetry((n) => n + 1)}>重试</Button></div> : null}

      {!loading && angles.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{angles.map((ang, idx) => {
        const isSelected = activeAngle?.id === ang.id
        const icon = idx === 0 ? <Zap className="size-5" /> : idx === 1 ? <Compass className="size-5" /> : <Lightbulb className="size-5" />
        return <button key={ang.id} type="button" onClick={() => onSelect(ang)} aria-pressed={isSelected} className={`group relative flex flex-col justify-between p-5 rounded-2xl border text-left transition-all duration-200 ${isSelected ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-md' : 'border-border/70 hover:border-border bg-card/70 hover:bg-card'}`}>
          <div className="space-y-3"><div className="flex items-center justify-between"><div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{icon}</div>{isSelected ? <span className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><CheckIcon className="size-3.5 stroke-[3]" /></span> : null}</div><h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2">{ang.title}</h3><div className="inline-block px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-medium">{ang.angleConcept}</div><div className="p-2.5 rounded-xl bg-muted/40 text-[11px] text-muted-foreground space-y-1"><span className="font-semibold text-foreground block">策划说明：</span><p className="line-clamp-2">{ang.targetPainPoint}</p></div></div>
          <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground"><span className="text-primary font-medium block mb-0.5">推荐导语预览：</span><p className="line-clamp-2 italic">{ang.recommendedHook}</p></div>
        </button>
      })}</div> : null}
      <div className="flex items-center justify-between pt-4 border-t border-border/50"><span className="text-xs text-muted-foreground">已选切入点：<strong className="text-foreground">{activeAngle?.title || '尚未生成'}</strong></span><Button onClick={onNext} disabled={loading || !angles.length} className="rounded-xl gap-1"><span>下一步：选择版式模板</span><ArrowRightIcon className="size-4" /></Button></div>
    </div>
  )
}
