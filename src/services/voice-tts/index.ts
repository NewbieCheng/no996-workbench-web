/** @deprecated 请使用 `../workbench-tasks` */
export {
  WorkbenchTaskProvider as TtsJobProvider,
  useRegisterVoiceListStale,
  useWorkbenchTasks,
  useWorkbenchTaskActions,
  useWorkbenchTaskActiveCount,
  useWorkbenchTaskActiveCount as useTtsJobActiveCount,
  type EnqueueVoiceTtsInput as EnqueueTtsInput,
  type WorkbenchTaskRecord as TtsJobRecord,
} from '../workbench-tasks'

import { useWorkbenchTaskActions, useWorkbenchTasks } from '../workbench-tasks'

export function useTtsJobs() {
  return useWorkbenchTasks({ kind: 'voice_tts' })
}

export function useTtsJobActions() {
  const actions = useWorkbenchTaskActions()
  return {
    enqueue: actions.enqueueVoiceTts,
    removeJob: actions.removeTask,
    refreshJobs: actions.refreshTasks,
    getPlaybackUrl: actions.getVoicePlaybackUrl,
  }
}
