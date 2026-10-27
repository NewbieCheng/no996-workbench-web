/** 朋友圈运营领域契约：周排期、单日文案。网页端不落工作区 Markdown。 */

export type MomentsPlanningMode = 'daily' | 'theme'
export type MomentsWeekStatus = 'draft' | 'confirmed'
export type MomentsGenerationStatus = 'pending' | 'generating' | 'ready' | 'failed'
export type MomentsErrorCode = 'USER_PROFILE_REQUIRED' | 'INVALID_INPUT' | 'QC_FAILED'

export interface MomentsProductRef {
  id: string
  name: string
}

export interface MomentsActivityRef {
  name: string
}

export type MomentsPublishSpec =
  | { kind: 'weekly'; perWeek: number }
  | { kind: 'daily'; perDay: number[] }

export interface MomentsWeekRecord {
  id: string
  weekStart: string
  weekEnd: string
  planningMode: MomentsPlanningMode
  status: MomentsWeekStatus
  businessPurpose: string
  coreTasks: string
  productRef?: MomentsProductRef
  activityRef?: MomentsActivityRef
  publishSpec: MomentsPublishSpec
  scheduleVersion?: string
  createdAt: string
  updatedAt: string
}

export interface MomentsScheduleItem {
  id: string
  weekId: string
  date: string
  publishOrder: number
  contentDirection: string
  topic: string
  captureSuggestion?: string
  generationStatus: MomentsGenerationStatus
  error?: string
  updatedAt: string
}

export interface MomentsVersionMeta {
  version: number
  angleTitle: string
  imageSuggestion?: string
  naturalBridge?: string
}

export interface MomentsContent {
  id: string
  scheduleItemId: string
  weekId: string
  date: string
  publishOrder: number
  contentDirection: string
  topic: string
  versions: string[]
  versionMeta: MomentsVersionMeta[]
  currentVersion: number
  manuallyEdited: boolean
  editedText?: string
  usedMock?: boolean
  updatedAt: string
}

export interface MomentsDayMaterial {
  scheduleItemId: string
  manualMaterial?: string
}

export interface MomentsContentDraft {
  scheduleItemId: string
  contentDirection: string
  topic: string
  versions: string[]
  versionMeta: MomentsVersionMeta[]
  currentVersion: number
}

export interface MomentsPlanResult {
  days: Array<{
    date: string
    items: Array<{
      publishOrder: number
      contentDirection: string
      topic: string
      captureSuggestion?: string
    }>
  }>
}

export interface MomentsWeekView {
  week: MomentsWeekRecord
  items: MomentsScheduleItem[]
  contents: MomentsContent[]
  generatedDays: number
  scheduledDays: number
}

export type MomentsRunOutcome<T> =
  | { status: 'success'; value: T }
  | {
      status: 'blocked' | 'failed'
      code: MomentsErrorCode
      message: string
      details?: string[]
      recoveryAction?: string
    }

export function resolveMomentsBody(content: MomentsContent): string {
  const index = clampVersionIndex(content.currentVersion)
  if (content.manuallyEdited && content.editedText?.trim()) return content.editedText
  return content.versions[index] ?? ''
}

export function clampVersionIndex(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(2, Math.max(0, Math.trunc(value)))
}

export function serializeMomentsPlanMarkdown(
  week: MomentsWeekRecord,
  items: MomentsScheduleItem[],
): string {
  const modeLabel = week.planningMode === 'theme' ? '主题推广周' : '日常经营周'
  const lines: string[] = [
    `# 朋友圈周排期：${week.weekStart} 至 ${week.weekEnd}`,
    '',
    `> 规划模式：${modeLabel}`,
    week.scheduleVersion ? `> 排期版本：${week.scheduleVersion}` : '',
    `> 更新时间：${week.updatedAt}`,
    '',
    '## 周级信息',
    `- **规划周期**：${week.weekStart} 至 ${week.weekEnd}`,
    `- **本周经营目的**：${week.businessPurpose}`,
    `- **本周核心任务**：${week.coreTasks}`,
  ]
  if (week.productRef) lines.push(`- **主推产品**：${week.productRef.name}`)
  if (week.activityRef) lines.push(`- **主推活动**：${week.activityRef.name}`)
  lines.push('', '## 朋友圈周排期')
  for (const date of [...new Set(items.map((item) => item.date))].sort()) {
    lines.push('', `### ${date}`)
    for (const item of items.filter((row) => row.date === date).sort((a, b) => a.publishOrder - b.publishOrder)) {
      lines.push(`${item.publishOrder}. 内容方向：${item.contentDirection}`)
      lines.push(`   一句话选题：${item.topic}`)
      if (item.captureSuggestion?.trim()) {
        lines.push(`   建议优先捕捉：${item.captureSuggestion.trim()}`)
      }
    }
  }
  lines.push('', '---', '*(注：本文件由「朋友圈运营」页面生成，仅供本机复制)*', '')
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n')
}

export function serializeMomentsDayMarkdown(date: string, contents: MomentsContent[]): string {
  const lines: string[] = [`# 朋友圈内容：${date}`, '']
  for (const content of [...contents].sort((a, b) => a.publishOrder - b.publishOrder)) {
    const order = String(content.publishOrder).padStart(2, '0')
    lines.push(`## ${order}｜${content.topic}`, '', `> 内容方向：${content.contentDirection}`, '')
    content.versions.forEach((body, index) => {
      const meta = content.versionMeta.find((row) => row.version === index)
      lines.push(`### 版本${['一', '二', '三'][index] ?? index + 1}｜${meta?.angleTitle ?? ''}`, '', body, '')
      if (meta?.imageSuggestion?.trim()) lines.push(`**配图建议**：${meta.imageSuggestion.trim()}`, '')
      if (meta?.naturalBridge?.trim()) lines.push(`**自然承接**：${meta.naturalBridge.trim()}`, '')
    })
    lines.push(`**当前采用**：版本${['一', '二', '三'][clampVersionIndex(content.currentVersion)] ?? ''}`, '')
  }
  lines.push('---', '*(注：采用版本与人工编辑状态由本机页面保存)*', '')
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n')
}
