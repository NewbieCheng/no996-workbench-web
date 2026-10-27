/**
 * 人设存储：浏览器 IndexedDB 本机副本（非云端）。
 * 页面只依赖 PersonaRepository；服务端 DB 就绪后可换实现，不必改 UI。
 */
import { createIndexedDbPersonaRepository } from './idb-repository'
import { composePersonaBackground, pickInitialPersonaId } from './background'
import { personaReadyForInjection } from './store-maintenance'
import type { PersonaRepository } from './repository'
import type { PersonaRecord, SavedPersona } from './types'

export {
  composePersonaBackground,
  personaInjectionParts,
  personaMenuHint,
  pickInitialPersonaId,
  positioningSummary,
} from './background'

export type {
  AccountGoal,
  CitePermission,
  CompanyProfileFormData,
  PackagingId,
  PaidClientStatus,
  PersonaFormData,
  PersonaMode,
  PersonaQuestionnaire,
  PersonaRecord,
  PositioningId,
  ProfileKind,
  SavedPersona,
  ShareWillingness,
  UserProfileFormData,
} from './types'
export {
  EMPTY_COMPANY_FORM,
  EMPTY_QUESTIONNAIRE,
  EMPTY_USER_FORM,
  newPersonaId,
  nowIso,
  summarizeFromContent,
} from './types'
export {
  inheritSimpleToAdvanced,
  isCompanyFormData,
  isQuestionnaireEmpty,
  missingRequiredQuestionnaireKeys,
  normalizeQuestionnaire,
  projectLegacyUserForm,
  syncLegacyProjection,
} from './questionnaire'
export type { PersonaRepository } from './repository'

let repo: PersonaRepository | null = null

/** 当前默认：IndexedDB。后端账号库就绪后可在此切换/组合远程仓储。 */
export function getPersonaRepository(): PersonaRepository {
  if (!repo) repo = createIndexedDbPersonaRepository()
  return repo
}

/** 测试或未来注入远程实现。 */
export function setPersonaRepository(next: PersonaRepository) {
  repo = next
}

export async function listPersonas(kind: Parameters<PersonaRepository['list']>[0]) {
  return getPersonaRepository().list(kind)
}

export async function getPersona(id: string) {
  return getPersonaRepository().get(id)
}

export async function getActivePersona(kind?: Parameters<PersonaRepository['getActive']>[0]) {
  return getPersonaRepository().getActive(kind)
}

export async function createPersona(kind: Parameters<PersonaRepository['create']>[0], name?: string) {
  return getPersonaRepository().create(kind, name)
}

export async function upsertPersona(record: PersonaRecord) {
  return getPersonaRepository().upsert(record)
}

export async function renamePersona(id: string, name: string) {
  return getPersonaRepository().rename(id, name)
}

export async function setActivePersona(id: string) {
  return getPersonaRepository().setActive(id)
}

export async function deletePersona(id: string) {
  return getPersonaRepository().delete(id)
}

/** 其他工具「引用本机人设」：读当前启用档。 */
export async function readPersona(): Promise<SavedPersona | null> {
  const active = await getActivePersona()
  if (!active || !active.content.trim()) return null
  return { name: active.name, summary: active.summary || active.name, content: active.content }
}

/**
 * 读「背景人设」：启用档的**身份事实**（含定位卡片的结构化字段）。
 *
 * 与 `readPersona()` 的区别：
 * - `readPersona()` 只给档案正文，用于提示词里的「表达参考人设」变量；
 * - 本函数额外拼上定位卡片（所属行业 / 职业身份 / 主要业务 / 目标客户…），
 *   生成的是**背景上下文**，由内核挂在 system 消息上。
 *
 * 两者都读同一档，所以开了开关就一定一致，不会出现「语气是 A、身份是 B」。
 * 没有启用档或内容为空时返回 `null`。
 */
export async function readPersonaContext(): Promise<SavedPersona | null> {
  const active = await getActivePersona()
  if (!active) return null
  const background = composePersonaBackground(active)
  if (!background) return null
  return { name: active.name, summary: active.summary || active.name, content: background }
}

/**
 * 列出可用于注入的候选档（按最近更新倒序，仓储已排好），并标出默认选中项。
 *
 * 供「人设注入」控件渲染菜单：用户既可以用默认档，也可以临时换一档，
 * 换档只影响**这一页这一次**的生成，不改动本机保存的启用状态。
 *
 * 只返回真实保存过的档；一条都没有时 `records` 为空数组，界面应给出空态而不伪造。
 */
export async function listPersonaOptions(): Promise<{
  /** 候选档（真实数据，未加工） */
  records: PersonaRecord[]
  /** 默认选中的档 id：启用档优先，否则最近更新的一档 */
  activeId: string | null
}> {
  const all = await getPersonaRepository().list('user')
  const records = all.filter(personaReadyForInjection)
  return { records, activeId: pickInitialPersonaId(records) }
}

/** 兼容旧单档写入：落到个人启用档或新建。 */
export async function savePersona(persona: SavedPersona) {
  const repoApi = getPersonaRepository()
  const existing = (await repoApi.getActive('user')) ?? (await repoApi.list('user'))[0]
  if (existing) {
    await repoApi.upsert({
      ...existing,
      name: persona.name,
      summary: persona.summary,
      content: persona.content,
    })
    return
  }
  const created = await repoApi.create('user', persona.name)
  await repoApi.upsert({
    ...created,
    name: persona.name,
    summary: persona.summary,
    content: persona.content,
    isActive: true,
  })
}
