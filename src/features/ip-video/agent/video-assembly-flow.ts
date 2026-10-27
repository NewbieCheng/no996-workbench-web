import { createStageRunner, createDisplayDelta, defineFlow, isAbortError, runHardCheck, withCommonRules, type AgentStageDef } from '../../../agent'
import { compileTalkDirectorPlan } from '../composition/talk-director-compiler'
import { estimateCues, talkSettings } from '../composition/talk-model'
import { hasTalkOriginalSound, parseTalkDirections, plainText, record, resolveLockedTalkScript, resolveTalkProgramDuration, validateTalkDirectorPlan } from './schema'
import { TALK_DIRECTIONS_SYSTEM, TALK_SCRIPT_SYSTEM, talkDirectorSystem, talkInputContext } from './prompts'
import type { RunTalkCreationOptions, TalkCreationResult } from './types'
export type { TalkCreationInput, TalkCreationResult, TalkDirection, TalkDirectorPlan, TalkDirectorShot, TalkDirectorMetadata } from './types'
export { createTalkCreationMockResponder } from './mock-responder'

// Keep the registered id and entry import compatible with features/agent-flows.ts.
export const IP_VIDEO_ASSEMBLY_FLOW_ID = 'ip-video-assembly-v1'
export const IP_VIDEO_ASSEMBLY_STAGES: AgentStageDef[] = [
  { id: 'parse-manuscript', order: 1, roleName: '输入检查', roleTag: '本机', kind: 'algo', principle: '确认文稿来源与原声保护，不凭输入长度认定完整稿。', headline: '正在确认已有文稿与保留选项…' },
  { id: 'talk-directions', order: 2, roleName: '方向策划', roleTag: 'AI', kind: 'model', profile: 'plan', principle: '按想法提供不同口播方向与开场。', headline: '正在整理可选方向…' },
  { id: 'talk-script', order: 3, roleName: '文稿整理', roleTag: 'AI', kind: 'model', profile: 'draft', principle: '仅在缺少完整稿时补稿，已有原声和逐字稿保持原文。', headline: '正在整理口播正文…' },
  { id: 'talk-hard-check', order: 4, roleName: '文稿检查', roleTag: '本机', kind: 'algo', principle: '复用统一硬规则检查文字风险，不编造评分。', headline: '正在检查文稿风险…' },
  { id: 'talk-repair', order: 5, roleName: '定向修订', roleTag: 'AI', kind: 'model', profile: 'draft', principle: '只修复生成稿中明确命中的问题，已有文稿不自动改写。', headline: '正在修订已发现的问题…' },
  { id: 'select-components', order: 6, roleName: '口播导演', roleTag: 'AI', kind: 'model', profile: 'plan', principle: '从静态字幕、构图与内容镜头中组合受限纯数据计划。', headline: '正在编排画面与重点镜头…' },
  { id: 'compile-assembly-plan', order: 7, roleName: '计划检查', roleTag: '本机', kind: 'algo', principle: '在副本校验字幕定位、时间与保留边界，工程提交由用户确认。', headline: '正在检查计划可应用性…' },
]
defineFlow(IP_VIDEO_ASSEMBLY_FLOW_ID, IP_VIDEO_ASSEMBLY_STAGES)
const json = (raw: string): unknown => JSON.parse(raw)

