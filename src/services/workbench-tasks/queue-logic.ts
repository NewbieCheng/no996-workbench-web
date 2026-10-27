import { TASK_LIMITS, type WorkbenchTaskRecord, type WorkbenchTaskStatus } from './types.ts'

const TERMINAL: WorkbenchTaskStatus[] = ['succeeded', 'failed', 'cancelled']

export function canTransition(from: WorkbenchTaskStatus, to: WorkbenchTaskStatus): boolean {
  if (from === to) return true
  if (from === 'queued' && (to === 'running' || to === 'cancelled')) return true
  if (from === 'running' && (to === 'succeeded' || to === 'failed' || to === 'queued' || to === 'cancelled'))
    return true
  if (TERMINAL.includes(from)) return false
  return false
}

export function pickNextQueuedJob(jobs: WorkbenchTaskRecord[], ownerUserId?: number): WorkbenchTaskRecord | null {
  jobs = jobs.filter((j) => ownerUserId === undefined || j.ownerUserId === ownerUserId)
  const hasRunning = jobs.some((j) => j.status === 'running' && j.kind !== 'digital_human_retalk')
  if (hasRunning) return null
  const queued = jobs
    .filter((j) => j.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt)
  return queued[0] ?? null
}

export function countActiveTasks(jobs: WorkbenchTaskRecord[], ownerUserId?: number): number {
  return jobs.filter(
    (j) =>
      (j.status === 'queued' || j.status === 'running') &&
      (ownerUserId === undefined || j.ownerUserId === ownerUserId),
  ).length
}

export type PruneInput = {
  jobs: WorkbenchTaskRecord[]
  blobBytes: Map<string, number>
  ownerUserId: number
  now: number
}

export type PruneResult = {
  deleteJobIds: string[]
  deleteBlobIds: string[]
  deletePayloadIds: string[]
}

export function planPruneForUser(input: PruneInput): PruneResult {
  const { jobs, blobBytes, ownerUserId, now } = input
  const mine = jobs.filter((j) => j.ownerUserId === ownerUserId)
  const deleteJobIds = new Set<string>()
  const deleteBlobIds = new Set<string>()
  const deletePayloadIds = new Set<string>()

  const failed = mine
    .filter((j) => j.status === 'failed')
    .sort((a, b) => b.createdAt - a.createdAt)
  for (const j of failed.slice(TASK_LIMITS.maxFailedPerUser)) {
    deleteJobIds.add(j.id)
  }
  for (const j of failed) {
    if (now - j.createdAt > TASK_LIMITS.failedMaxAgeMs) deleteJobIds.add(j.id)
  }

  const succeeded = mine
    .filter((j) => j.status === 'succeeded')
    .sort((a, b) => b.createdAt - a.createdAt)

  let totalBytes = succeeded.reduce((sum, j) => {
    if (!j.blobId) return sum
    return sum + (blobBytes.get(j.blobId) ?? j.audioByteLength ?? 0)
  }, 0)

  const keepSucceeded = [...succeeded]
  while (
    keepSucceeded.length > TASK_LIMITS.maxSucceededPerUser ||
    totalBytes > TASK_LIMITS.maxBlobBytesPerUser
  ) {
    const drop = keepSucceeded.pop()
    if (!drop) break
    deleteJobIds.add(drop.id)
    if (drop.blobId) {
      deleteBlobIds.add(drop.blobId)
      totalBytes -= blobBytes.get(drop.blobId) ?? drop.audioByteLength ?? 0
    }
  }

  for (const id of deleteJobIds) {
    const job = mine.find((j) => j.id === id)
    if (job?.blobId) deleteBlobIds.add(job.blobId)
    if (job?.payloadId) deletePayloadIds.add(job.payloadId)
  }

  return {
    deleteJobIds: [...deleteJobIds],
    deleteBlobIds: [...deleteBlobIds],
    deletePayloadIds: [...deletePayloadIds],
  }
}

export function newTaskId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
