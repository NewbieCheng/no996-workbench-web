/** No unsafe in-memory fallback: two tabs could otherwise submit billable work twice. */
export function requireTaskLocks(): LockManager {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('当前浏览器不支持安全的多标签任务锁，请使用支持 Web Locks 的 HTTPS 浏览器。')
  return navigator.locks
}
export async function withTaskLock<T>(name: string, work: () => Promise<T>): Promise<T> {
  return await requireTaskLocks().request(`no996-workbench:${name}`, work)
}
export async function tryTaskLock<T>(name: string, work: () => Promise<T>): Promise<T | undefined> {
  return await requireTaskLocks().request(`no996-workbench:${name}`, { ifAvailable: true }, (lock) => lock ? work() : undefined)
}
