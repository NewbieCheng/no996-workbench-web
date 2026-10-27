import { useEffect, useState } from 'react'
import { useWorkbenchTaskActions, type WorkbenchTaskRecord } from '../../services/workbench-tasks'

export function isVoicePlaybackTask(task: WorkbenchTaskRecord): boolean {
  return task.kind === 'voice_tts' || task.kind === 'ip_video_audio'
}

export function useTaskVoicePlayback(task: WorkbenchTaskRecord) {
  const { getVoicePlaybackUrl, getVoiceEmbedFallbackUrl, getPayload } = useWorkbenchTaskActions()
  const [audioUrl, setAudioUrl] = useState('')
  const [upstreamUrl, setUpstreamUrl] = useState('')
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const [triedFallback, setTriedFallback] = useState(false)

  const active = isVoicePlaybackTask(task) && task.status === 'succeeded'

  useEffect(() => {
    if (!active) {
      setAudioUrl('')
      setUpstreamUrl('')
      setPlaybackFailed(false)
      setTriedFallback(false)
      return
    }
    setPlaybackFailed(false)
    setTriedFallback(false)
    void getVoicePlaybackUrl(task).then(setAudioUrl)
    void getPayload(task.payloadId).then((data) => {
      const upstream =
        data && typeof data === 'object' && 'upstreamAudioUrl' in data
          ? String((data as { upstreamAudioUrl?: string }).upstreamAudioUrl ?? '').trim()
          : ''
      setUpstreamUrl(upstream)
    })
  }, [task, active, getVoicePlaybackUrl, getPayload])

  const handlePlaybackError = () => {
    if (triedFallback || !audioUrl.startsWith('blob:')) {
      setPlaybackFailed(true)
      return
    }
    setTriedFallback(true)
    void getVoiceEmbedFallbackUrl(task).then((fallback) => {
      if (fallback) {
        setPlaybackFailed(false)
        setAudioUrl(fallback)
      } else {
        setPlaybackFailed(true)
      }
    })
  }

  const showCopyUpstream =
    Boolean(upstreamUrl) && upstreamUrl !== audioUrl

  return {
    active,
    audioUrl,
    upstreamUrl,
    playbackFailed,
    showCopyUpstream,
    handlePlaybackError,
  }
}
