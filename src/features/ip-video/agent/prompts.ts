import { CONTENT_SHOT_DEFINITIONS } from '@no996/video-editor/demos/content-variants.tsx'
import { TALK_CAPTION_PRESETS, talkSettings } from '../composition/talk-model'

export const TALK_SCRIPT_SYSTEM = `你是口播编剧。只返回 JSON {"source":"verbatim"或"generated","script":"完整口播正文"}。
auto：只有输入全文已经是可直接朗读的完整口播、没有创作要求/格式说明/编辑指令时，才允许 source=verbatim，并逐字返回输入全文。不能因输入较长就判为稿件；含要求或只有想法必须 source=generated。
rewrite：source 必须 generated，以 existingScript 为原稿，只按 brief/adjustment 明确要求定向修改，保留无关段落。不要虚构事实、数据、促销或效果承诺。不要输出舞台说明、镜头代码、URL、HTML、CSS、JS、路径或表达式。正文按自然句标点分段。修复时只修改明确命中的风险，不扩写无关部分。`

export const TALK_DIRECTIONS_SYSTEM = `你是口播策划。只返回 JSON {"directions":[{"title":"方向标题","opening":"可朗读的开场","reason":"适合的原因"}]}。提供2至3个不同方向，不生成完整稿件，不编造事实、数据或效果，不输出代码、网址或标记。`

export function talkDirectorSystem(): string {
  return `你是口播导演。仅选择静态能力，不生成代码、坐标、时长、网址、文件路径、CSS、HTML、表达式或工程标识。只返回 JSON，字段严格为：
{"version":1,"title":"标题","script":"逐字复制给定最终稿，不允许改字","summary":"简明说明","captionPresetId":"静态预设id","ratio":"9:16|16:9|1:1|3:4","composition":"full|side|top|pip","motion":"calm|normal|lively","shots":[{"shotId":"静态内容镜头id","text":"18字内单行短标题","subline":"36字内单行副标题","cueIndex":0}]}。
最多12个镜头，允许无镜头。最终稿为空字符串表示原声尚无文稿，只安排画幅、构图和字幕外观，script必须为空且shots必须为空，不推测原声内容、不声称文稿与音频已同步。cueIndex为提供的字幕句索引，从0开始严格递增。镜头用于少量重点，避免每句都插；只选择有至少0.6秒空间的句子，不占用已有手工镜头时间。保留镜头时 shots=[]。局部调整只落实用户明确要求，保持其余选项。
字幕预设：${TALK_CAPTION_PRESETS.map(item => `${item.id}=${item.name}`).join('、')}。
内容镜头：${CONTENT_SHOT_DEFINITIONS.map(item => `${item.shotId}=${item.label}`).join('、')}。
动效calm优先柔焦、划线，normal优先描边或标签，lively可文字纵深或渐变。不得使用原始演示或其他素材。`
}
export function talkInputContext(input: import('./types').TalkCreationInput) {
  const state = talkSettings(input.document)
  const visual = input.document.tracks.flatMap(track => track.elements).find(element => element.type === 'image' || element.type === 'video')
  const box = visual && 'transform' in visual ? visual.transform : undefined
  const w = input.document.canvas.width
  const h = input.document.canvas.height
  const matches = (x: number, y: number, width: number, height: number) => !!box && Math.abs(box.x / w - x) < .01 && Math.abs(box.y / h - y) < .01 && Math.abs(box.width / w - width) < .01 && Math.abs(box.height / h - height) < .01
  const composition = !box || matches(0, 0, 1, 1) ? 'full' : matches(0, 0, .48, 1) ? 'side' : matches(0, 0, 1, .62) ? 'top' : matches(.66, .06, .28, .28) ? 'pip' : 'custom'
  return {
    brief: input.brief, intent: input.intent, scriptMode: input.scriptMode,
    existingScript: state.script, adjustment: input.adjustment, ratio: input.ratio, captionPresetId: input.captionPresetId,
    motion: input.motion, preserve: input.preserve,
    current: {
      captionPresetId: state.captionPresetId, ratio: input.document.canvas.ratio, composition,
      photoMotion: state.photoMotion, motion: input.document.captionStyle.motion === 0 ? 'calm' : (input.document.captionStyle.motion ?? .45) >= .7 ? 'lively' : 'normal',
      audioScriptMatches: state.audioScript === undefined ? null : state.audioScript === state.script,
      shots: input.document.tracks.flatMap(track => track.elements.filter(element => element.type === 'shot').map(element => ({
        shotId: element.type === 'shot' ? element.shotId : '', presentation: element.type === 'shot' ? element.presentation : undefined,
        startUs: element.startUs, durationUs: element.durationUs, aiGenerated: element.id.startsWith('ip-director-shot-'),
        text: element.type === 'shot' ? element.overrides?.text : undefined, subline: element.type === 'shot' ? element.overrides?.subline : undefined,
        locked: track.locked,
      }))),
    },
  }
}
