import { useEffect, useRef } from 'react'
import type { PersonaRecord } from '../services/persona/types'

export type UsePersonaFormPrefillOptions<T> = {
  loading: boolean
  enabled: boolean
  record: PersonaRecord | null
  /** 用当前表单快照计算仅填空 patch */
  derive: (record: PersonaRecord) => { patch: Partial<T>; filledCount: number; personaName: string }
  applyPatch: (patch: Partial<T>) => void
  onApplied?: (info: { filledCount: number; personaName: string }) => void
}

/**
 * 人设定位卡片 → 创作页表单预填（仅填空、不覆盖用户已改）。
 * 在 loading 结束且 enabled 时，对当前选中档 merge 一次；换档时对新档再 merge。
 */
export function usePersonaFormPrefill<T>({
  loading,
  enabled,
  record,
  derive,
  applyPatch,
  onApplied,
}: UsePersonaFormPrefillOptions<T>) {
  const lastRecordId = useRef<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!enabled || !record) {
      lastRecordId.current = null
      return
    }
    if (lastRecordId.current === record.id) return

    const { patch, filledCount, personaName } = derive(record)
    if (filledCount > 0 && Object.keys(patch).length > 0) {
      applyPatch(patch)
      onApplied?.({ filledCount, personaName })
    }
    lastRecordId.current = record.id
  }, [loading, enabled, record, derive, applyPatch, onApplied])
}
