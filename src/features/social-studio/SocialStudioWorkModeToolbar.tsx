import { SparklesIcon, Wand2Icon } from 'lucide-react'

export type SocialStudioWorkMode = 'wizard' | 'advanced'

type SocialStudioWorkModeToolbarProps = {
  workMode: SocialStudioWorkMode
  onWorkModeChange: (mode: SocialStudioWorkMode) => void
}

export function SocialStudioWorkModeToolbar({
  workMode,
  onWorkModeChange,
}: SocialStudioWorkModeToolbarProps) {
  return (
    <div className="inline-flex p-0.5 rounded-full bg-muted/60 border border-border/50 text-xs mr-1">
      <button
        type="button"
        onClick={() => onWorkModeChange('wizard')}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
          workMode === 'wizard'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Wand2Icon className="size-3" aria-hidden />
        <span>爆款复刻</span>
      </button>
      <button
        type="button"
        onClick={() => onWorkModeChange('advanced')}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
          workMode === 'advanced'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <SparklesIcon className="size-3" aria-hidden />
        <span>灵感创作</span>
      </button>
    </div>
  )
}
