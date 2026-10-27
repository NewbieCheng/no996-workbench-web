import type { PersonaRecord, ProfileKind } from './types'

/**
 * 人设持久化抽象：本机 IndexedDB 实现；后续可换成服务端 DB API，页面不用改。
 * 不在此层做 agent loop。
 */
export interface PersonaRepository {
  list(kind: ProfileKind): Promise<PersonaRecord[]>
  get(id: string): Promise<PersonaRecord | null>
  /** 启用档；不传 kind 时优先个人，其次企业。 */
  getActive(kind?: ProfileKind): Promise<PersonaRecord | null>
  create(kind: ProfileKind, name?: string): Promise<PersonaRecord>
  upsert(record: PersonaRecord): Promise<PersonaRecord>
  rename(id: string, name: string): Promise<PersonaRecord | null>
  setActive(id: string): Promise<PersonaRecord | null>
  delete(id: string): Promise<void>
}
