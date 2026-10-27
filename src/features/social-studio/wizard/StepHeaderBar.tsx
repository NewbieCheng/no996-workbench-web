import { FloatingWizardDock, type FloatingWizardDockStep } from '@no996/ui'
import type { WizardStep, CreationOrigin } from './types'

export interface StepDef {
  key: WizardStep
  title: string
  stepNum: number
}

function getWizardSteps(origin: CreationOrigin = 'benchmark_clone'): StepDef[] {
  return [
    { key: 'search', title: '创作起点', stepNum: 1 },
    { key: 'benchmark', title: origin === 'topic_ideation' ? '策划切入点' : '选择爆款', stepNum: 2 },
    { key: 'template', title: '选择模板', stepNum: 3 },
    { key: 'custom', title: '其他调整', stepNum: 4 },
    { key: 'outline', title: '内容规划', stepNum: 5 },
    { key: 'generating', title: 'AI生成', stepNum: 6 },
  ]
}

type StepHeaderBarProps = {
  currentStep: WizardStep
  origin?: CreationOrigin
  onStepClick?: (step: WizardStep) => void
  canNavigateTo?: (step: WizardStep) => boolean
}

export function StepHeaderBar({
  currentStep,
  origin = 'benchmark_clone',
  onStepClick,
  canNavigateTo,
}: StepHeaderBarProps) {
  const steps = getWizardSteps(origin)
  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  const dockSteps: FloatingWizardDockStep[] = steps.map((s, idx) => ({
    id: s.key,
    label: s.title,
    status: idx < currentIndex ? 'done' : idx === currentIndex ? 'active' : 'pending',
    reachable: canNavigateTo ? canNavigateTo(s.key) : true,
  }))

  return (
    <FloatingWizardDock
      steps={dockSteps}
      activeIndex={currentIndex}
      onStepClick={(idx) => {
        const target = steps[idx]
        if (target) onStepClick?.(target.key)
      }}
      canNavigateTo={(idx) => {
        const target = steps[idx]
        return target && canNavigateTo ? canNavigateTo(target.key) : true
      }}
    />
  )
}
