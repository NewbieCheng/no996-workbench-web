import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { VoiceCompactPlayer } from '../../components/VoiceCompactPlayer'
import { taskDrawerModule, taskDrawerSubject } from './task-drawer-label'
import { useTaskVoicePlayback } from './use-task-voice-playback'

type Props = {
  task: WorkbenchTaskRecord
}

export function TaskDrawerMiniPlayer({ task }: Props) {
  const { audioUrl, playbackFailed, handlePlaybackError } = useTaskVoicePlayback(task)
  const module = taskDrawerModule(task)
  const label = taskDrawerSubject(task)

  return (
    <div className="wb-task-drawer-player-wrap">
      <span className="wb-task-drawer-player__module">{module}</span>
      <VoiceCompactPlayer
        audioUrl={audioUrl}
        label={label}
        playbackFailed={playbackFailed}
        onPlaybackError={handlePlaybackError}
      />
    </div>
  )
}
