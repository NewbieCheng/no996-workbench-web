import { isQuestionnaireEmpty, normalizeQuestionnaire } from './questionnaire.ts'
import { EMPTY_USER_FORM, type PersonaRecord, type UserProfileFormData } from './types.ts'

/** 创作页注入：必须有生成并保存过的档案正文，仅有表单草稿不算「已有人设」。 */
export function personaReadyForInjection(record: PersonaRecord): boolean {
  return record.content.trim().length > 0
}

function userFormFingerprint(form: UserProfileFormData): string {
  const keys = Object.keys(EMPTY_USER_FORM).sort() as (keyof UserProfileFormData)[]
  return keys.map((k) => `${k}=${(form[k] ?? '').trim()}`).join('|')
}

function recordFingerprint(record: PersonaRecord): string {
  const form =
    record.kind === 'user'
      ? userFormFingerprint(record.formData as UserProfileFormData)
      : JSON.stringify(record.formData)
  return [record.kind, record.name.trim(), record.content.trim(), record.legacyContent ?? '', form].join('\0')
}

function isEmptyUserShell(record: PersonaRecord): boolean {
  if (record.kind !== 'user') return false
  if (record.content.trim() || record.candidatesMarkdown?.trim()) return false
  return isQuestionnaireEmpty(normalizeQuestionnaire(record.formData))
}

/**
 * 合并本机 IndexedDB 里的重复档：同 kind + 名称 + 正文 + 表单视为一条，保留最近更新。
 * 顺带删掉从未填写过的空壳档（人设页曾自动建过、但未填表也未生成）。
 */
export function reconcilePersonaRecords(all: PersonaRecord[]): PersonaRecord[] {
  const kept = new Map<string, PersonaRecord>()

  for (const record of all) {
    if (isEmptyUserShell(record)) continue

    const key = recordFingerprint(record)
    const prev = kept.get(key)
    if (!prev) {
      kept.set(key, record)
      continue
    }
    const newer = record.updatedAt.localeCompare(prev.updatedAt) >= 0 ? record : prev
    const older = newer === record ? prev : record
    kept.set(key, {
      ...newer,
      isActive: newer.isActive || older.isActive,
    })
  }

  let next = [...kept.values()]
  for (const kind of ['user', 'company'] as const) {
    const ofKind = next.filter((r) => r.kind === kind)
    if (ofKind.length > 0 && !ofKind.some((r) => r.isActive)) {
      const firstId = ofKind[0].id
      next = next.map((r) =>
        r.kind === kind && r.id === firstId ? { ...r, isActive: true } : r,
      )
    }
  }

  return next
}

export function personaStoreChanged(before: PersonaRecord[], after: PersonaRecord[]): boolean {
  if (before.length !== after.length) return true
  const a = before.map((r) => r.id).sort().join(',')
  const b = after.map((r) => r.id).sort().join(',')
  return a !== b
}
