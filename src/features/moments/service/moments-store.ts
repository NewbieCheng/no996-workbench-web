import {
  getContent,
  getItem,
  getWeek,
  listContents,
  listItems,
  putContent,
  putItem,
  putMaterial,
  putWeek,
  putWeekPlan,
  removeContent,
  removeItem,
} from '../../../services/moments/idb-repository'
import {
  clampVersionIndex,
  type MomentsContent,
  type MomentsContentDraft,
  type MomentsDayMaterial,
  type MomentsGenerationStatus,
  type MomentsPlanResult,
  type MomentsScheduleItem,
  type MomentsWeekRecord,
  type MomentsWeekView,
} from '../domain/moments'

function now(): string {
  return new Date().toISOString()
}

export function nextScheduleVersion(weekId: string): string {
  return `${weekId}@${now()}`
}

export async function getWeekRecord(weekId: string): Promise<MomentsWeekRecord | null> {
  return getWeek(weekId)
}

export async function putWeekRecord(record: MomentsWeekRecord): Promise<void> {
  await putWeek(record)
}

export async function listScheduleItems(weekId?: string): Promise<MomentsScheduleItem[]> {
  return listItems(weekId)
}

export async function patchScheduleItem(
  itemId: string,
  patch: Partial<Omit<MomentsScheduleItem, 'id'>>,
): Promise<MomentsScheduleItem | null> {
  const existing = await getItem(itemId)
  if (!existing) return null
  const next = { ...existing, ...patch, updatedAt: now() }
  await putItem(next)
  return next
}

export async function setItemGenerationStatus(
  itemId: string,
  status: MomentsGenerationStatus,
  error?: string,
): Promise<void> {
  await patchScheduleItem(itemId, {
    generationStatus: status,
    ...(error ? { error } : { error: undefined }),
  })
}

export async function replaceScheduleItems(
  weekId: string,
  days: MomentsPlanResult['days'],
): Promise<MomentsScheduleItem[]> {
  for (const item of await listItems(weekId)) await removeItem(item.id)
  for (const content of await listContents(weekId)) await removeContent(content.id)

  const stamp = now()
  const created: MomentsScheduleItem[] = []
  for (const day of days) {
    for (const item of day.items) {
      const record: MomentsScheduleItem = {
        id: `msi_${crypto.randomUUID()}`,
        weekId,
        date: day.date,
        publishOrder: item.publishOrder,
        contentDirection: item.contentDirection,
        topic: item.topic,
        ...(item.captureSuggestion?.trim() ? { captureSuggestion: item.captureSuggestion.trim() } : {}),
        generationStatus: 'pending',
        updatedAt: stamp,
      }
      await putItem(record)
      created.push(record)
    }
  }
  return created.sort((a, b) => a.date.localeCompare(b.date) || a.publishOrder - b.publishOrder)
}

export async function upsertDayContents(
  weekId: string,
  drafts: MomentsContentDraft[],
  usedMock?: boolean,
): Promise<MomentsContent[]> {
  const saved: MomentsContent[] = []
  for (const draft of drafts) {
    const item = await getItem(draft.scheduleItemId)
    if (!item) continue
    const existing = (await listContents(weekId)).find((row) => row.scheduleItemId === draft.scheduleItemId)
    const record: MomentsContent = {
      id: existing?.id ?? `mct_${crypto.randomUUID()}`,
      scheduleItemId: draft.scheduleItemId,
      weekId,
      date: item.date,
      publishOrder: item.publishOrder,
      contentDirection: item.contentDirection,
      topic: item.topic,
      versions: draft.versions,
      versionMeta: draft.versionMeta,
      currentVersion: existing ? clampVersionIndex(existing.currentVersion) : 0,
      manuallyEdited: false,
      ...(usedMock ? { usedMock: true } : {}),
      updatedAt: now(),
    }
    await putContent(record)
    await setItemGenerationStatus(item.id, 'ready')
    saved.push(record)
  }
  return saved
}

export async function replaceContentVersions(
  contentId: string,
  draft: MomentsContentDraft,
  currentVersion: number,
  usedMock?: boolean,
): Promise<MomentsContent | null> {
  const existing = await getContent(contentId)
  if (!existing) return null
  const next: MomentsContent = {
    ...existing,
    versions: draft.versions,
    versionMeta: draft.versionMeta,
    currentVersion: clampVersionIndex(currentVersion),
    manuallyEdited: false,
    editedText: undefined,
    ...(usedMock ? { usedMock: true } : {}),
    updatedAt: now(),
  }
  await putContent(next)
  return next
}

