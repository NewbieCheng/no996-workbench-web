import { createContext, useContext } from 'react'
import type { WorkbenchTaskRecordLayout } from './WorkbenchTaskRecords'

export const TaskRecordLayoutContext = createContext<WorkbenchTaskRecordLayout>('cards')

export function useTaskRecordLayout(): WorkbenchTaskRecordLayout {
  return useContext(TaskRecordLayoutContext)
}
