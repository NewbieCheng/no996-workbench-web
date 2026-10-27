import type {
  EnqueueIPVideoAudioInput,
  EnqueueIPVideoCreateInput,
  EnqueueDigitalHumanRetalkInput,
  EnqueuePersonaInput,
  EnqueueProductPositioningInput,
  EnqueueScriptGenerateInput,
  EnqueueSourceCreateInput,
  EnqueueTitlesGenerateInput,
  EnqueueMomentsPlanInput,
  EnqueueMomentsCopyInput,
  EnqueueVoiceCloneInput,
  EnqueueVoiceDubAdvancedInput,
  EnqueueVoiceTtsInput,
  EnqueueVideoFactoryExportInput,
  TaskBlobRecord,
  TaskPayloadRecord,
  WorkbenchTaskRecord,
} from './types'

export type TaskPatch = Partial<
  Pick<
    WorkbenchTaskRecord,
    | 'title'
    | 'status'
    | 'startedAt'
    | 'finishedAt'
    | 'errorMessage'
    | 'blobId'
    | 'audioByteLength'
    | 'meta'
    | 'subtitle'
  >
>

export type WorkbenchTaskRepository = {
  ensureMigrated(): Promise<void>
  putJob(job: WorkbenchTaskRecord): Promise<void>
  patchJob(id: string, patch: TaskPatch): Promise<WorkbenchTaskRecord | null>
  getJob(id: string): Promise<WorkbenchTaskRecord | null>
  listJobsForUser(ownerUserId: number): Promise<WorkbenchTaskRecord[]>
  listAllJobs(): Promise<WorkbenchTaskRecord[]>
  deleteJob(id: string): Promise<void>
  updateTasksTitleByProjectId(ownerUserId: number, projectId: string, title: string): Promise<void>
  putPayload(payload: TaskPayloadRecord): Promise<void>
  getPayload(id: string): Promise<TaskPayloadRecord | null>
  patchPayload(id: string, data: unknown): Promise<void>
  putBlob(blob: TaskBlobRecord): Promise<void>
  getBlob(id: string): Promise<TaskBlobRecord | null>
  pickNextQueued(ownerUserId?: number): Promise<WorkbenchTaskRecord | null>
  resetStaleRunning(maxAgeMs: number, ownerUserId?: number): Promise<number>
  createDigitalHumanRetalkJob(ownerUserId: number, input: EnqueueDigitalHumanRetalkInput): Promise<WorkbenchTaskRecord>
  pruneForUser(ownerUserId: number): Promise<void>
  createIPVideoCreateJob(ownerUserId: number, input: EnqueueIPVideoCreateInput): Promise<WorkbenchTaskRecord>
  createIPVideoAudioJob(ownerUserId: number, input: EnqueueIPVideoAudioInput): Promise<WorkbenchTaskRecord>
  createVoiceTtsJob(ownerUserId: number, input: EnqueueVoiceTtsInput): Promise<WorkbenchTaskRecord>
  createVoiceCloneJob(ownerUserId: number, input: EnqueueVoiceCloneInput): Promise<WorkbenchTaskRecord>
  createVoiceDubAdvancedJob(
    ownerUserId: number,
    input: EnqueueVoiceDubAdvancedInput,
  ): Promise<WorkbenchTaskRecord>
  createPersonaJob(ownerUserId: number, input: EnqueuePersonaInput): Promise<WorkbenchTaskRecord>
  createProductPositioningJob(
    ownerUserId: number,
    input: EnqueueProductPositioningInput,
  ): Promise<WorkbenchTaskRecord>
  createTitlesJob(ownerUserId: number, input: EnqueueTitlesGenerateInput): Promise<WorkbenchTaskRecord>
  createMomentsPlanJob(ownerUserId: number, input: EnqueueMomentsPlanInput): Promise<WorkbenchTaskRecord>
  createMomentsCopyJob(ownerUserId: number, input: EnqueueMomentsCopyInput): Promise<WorkbenchTaskRecord>
  createSourceCreateJob(
    ownerUserId: number,
    input: EnqueueSourceCreateInput,
  ): Promise<WorkbenchTaskRecord>
  createScriptGenerateJob(
    ownerUserId: number,
    input: EnqueueScriptGenerateInput,
  ): Promise<WorkbenchTaskRecord>
  createVideoFactoryExportJob(
    ownerUserId: number,
    input: EnqueueVideoFactoryExportInput,
  ): Promise<WorkbenchTaskRecord>
}