export async function runTalkCreationFlow({ input, clients, sink, signal, onDelta }: RunTalkCreationOptions): Promise<TalkCreationResult> {
  const runner = createStageRunner({ flowId: IP_VIDEO_ASSEMBLY_FLOW_ID, stages: IP_VIDEO_ASSEMBLY_STAGES, clients, sink, signal, background: input.personaContent?.trim() || undefined })
  let stage = 'parse-manuscript'
  try {
    const locked = await runner.runAlgo(stage, () => {
      const script = talkSettings(input.document).script.trim()
      if (input.intent === 'directions' && !input.brief.trim() && !script) throw new Error('请先输入创作想法或完整文稿。')
      if (input.intent !== 'directions' && input.intent !== 'adjust' && !input.brief.trim() && !script && !hasTalkOriginalSound(input)) throw new Error('请先输入创作想法或完整文稿。')
      if (input.brief.trim()) plainText(input.brief, '创作输入', 12000, true)
      if (input.adjustment?.trim()) plainText(input.adjustment, '调整要求', 2000, true)
      return input.intent === 'directions' ? undefined : resolveLockedTalkScript(input)
    })
    const context = talkInputContext(input)
    const sources = `${input.brief}\n${talkSettings(input.document).script}\n${locked ?? ''}\n${input.adjustment ?? ''}\n${input.personaContent ?? ''}`
    if (input.intent === 'directions') {
      stage = 'talk-directions'
      const directions = await runner.runModel(stage, {
        system: withCommonRules(TALK_DIRECTIONS_SYSTEM), user: JSON.stringify(context), retry: 0, responseFormat: { type: 'json_object' },
        onDelta: createDisplayDelta(onDelta, ['title', 'opening', 'reason'], '\n'),
        parse: raw => parseTalkDirections(json(raw)),
      })
      stage = 'talk-hard-check'
      await runner.runAlgo(stage, () => {
        const check = runHardCheck({ text: directions.map(item => `${item.title}\n${item.opening}\n${item.reason}`).join('\n'), mode: 'video', allowedNumberSources: sources })
        if (!check.pass) throw new Error(`方向未通过检查：${check.hits.map(hit => hit.label).join('、')}`)
        return check
      })
      await runner.finish()
      return { kind: 'directions', directions, run: runner.snapshot(), usedMock: clients.isMock }
    }
    let script = locked
    let generated = false
    const parseScript = (raw: string) => {
      const row = record(json(raw), ['source', 'script'], '文稿结果')
      if (row.source !== 'generated' && row.source !== 'verbatim') throw new Error('文稿来源无效。')
      const text = plainText(row.script, '口播正文', 12000, true)
      if (row.source === 'verbatim' && (input.scriptMode !== 'auto' || text !== input.brief)) throw new Error('逐字识别必须完整保留输入原文。')
      return { script: text, generated: row.source === 'generated' }
    }
    if (script === undefined) {
      stage = 'talk-script'
      const written = await runner.runModel(stage, {
        system: withCommonRules(TALK_SCRIPT_SYSTEM), user: JSON.stringify(context), retry: 0, responseFormat: { type: 'json_object' },
        onDelta: createDisplayDelta(onDelta, ['script'], '\n'), parse: parseScript,
      })
      script = written.script
      generated = written.generated
    }
    stage = 'talk-hard-check'
    let check = await runner.runAlgo(stage, () => runHardCheck({ text: script!, mode: 'video', allowedNumberSources: sources }))
    // At most one targeted rewrite: initial draft + repair + directing = at most three requests.
    if (!check.pass && generated) {
      stage = 'talk-repair'
      const repaired = await runner.runModel(stage, {
        system: withCommonRules(TALK_SCRIPT_SYSTEM), user: JSON.stringify({ ...context, scriptMode: 'rewrite', script, mustFix: check.hits }), retry: 0, responseFormat: { type: 'json_object' }, round: 2,
        onDelta: createDisplayDelta(onDelta, ['script'], '\n'),
        parse: raw => {
          const parsed = parseScript(raw)
          if (!parsed.generated) throw new Error('修订阶段必须标记为生成稿。')
          return parsed.script
        },
      })
      script = repaired
      stage = 'talk-hard-check'
      check = await runner.runAlgo(stage, () => runHardCheck({ text: repaired, mode: 'video', allowedNumberSources: sources }))
    }
    if (!check.pass) throw new Error(`文稿未通过检查，请确认后重试：${check.hits.map(hit => hit.label).join('、')}`)
    const finalScript = script!
    // The director receives caption indices, never document IDs/revisions or media URLs.
    const durationUs = resolveTalkProgramDuration(input.document, finalScript)
    const cues = input.document.captions.length > 0 && (input.preserve.captions || input.document.captions.some(cue => cue.timingSource !== 'estimated'))
      ? input.document.captions
      : (finalScript === talkSettings(input.document).script && input.document.captions.length && durationUs === input.document.durationUs ? input.document.captions : estimateCues(finalScript, durationUs))
    stage = 'select-components'
    const plan = await runner.runModel(stage, {
      system: withCommonRules(talkDirectorSystem()), retry: 0, responseFormat: { type: 'json_object' },
      user: JSON.stringify({ ...context, script: finalScript, cues: cues.map((cue, cueIndex) => ({ cueIndex, text: cue.text, startUs: cue.startUs, durationUs: cue.durationUs })), occupied: input.document.tracks.flatMap(track => track.elements.filter(element => element.type === 'shot' && !element.id.startsWith('ip-director-shot-')).map(element => ({ startUs: element.startUs, durationUs: element.durationUs }))) }),
      onDelta: createDisplayDelta(onDelta, ['title', 'summary', 'text', 'subline'], '\n'),
      parse: raw => {
        const result = validateTalkDirectorPlan(json(raw))
        if (result.script !== finalScript) throw new Error('导演计划改写了最终文稿。')
        return result
      },
    })
    stage = 'compile-assembly-plan'
    await runner.runAlgo(stage, () => {
      const display = [plan.title, plan.summary, ...plan.shots.flatMap(shot => [shot.text, shot.subline])].join('\n')
      const check = runHardCheck({ text: display, mode: 'video', allowedNumberSources: sources })
      if (!check.pass) throw new Error(`画面文案未通过检查：${check.hits.map(hit => hit.label).join('、')}`)
      const compiled = compileTalkDirectorPlan(input.document, plan, input, 'talk-plan-preflight')
      return { summary: plan.summary, shotCount: plan.shots.length, captionCount: compiled.captions.length }
    })
    await runner.finish()
    return { kind: 'composition', plan, run: runner.snapshot(), usedMock: clients.isMock }
  } catch (error) {
    await runner.failStage(stage, error)
    await runner.finish(isAbortError(error) ? 'cancelled' : 'failed')
    throw error
  }
}
