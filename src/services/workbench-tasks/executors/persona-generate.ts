import { getPersona, nowIso, summarizeFromContent, upsertPersona } from '../../persona'
import { EMPTY_QUESTIONNAIRE } from '../../persona/types'
import { normalizeQuestionnaire } from '../../persona/questionnaire'
import { createAgentClients } from '../../../agent'
import type { AgentRunSnapshot } from '../../../agent'
import { createTaskSink } from '../../../agent/sink'
import { PERSONA_FLOW_ID, runPersonaFlow } from '../../../features/persona/agent/persona-flow'
import { createPersonaMockResponder } from '../../../features/persona/agent/demo-responder'
import type { WorkbenchTaskRepository } from '../repository'
import type { PersonaGeneratePayload, WorkbenchTaskRecord } from '../types'

export async function executePersonaGenerate(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as PersonaGeneratePayload | undefined
  if (!payload) throw new Error('人设任务数据丢失')

  const formData = normalizeQuestionnaire(payload.formData)
  const clients = createAgentClients({
    mockResponder: createPersonaMockResponder('user'),
  })

  let currentPayload = payload
  const sink = createTaskSink({
    patchMeta: async (meta) => {
      await repo.patchJob(job.id, { meta: { ...job.meta, ...meta } })
    },
    patchSnapshot: async (snapshot: AgentRunSnapshot) => {
      currentPayload = { ...currentPayload, run: snapshot }
      await repo.patchPayload(job.payloadId, currentPayload)
    },
  })

  const result = await runPersonaFlow({
    kind: 'user',
    formData,
    instruction: payload.instruction,
    currentProfile: payload.currentProfile,
    chatAttachments: payload.chatAttachments,
    clients,
    sink,
    signal,
  })

  const candidatesMarkdown = result.markdown
  const existing =
    (await getPersona(payload.personaId)) ??
    {
      id: payload.personaId,
      kind: 'user' as const,
      name: payload.personaName?.trim() || '默认分身',
      summary: '',
      content: '',
      formData: { ...EMPTY_QUESTIONNAIRE, ...formData },
      isActive: false,
      updatedAt: nowIso(),
    }

  if (signal?.aborted || (await repo.getJob(job.id))?.status === 'cancelled') throw new DOMException('Aborted', 'AbortError')
  await upsertPersona({
    ...existing,
    formData,
    candidatesMarkdown,
    summary: existing.content.trim()
      ? existing.summary
      : summarizeFromContent(candidatesMarkdown, existing.name),
  })

  currentPayload = {
    ...currentPayload,
    formData,
    resultMarkdown: candidatesMarkdown,
    usedMock: result.usedMock,
  }
  await repo.patchPayload(job.payloadId, currentPayload)
  await repo.patchJob(job.id, {
    status: 'succeeded',
    finishedAt: Date.now(),
    meta: { ...job.meta, personaId: payload.personaId, status: 'done', pct: '100' },
  })
}

export { PERSONA_FLOW_ID }
