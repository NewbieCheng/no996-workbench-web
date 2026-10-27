import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listVoices,
  refreshVoice,
  deleteVoice,
  updateVoiceDisplayName,
  type VoiceCloneMeta,
  type VoiceCloneRecord,
} from '../../../api/voice-clone'
import { apiErrorMessage } from '../../../api/client'
import { mergeLocalVoiceDisplayNames } from '../../../lib/voice-display-name-local'

/** 间隔略长，减轻对上游 refresh 的压力 */
const POLL_MS = 5000
/** 阿里云 DEPLOYING 可能较久；超时只停轮询，不当作失败 */
const POLL_TIMEOUT_MS = 30 * 60 * 1000

export function useVoiceCatalog() {
  const [voices, setVoices] = useState<VoiceCloneRecord[]>([])
  const [meta, setMeta] = useState<VoiceCloneMeta | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState('')
  const [pollingId, setPollingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollStartedRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setPollingId(null)
    pollStartedRef.current = 0
  }, [])

  const loadVoices = useCallback(async () => {
    setListLoading(true)
    setError('')
    try {
      const res = await listVoices()
      setVoices(mergeLocalVoiceDisplayNames(res.data ?? []))
      setMeta(res.meta)
      if (!res.meta?.enabled) {
        setError('声音复刻功能当前未开放，请稍后再试。')
      }
      return res
    } catch (e) {
      setError(apiErrorMessage(e))
      return null
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVoices()
    return () => stopPolling()
  }, [loadVoices, stopPolling])

  const startPolling = useCallback(
    (voiceId: string, onReady?: (v: VoiceCloneRecord) => void, onFailed?: () => void) => {
      stopPolling()
      setPollingId(voiceId)
      pollStartedRef.current = Date.now()
      pollRef.current = setInterval(() => {
        void (async () => {
          if (Date.now() - pollStartedRef.current > POLL_TIMEOUT_MS) {
            stopPolling()
            setError(
              '上游仍在处理该音色，已暂停自动查询；请点击「刷新音色列表」或稍后再看，无需重新复刻。',
            )
            return
          }
          try {
            const updated = await refreshVoice(voiceId)
            setVoices((prev) => prev.map((v) => (v.voice_id === voiceId ? updated : v)))
            if (updated.ready_for_synthesis) {
              stopPolling()
              onReady?.(updated)
            } else if (updated.provider_status === 'UNDEPLOYED') {
              stopPolling()
              setError('音色审核未通过，请重新录制样本后再次复刻。')
              onFailed?.()
            }
          } catch {
            // keep polling
          }
        })()
      }, POLL_MS)
    },
    [stopPolling],
  )

  // 进页 / 刷新列表后：对仍为 DEPLOYING 的音色继续轮询（不只限刚创建那条）
  useEffect(() => {
    if (pollingId) return
    const pending = voices.find(
      (v) =>
        !v.ready_for_synthesis &&
        (v.provider_status === 'DEPLOYING' || v.provider_status === ''),
    )
    if (pending) {
      startPolling(pending.voice_id)
    }
  }, [voices, pollingId, startPolling])

  const removeVoice = useCallback(async (voiceId: string) => {
    setError('')
    await deleteVoice(voiceId)
    setVoices((prev) => prev.filter((v) => v.voice_id !== voiceId))
  }, [])

  const renameVoice = useCallback(
    async (voiceId: string, displayName: string) => {
      setError('')
      const baseline = voices.find((v) => v.voice_id === voiceId)
      const result = await updateVoiceDisplayName(voiceId, displayName, baseline)
      setVoices((prev) => prev.map((v) => (v.voice_id === voiceId ? result.record : v)))
      return result
    },
    [voices],
  )

  const upsertVoice = useCallback((record: VoiceCloneRecord) => {
    setVoices((prev) => [record, ...prev.filter((v) => v.voice_id !== record.voice_id)])
  }, [])

  return {
    voices,
    meta,
    listLoading,
    error,
    setError,
    pollingId,
    loadVoices,
    startPolling,
    stopPolling,
    removeVoice,
    renameVoice,
    upsertVoice,
    setVoices,
  }
}
