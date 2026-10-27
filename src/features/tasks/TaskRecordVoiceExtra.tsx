import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { TaskVoicePlaybackBlock } from './TaskVoicePlaybackBlock'

export function TaskRecordVoiceExtra({ task }: { task: WorkbenchTaskRecord }) {
  return <TaskVoicePlaybackBlock task={task} layout="inline" />
}
