import type { MockResponder } from '../../../agent'
import {
  VOICE_ADVANCED_PLANNER_CHUNK_MAX,
} from '../voice-constants'
import { packDocumentIntoPlannerChunks } from './document-chunking'
import type { VoiceDubSegment } from './types'

export const DEMO_SAMPLE_SEGMENTS: VoiceDubSegment[] = [
  {
    id: 'seg_1',
    title: '开场',
    text: '大家好，今天给你们带来一款真正能省时间的新工具。',
    instruction: '热情洋溢，语速稍快，像发布会开场，带一点微笑',
    role: 'narrator',
    estimatedSeconds: 6,
  },
  {
    id: 'seg_2',
    title: '痛点',
    text: '剪视频、写脚本、配声音，每一步都要来回切换，一天下来什么都没做完。',
    instruction: '略带无奈和共鸣，语速放慢，句尾轻微下沉',
    role: 'narrator',
    estimatedSeconds: 8,
  },
  {
    id: 'seg_3',
    title: '卖点一',
    text: '有了它，一篇文案自动拆成多段，每一段都有合适的语气。',
    instruction: '自信清晰，重点词略微加重，节奏明快',
    role: 'narrator',
    estimatedSeconds: 7,
  },
  {
    id: 'seg_4',
    title: '卖点二',
    text: '声音还能用你自己的克隆音色，听起来就像你亲口讲的一样。',
    instruction: '亲切温暖，像朋友推荐，语调上扬',
    role: 'narrator',
    estimatedSeconds: 7,
  },
  {
    id: 'seg_5',
    title: '福利',
    text: '现在注册，前一百位用户立减五折，名额有限。',
    instruction: '兴奋有紧迫感，语速加快，强调「五折」和「限量」',
    role: 'narrator',
    estimatedSeconds: 5,
  },
  {
    id: 'seg_6',
    title: '收尾',
    text: '点击下方链接，马上体验，让声音替你工作。',
    instruction: '沉稳有力，号召行动，结尾干脆收住',
    role: 'narrator',
    estimatedSeconds: 5,
  },
]

function segmentsForChunkText(chunkText: string): VoiceDubSegment[] {
  const paras = chunkText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const rawList =
    paras.length >= 2 ? paras : chunkText.split(/(?<=[。！？!?])\s*/).filter(Boolean)
  const titles = ['引子开场', '背景痛点', '核心亮点', '深度剖析', '价值说明', '号召行动']
  const instructions = [
    '热情开朗，吸引注意，语气轻快',
    '共情真诚，节奏沉稳，句尾自然收住',
    '清晰自信，重点突出，声调明快',
    '亲切温和，循循善诱，娓娓道来',
    '坚定有力，带激励感与信任感',
    '果断收尾，号召有力，富有穿透力',
  ]

  return rawList.slice(0, 12).map((text, idx) => ({
    id: `seg_${idx + 1}`,
    title: titles[idx % titles.length],
    text,
    instruction: instructions[idx % instructions.length],
    role: 'narrator',
    estimatedSeconds: Math.max(3, Math.round(text.length / 3.5)),
  }))
}

export function createVoiceDubMockResponder(context?: {
  documentText?: string
  globalVoiceLabel?: string
}): MockResponder {
  let plannerCall = 0

  return async () => {
    const doc = context?.documentText?.trim()
    if (!doc || doc.includes('真正能省时间的新工具')) {
      return JSON.stringify({
        title: '产品发布口播',
        segments: DEMO_SAMPLE_SEGMENTS,
      })
    }

    const chunks =
      doc.length > VOICE_ADVANCED_PLANNER_CHUNK_MAX
        ? packDocumentIntoPlannerChunks(doc, VOICE_ADVANCED_PLANNER_CHUNK_MAX)
        : [doc]
    const chunkIndex = Math.min(plannerCall, chunks.length - 1)
    plannerCall += 1
    const chunkText = chunks[chunkIndex] ?? doc
    const segments = segmentsForChunkText(chunkText)

    return JSON.stringify({
      title: doc.slice(0, 14) + (doc.length > 14 ? '…' : ''),
      segments,
    })
  }
}
