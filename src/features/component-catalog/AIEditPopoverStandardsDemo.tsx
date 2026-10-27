import { useState } from 'react'
import { AIEditPopover, type AIEditPopoverLabels } from '@no996/ui/ai-edit-popover'
import { Textarea } from '@no996/ui/textarea'

const LABELS: AIEditPopoverLabels = {
  trigger: 'AI 优化',
  context: '当前内容',
  promptPlaceholder: '描述你希望怎么调整…（Enter 发送，Shift+Enter 换行）',
  apply: '采用',
  dismiss: '取消',
  loading: '正在生成演示建议…',
  send: '生成建议',
  focusHint: '只优化当前字段；可直接描述要求或选一个快捷方向。',
  result: '演示建议',
}

const QUICK_PROMPTS = [
  { label: '更精简', instruction: '更精简' },
  { label: '更具体', instruction: '更具体' },
  { label: '更亲切', instruction: '更亲切' },
]

export function AIEditPopoverStandardsDemo() {
  const [value, setValue] = useState('为小团队提供选题梳理与内容流程咨询')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  function generate(instruction: string) {
    setBusy(true)
    setResult('')
    window.setTimeout(() => {
      setResult(`（演示建议${instruction ? ` · ${instruction}` : ''}）帮小团队理清选题、跑顺内容流程，让内容生产更清晰高效。`)
      setBusy(false)
    }, 450)
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="ai-edit-popover-demo-input" className="text-sm font-medium">你主要做什么？</label>
        <AIEditPopover
          fieldLabel="主要业务"
          value={value}
          result={result}
          busy={busy}
          quickPrompts={QUICK_PROMPTS}
          labels={LABELS}
          onGenerate={generate}
          onApply={() => {
            if (result) setValue(result)
            setResult('')
          }}
          onDismiss={() => setResult('')}
        />
      </div>
      <Textarea id="ai-edit-popover-demo-input" rows={3} value={value} onChange={(event) => setValue(event.target.value)} />
      <p className="ai-edit-popover-demo__note">组件库交互演示；生成结果为本机样例，不调用真实模型。</p>
    </div>
  )
}
