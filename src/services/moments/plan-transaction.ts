import type { MomentsContent, MomentsScheduleItem, MomentsWeekRecord } from '../../features/moments/domain/moments'

/** Commit the week and its schedule in one IndexedDB transaction. */
export async function commitWeekPlan(db: IDBDatabase, record: MomentsWeekRecord, items: MomentsScheduleItem[]): Promise<void> {
  const tx = db.transaction(['weeks', 'schedule_items', 'contents'], 'readwrite')
  const weeks = tx.objectStore('weeks')
  const schedules = tx.objectStore('schedule_items')
  const contents = tx.objectStore('contents')
  let reason = ''
  const oldRequest = schedules.index('by_week').getAll(record.id)
  const contentRequest = contents.index('by_week').getAll(record.id)
  let oldItems: MomentsScheduleItem[] | undefined
  let oldContents: MomentsContent[] | undefined
  const apply = () => {
    if (!oldItems || !oldContents) return
    const retained = new Set<string>()
    const finalItems = items.map((item) => {
      const old = oldItems!.find((row) => row.date === item.date && row.publishOrder === item.publishOrder && row.contentDirection === item.contentDirection && row.topic === item.topic && (row.captureSuggestion ?? '') === (item.captureSuggestion ?? ''))
      if (!old) return item
      retained.add(old.id)
      return old
    })
    if (oldContents.some((content) => !retained.has(content.scheduleItemId))) {
      reason = '已有文案对应的排期发生变化，请先备份或移除相关文案后再重新生成排期。'
      tx.abort()
      return
    }
    for (const old of oldItems) if (!retained.has(old.id)) schedules.delete(old.id)
    for (const item of finalItems) schedules.put(item)
    weeks.put(record)
  }
  oldRequest.onsuccess = () => { oldItems = oldRequest.result as MomentsScheduleItem[]; apply() }
  contentRequest.onsuccess = () => { oldContents = contentRequest.result as MomentsContent[]; apply() }
  try {
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(new Error(reason || tx.error?.message || '朋友圈排期事务已中止'))
      tx.onerror = () => reject(tx.error ?? new Error('朋友圈排期事务失败'))
    })
  } finally {
    db.close()
  }
}