export async function adoptContentVersion(contentId: string, version: number): Promise<MomentsContent | null> {
  const existing = await getContent(contentId)
  if (!existing) return null
  const next = { ...existing, currentVersion: clampVersionIndex(version), updatedAt: now() }
  await putContent(next)
  return next
}

export async function saveEditedContentText(contentId: string, text: string): Promise<MomentsContent | null> {
  const existing = await getContent(contentId)
  if (!existing) return null
  const next = {
    ...existing,
    editedText: text,
    manuallyEdited: text.trim().length > 0,
    updatedAt: now(),
  }
  await putContent(next)
  return next
}

export async function saveDayMaterials(materials: MomentsDayMaterial[]): Promise<void> {
  for (const row of materials) await putMaterial(row)
}

export async function buildWeekView(weekId: string): Promise<MomentsWeekView | null> {
  const week = await getWeek(weekId)
  if (!week) return null
  const items = await listItems(weekId)
  const contents = await listContents(weekId)
  const scheduledDates = [...new Set(items.map((item) => item.date))]
  const generatedDates = scheduledDates.filter((date) =>
    contents.some((row) => row.date === date && row.versions.length === 3),
  )
  return {
    week,
    items,
    contents,
    generatedDays: generatedDates.length,
    scheduledDays: scheduledDates.length,
  }
}

export type WeekConfigDraft = {
  weekId: string
  planPeriod: { startDate: string; endDate: string }
  planningMode: MomentsWeekRecord['planningMode']
  productRef?: MomentsWeekRecord['productRef']
  activityRef?: MomentsWeekRecord['activityRef']
  publishSpec: MomentsWeekRecord['publishSpec']
  businessPurpose: string
  coreTasks: string
}

export async function savePlan(draft: WeekConfigDraft, days?: MomentsPlanResult['days']): Promise<MomentsWeekView> {
  const existing = await getWeek(draft.weekId)
  const stamp = now()
  const record: MomentsWeekRecord = {
    id: draft.weekId,
    weekStart: draft.planPeriod.startDate || existing?.weekStart || draft.weekId,
    weekEnd: draft.planPeriod.endDate || existing?.weekEnd || draft.weekId,
    planningMode: draft.planningMode,
    status: existing?.status ?? 'draft',
    businessPurpose: draft.businessPurpose,
    coreTasks: draft.coreTasks,
    ...(draft.productRef ? { productRef: draft.productRef } : {}),
    ...(draft.activityRef ? { activityRef: draft.activityRef } : {}),
    publishSpec: draft.publishSpec,
    ...(existing?.scheduleVersion ? { scheduleVersion: existing.scheduleVersion } : {}),
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  }
  if (days) {
    const items: MomentsScheduleItem[] = days.flatMap((day) => day.items.map((item) => ({
      id: `msi_${crypto.randomUUID()}`,
      weekId: draft.weekId,
      date: day.date,
      publishOrder: item.publishOrder,
      contentDirection: item.contentDirection,
      topic: item.topic,
      ...(item.captureSuggestion?.trim() ? { captureSuggestion: item.captureSuggestion.trim() } : {}),
      generationStatus: 'pending' as const,
      updatedAt: stamp,
    })))
    await putWeekPlan({ ...record, status: 'draft', scheduleVersion: undefined }, items)
  } else {
    await putWeek(record)
  }
  const view = await buildWeekView(draft.weekId)
  if (!view) throw new Error('周排期保存后不可读')
  return view
}

export async function confirmWeek(weekId: string): Promise<MomentsWeekView> {
  const existing = await getWeek(weekId)
  if (!existing) throw new Error('周排期不存在')
  const items = await listItems(weekId)
  if (items.length === 0) throw new Error('本周还没有排期内容')
  await putWeek({
    ...existing,
    status: 'confirmed',
    scheduleVersion: nextScheduleVersion(weekId),
    updatedAt: now(),
  })
  const view = await buildWeekView(weekId)
  if (!view) throw new Error('周排期确认后不可读')
  return view
}
