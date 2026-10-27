import { useCallback, useState } from 'react'

/** 配音页局部反馈（试听等），生成任务已迁至 TtsJobProvider */
export function useTtsSession() {
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const clearMessages = useCallback(() => {
    setError('')
    setFeedback('')
  }, [])

  return {
    error,
    setError,
    feedback,
    setFeedback,
    clearMessages,
  }
}

export type TtsParams = {
  rate: number
  volume: number
  pitch: number
  instruction: string
}
