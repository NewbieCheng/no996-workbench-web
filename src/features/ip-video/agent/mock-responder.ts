import type { MockResponder } from '../../../agent/mock-clients'
import { estimateCues, talkSettings } from '../composition/talk-model'
import { resolveLockedTalkScript, resolveTalkProgramDuration } from './schema'
import { talkInputContext } from './prompts'
import type { TalkCreationInput, TalkDirectorPlan } from './types'

/** Explicit demo only. No prompt scraping and no real-mode fallback. */
export function createTalkCreationMockResponder(input: TalkCreationInput): MockResponder {
  let script = input.intent === 'directions' ? '' : resolveLockedTalkScript(input) ?? ''
  const topic = (input.brief.trim() || input.personaContent?.trim() || talkSettings(input.document).script).split(/[\r\n]/u)[0] || '口播创作'
  const short = Array.from(topic).slice(0, 12).join('')
  return (_request, { stageHint }) => {
    if (stageHint === 'talk-directions') return { directions: [
      { title: `经验分享：${short}`, opening: `关于${short}，我想从自己的观察说起。`, reason: '演示方向：从具体情境进入，再整理实践中的体会。' },
      { title: `问题拆解：${short}`, opening: `聊到${short}，我们先把眼前的问题说清楚。`, reason: '演示方向：先提出问题，再依次解释可尝试的做法。' },
    ] }
    if (stageHint === 'talk-script' || stageHint === 'talk-repair') {
      script = `关于${short}，我们先从身边的具体情境说起。\n把眼前遇到的问题写下来，再挑出可以尝试的小事。\n做完以后回看过程，保留有帮助的做法，再继续调整。`
      return { source: 'generated', script }
    }
    if (stageHint === 'select-components') {
      const durationUs = resolveTalkProgramDuration(input.document, script)
      // A style template can protect captions before the first manuscript exists.
      // Match the real flow: only reuse a protected cue list when it is nonempty.
      const protectedCues = input.document.captions.length > 0 && (input.preserve.captions || input.document.captions.some(cue => cue.timingSource !== 'estimated'))
      const cues = protectedCues ? input.document.captions : script === talkSettings(input.document).script && durationUs === input.document.durationUs && input.document.captions.length ? input.document.captions : estimateCues(script, durationUs)
      const current = talkInputContext(input).current
      const occupied = input.document.tracks.flatMap(track => track.elements.filter(element => element.type === 'shot' && !element.id.startsWith('ip-director-shot-')))
      const cueIndex = cues.findIndex(cue => durationUs - cue.startUs >= 3_000_000 && !occupied.some(element => cue.startUs < element.startUs + element.durationUs && cue.startUs + 3_000_000 > element.startUs))
      const ratio = input.ratio === 'auto' ? input.document.canvas.ratio : input.ratio
      const plan: TalkDirectorPlan = {
        version: 1, title: `口播演示：${short}`, script, summary: script ? '演示编排：保留口播正文，使用静态字幕与重点标题内容镜头。' : '演示画面安排：保留原声，尚无对应文稿，不生成猜测字幕或内容镜头。',
        captionPresetId: input.captionPresetId ?? talkSettings(input.document).captionPresetId ?? 'studio',
        ratio: ratio === '16:9' || ratio === '1:1' || ratio === '3:4' ? ratio : '9:16', composition: current.composition === 'side' ? 'side' : current.composition === 'top' ? 'top' : current.composition === 'pip' ? 'pip' : 'full',
        motion: input.motion === 'auto' ? current.motion === 'calm' ? 'calm' : current.motion === 'lively' ? 'lively' : 'normal' : input.motion,
        shots: !script || input.preserve.shots || cueIndex < 0 ? [] : [{ shotId: 'typography/marker-underline-title', text: short, subline: '从具体情境开始，逐步整理表达', cueIndex }],
      }
      return plan
    }
    throw new Error(`未实现的口播演示阶段：${stageHint ?? '未知'}。`)
  }
}
