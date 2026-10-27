import type { TFunction } from 'i18next'
import type { MomentsPlanningMode } from '../domain/moments'
import type { WeekConfigDraft } from '../service/moments-store'

export type WeekConfigFormState = {
  mode: MomentsPlanningMode
  productName: string
  activityName: string
  perWeek: number
  perDay: number[]
  splitByDay: boolean
  businessPurpose: string
  coreTasks: string
}

export function draftToFormState(draft: WeekConfigDraft): WeekConfigFormState {
  return {
    mode: draft.planningMode,
    productName: draft.productRef?.name ?? '',
    activityName: draft.activityRef?.name ?? '',
    perWeek: draft.publishSpec.kind === 'weekly' ? draft.publishSpec.perWeek : 7,
    perDay: draft.publishSpec.kind === 'daily' ? draft.publishSpec.perDay : [1, 1, 1, 1, 1, 1, 1],
    splitByDay: draft.publishSpec.kind === 'daily',
    businessPurpose: draft.businessPurpose,
    coreTasks: draft.coreTasks,
  }
}

export function formStateToDraft(initial: WeekConfigDraft, state: WeekConfigFormState): WeekConfigDraft {
  const product = state.productName.trim()
    ? { id: initial.productRef?.id ?? `prd_${initial.weekId}`, name: state.productName.trim() }
    : undefined
  const activityRef = state.activityName.trim() ? { name: state.activityName.trim() } : undefined
  const publishSpec = state.splitByDay
    ? { kind: 'daily' as const, perDay: state.perDay }
    : { kind: 'weekly' as const, perWeek: state.perWeek }

  return {
    weekId: initial.weekId,
    planPeriod: initial.planPeriod,
    planningMode: state.mode,
    productRef: product,
    activityRef,
    publishSpec,
    businessPurpose: state.businessPurpose.trim(),
    coreTasks: state.coreTasks.trim(),
  }
}

export function validateWeekConfigStep(step: number, state: WeekConfigFormState, t: TFunction): string[] {
  const list: string[] = []
  if (step === 0) {
    if (state.mode === 'theme' && !state.productName.trim() && !state.activityName.trim()) {
      list.push(t('momentsErrThemeNeedsTarget'))
    }
    return list
  }
  if (step === 1) {
    if (state.splitByDay) {
      if (state.perDay.length !== 7 || state.perDay.some((count) => !Number.isInteger(count) || count < 1 || count > 4)) list.push(t('momentsErrPerDay'))
    } else if (!Number.isInteger(state.perWeek) || state.perWeek < 1 || state.perWeek > 28) {
      list.push(t('momentsErrPerWeek'))
    }
    return list
  }
  if (!state.businessPurpose.trim()) list.push(t('momentsErrBusinessPurpose'))
  if (!state.coreTasks.trim()) list.push(t('momentsErrCoreTasks'))
  return list
}

export function validateWeekConfigAll(state: WeekConfigFormState, t: TFunction): string[] {
  return [0, 1, 2].flatMap((step) => validateWeekConfigStep(step, state, t))
}
