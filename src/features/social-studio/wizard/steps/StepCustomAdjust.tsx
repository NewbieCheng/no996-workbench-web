import { ArrowRightIcon, ArrowLeftIcon, TypeIcon, ImageIcon, SlidersHorizontalIcon, PlusIcon, CheckIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Switch } from '@no996/ui/switch'
import { Textarea } from '@no996/ui/textarea'
import type { WizardCustomConfig, WordCountOption } from '../types'

type StepCustomAdjustProps = {
  platform: 'xhs' | 'wechat'
  config: WizardCustomConfig
  onChange: (patch: Partial<WizardCustomConfig>) => void
  onNext: () => void
  onBack: () => void
}

const PRESET_REQUIREMENTS = [
  '活人感分享，口语化表达，拒绝硬广感',
  '突出打工人通勤省时痛点，增强代入感',
  '结构清晰，条理分明，多用数字与小标题',
  '语言严谨合规，不出现任何夸大承诺或绝对化用语',
  '加入幽默调侃金句，引发读者在评论区互动吐槽',
]

export function StepCustomAdjust({
  platform,
  config,
  onChange,
  onNext,
  onBack,
}: StepCustomAdjustProps) {
  const wordCountOptions: { id: WordCountOption; label: string }[] = platform === 'xhs' ? [
    { id: '100', label: '100字' },
    { id: '300', label: '300字' },
    { id: '500', label: '500字' },
    { id: 'same_as_original', label: '和原帖字数一样' },
  ] : [
    { id: '300', label: '短讯干货(500字)' },
    { id: '500', label: '深度分析(1500字)' },
    { id: 'same_as_original', label: '和原贴篇幅一致' },
  ]

  function appendPreset(text: string) {
    const current = config.customRequirement.trim()
    if (!current) {
      onChange({ customRequirement: text })
    } else if (!current.includes(text)) {
      onChange({ customRequirement: `${current}\n${text}` })
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">步骤 4/6</span>
            <span>其他调整（可选）</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            补充个性化创作要求
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            可按需定制字数、画质与专属人设口吻，若无需调整可直接进入下一步
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl">
            <ArrowLeftIcon className="size-3.5 mr-1" />
            <span>上一步</span>
          </Button>
          <Button size="sm" onClick={onNext} className="rounded-xl gap-1.5 font-medium">
            <span>下一步：确认大纲</span>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 第一卡片：发布正文设置 */}
      <div className="p-5 rounded-2xl border border-border/70 bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <TypeIcon className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">发布正文设置</h3>
              <p className="text-[11px] text-muted-foreground">影响文案正文字数与排版符号，不影响图片内文字</p>
            </div>
          </div>

          {/* Emoji 开关 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">使用 Emoji</span>
            <Switch
              checked={config.useEmoji}
              onCheckedChange={(checked) => onChange({ useEmoji: checked })}
            />
          </div>
        </div>

        {/* 字数选项 Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs text-muted-foreground mr-2 font-medium">正文字数：</span>
          {wordCountOptions.map((opt) => {
            const isSelected = config.wordCount === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ wordCount: opt.id })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 第二卡片：图片清晰度与原创重绘策略 */}
      <div className="p-5 rounded-2xl border border-border/70 bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ImageIcon className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">视觉配图策略与清晰度</h3>
              <p className="text-[11px] text-muted-foreground">采用全新构图重绘，确保每一张配图原创排重</p>
            </div>
          </div>

          {/* 继承原图素材开关 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">允许继承原图高质量素材</span>
            <Switch
              checked={config.keepOriginalImages}
              onCheckedChange={(checked) => onChange({ keepOriginalImages: checked })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onChange({ imageResolution: 'standard' })}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              config.imageResolution === 'standard'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border/70 hover:border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">标准清晰度 (1K)</span>
              {config.imageResolution === 'standard' && <CheckIcon className="size-4 text-primary" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">出图速度快，适合日常高频稳定输出</p>
          </button>

          <button
            type="button"
            onClick={() => onChange({ imageResolution: 'high' })}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              config.imageResolution === 'high'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border/70 hover:border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">高清画质 (2K 超清)</span>
              {config.imageResolution === 'high' && <CheckIcon className="size-4 text-primary" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">发丝级微距质感与清晰大字，适合封面与重点页</p>
          </button>
        </div>
      </div>

      {/* 第三卡片：全局内容要求 */}
      <div className="p-5 rounded-2xl border border-border/70 bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <SlidersHorizontalIcon className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">全局内容定制与风格注入</h3>
            <p className="text-[11px] text-muted-foreground">输入您的独特观点、禁用词或个性化语气，全局指导 AI 生成</p>
          </div>
        </div>

        {/* 预设标签快捷插入 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">快捷灵感：</span>
          {PRESET_REQUIREMENTS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => appendPreset(preset)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40"
            >
              <PlusIcon className="size-2.5" />
              <span>{preset}</span>
            </button>
          ))}
        </div>

        {/* 输入框 */}
        <div className="space-y-1.5">
          <Textarea
            value={config.customRequirement}
            onChange={(e) => onChange({ customRequirement: e.target.value })}
            placeholder="例如：
- 语气更像是真实用户分享，要活人感一些，不要太硬广
- 忽略参考老笔记的原观点，使用我的原创观点：xxxx
- 笔记里不要出现绝对、第一等绝对化承诺的违规表达"
            className="min-h-[110px] text-xs resize-none bg-background rounded-xl leading-relaxed"
          />
          <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
            <span>输入风格、语气、禁用词等；或可在后续大纲中精细修改</span>
            <span>{config.customRequirement.length} 字</span>
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <Button variant="outline" onClick={onBack} className="rounded-xl">
          上一步
        </Button>
        <Button onClick={onNext} className="rounded-xl gap-1">
          <span>下一步：规划大纲</span>
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
