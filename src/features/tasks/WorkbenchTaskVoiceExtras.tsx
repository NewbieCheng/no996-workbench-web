import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { TaskVoicePlaybackBlock } from './TaskVoicePlaybackBlock'

/** 配音任务在任务记录卡片内的试听与外链（仅任务中心等处复用） */
export function WorkbenchTaskVoiceExtras({ task }: { task: WorkbenchTaskRecord }) {
  return <TaskVoicePlaybackBlock task={task} layout="inline" />
}
