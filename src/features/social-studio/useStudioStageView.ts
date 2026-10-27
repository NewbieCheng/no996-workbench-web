import { useEffect, useState } from 'react'
import type { StudioStageView } from './studio-types'

export function useStudioStageView(generating: boolean) {
  const [stageView, setStageView] = useState<StudioStageView>('edit')

  useEffect(() => {
    if (generating) setStageView('preview')
  }, [generating])

  const readOnly = stageView === 'preview' || generating

  return {
    stageView,
    setStageView,
    readOnly,
    editLocked: generating,
  }
}
