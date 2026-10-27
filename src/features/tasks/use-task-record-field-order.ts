import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_TASK_RECORD_FIELD_IDS } from './task-record-fields'

const STORAGE_KEY = 'wb-task-record-field-order'

function readStoredOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_TASK_RECORD_FIELD_IDS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_TASK_RECORD_FIELD_IDS]
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return [...DEFAULT_TASK_RECORD_FIELD_IDS]
  }
}

/** 列表模式字段顺序（可配合拖拽 UI 调用 moveField） */
export function useTaskRecordFieldOrder() {
  const [order, setOrder] = useState<string[]>(readStoredOrder)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
    } catch {
      /* ignore quota */
    }
  }, [order])

  const moveField = useCallback((fromId: string, toId: string) => {
    setOrder((prev) => {
      const next = [...prev]
      const from = next.indexOf(fromId)
      let to = next.indexOf(toId)
      if (from < 0 || to < 0 || from === to) return prev
      next.splice(from, 1)
      if (from < to) to -= 1
      next.splice(to, 0, fromId)
      return next
    })
  }, [])

  const resetOrder = useCallback(() => {
    setOrder([...DEFAULT_TASK_RECORD_FIELD_IDS])
  }, [])

  return { fieldOrder: order, moveField, resetOrder, setFieldOrder: setOrder }
}
