/**
 * 主库版本号的**唯一来源**：`idb-health.ts`（健康检查）与 `idb-repository.ts`（写入方）
 * 都引用这里，避免两处各写一份而漂移。
 *
 * 漂移的后果很严重：健康检查若用旧版本号 `indexedDB.open`，浏览器会抛 `VersionError`，
 * 旧实现把它当成「库损坏」，进而删掉用户全部任务历史。
 *
 * v3：新增 `script_generate` 任务类型（store 结构未变，仅多走一次 ensure schema）。
 */
export const WORKBENCH_TASKS_DB_VERSION = 3

const LEGACY_STORE_JOBS = 'jobs'
const LEGACY_STORE_BLOBS = 'blobs'
const MAIN_STORE_JOBS = 'jobs'
const MAIN_STORE_BLOBS = 'blobs'
const MAIN_STORE_PAYLOADS = 'payloads'

function toNameSet(storeNames: DOMStringList | Iterable<string>): Set<string> {
  return new Set(
    typeof (storeNames as DOMStringList)[Symbol.iterator] === 'function'
      ? Array.from(storeNames as DOMStringList)
      : Array.from(storeNames as Iterable<string>),
  )
}

/** True when the legacy DB has the object stores required to read migration data. */
export function legacyStoreNamesHealthy(storeNames: DOMStringList | Iterable<string>): boolean {
  const names = toNameSet(storeNames)
  return names.has(LEGACY_STORE_JOBS) && names.has(LEGACY_STORE_BLOBS)
}

/** Wipe legacy DB when it is an empty shell or has no migratable rows. */
export function shouldWipeLegacy(emptyShell: boolean, jobCount: number, blobCount: number): boolean {
  if (emptyShell) return true
  if (jobCount === 0 && blobCount === 0) return true
  return false
}

export function mainStoreNamesHealthy(storeNames: DOMStringList | Iterable<string>): boolean {
  const names = toNameSet(storeNames)
  return names.has(MAIN_STORE_JOBS) && names.has(MAIN_STORE_BLOBS) && names.has(MAIN_STORE_PAYLOADS)
}

/** 主库探测结果：只有 `ok` 才允许对库做破坏性判断。 */
export type MainDbProbe = 'ok' | 'version-ahead' | 'unavailable'

/**
 * 是否应该清空主库。
 *
 * 只有真正读到库结构、且结构不完整时才允许 wipe。
 * `version-ahead`（库由更新版本写入）与 `unavailable`（打不开、无法判定）一律返回 false：
 * 宁可跳过这次修复，也不能因为探测失败就删掉用户的任务历史。
 */
export function shouldWipeMainFromProbe(probe: MainDbProbe, storeNamesHealthy: boolean): boolean {
  if (probe !== 'ok') return false
  return !storeNamesHealthy
}
