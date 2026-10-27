import { createContext, useContext } from 'react'
import type { WorkbenchTaskRecordLayout } from '../features/tasks/WorkbenchTaskRecords'

export const PageHistoryLayoutContext = createContext<WorkbenchTaskRecordLayout | null>(null)

export const PageHistoryFieldOrderContext = createContext<readonly string[] | null>(null)
export const PageHistoryFieldOrderActionsContext = createContext<{
  moveField: (fromId: string, toId: string) => void
} | null>(null)

export function usePageHistoryLayout(): WorkbenchTaskRecordLayout | null {
  return useContext(PageHistoryLayoutContext)
}

export function usePageHistoryFieldOrder(): readonly string[] | null {
  return useContext(PageHistoryFieldOrderContext)
}

export function usePageHistoryFieldOrderActions() {
  return useContext(PageHistoryFieldOrderActionsContext)
}
