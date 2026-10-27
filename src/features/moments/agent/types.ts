import type { AgentRunSnapshot } from '../../../agent'
import type {
  MomentsContentDraft,
  MomentsDayMaterial,
  MomentsPlanResult,
  MomentsPlanningMode,
  MomentsPublishSpec,
  MomentsScheduleItem,
  MomentsWeekRecord,
} from '../domain/moments'
import type { WeekConfigDraft } from '../service/moments-store'
import type { MomentsRunKind } from '../lib/route-state'

export type MomentsPlanInput = WeekConfigDraft & {
  revisionInstruction?: string
  currentDays?: MomentsPlanResult['days']
  personaContent?: string
  personaBackground?: string
}

export type MomentsCopyInput = {
  weekId: string
  date: string
  week: MomentsWeekRecord
  items: MomentsScheduleItem[]
  materials: MomentsDayMaterial[]
  personaContent?: string
  personaBackground?: string
  rewrite?: {
    scheduleItemId: string
    contentId: string
    currentVersion: number
    instruction: string
    previousVersions: string[]
  }
}

export type MomentsPlanTaskPayload = {
  input: MomentsPlanInput
  days?: MomentsPlanResult['days']
  run?: AgentRunSnapshot | null
  usedMock?: boolean
  resumeFromStageId?: string
}

export type MomentsCopyTaskPayload = {
  input: MomentsCopyInput
  drafts?: MomentsContentDraft[]
  run?: AgentRunSnapshot | null
  usedMock?: boolean
  resumeFromStageId?: string
}

export type EnqueueMomentsPlanInput = {
  input: MomentsPlanInput
  route: string
  title: string
}

export type EnqueueMomentsCopyInput = {
  input: MomentsCopyInput
  route: string
  title: string
  runKind: Extract<MomentsRunKind, 'copy' | 'rewrite'>
}

export type { MomentsPlanningMode, MomentsPublishSpec }
