import type { WeekConfigDraft } from '../service/moments-store'

/** DEV only. Production builds must not import this file from ungated paths. */
export function exampleWeekConfig(weekId: string, startDate: string, endDate: string): WeekConfigDraft {
  return {
    weekId,
    planPeriod: { startDate, endDate },
    planningMode: 'daily',
    productRef: { id: `prd_${weekId}`, name: '家庭小锅具' },
    publishSpec: { kind: 'weekly', perWeek: 7 },
    businessPurpose: '让熟客先理解这套锅具怎么用在日常晚饭里，再自然问价格和规格。',
    coreTasks: '围绕真实做饭场景建立信任，减少生硬的产品介绍。',
  }
}
