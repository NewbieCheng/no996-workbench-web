/**
 * 爆款标题 · 演示应答器
 *
 * 演示模式产出的结构与正式模式完全一致（同一条解析路径），
 * 但绝不伪造「检索到了 X 条真实资料」—— evidence 一律标注为演示数据。
 *
 * 业务上下文由调用方显式传入（与 script-lab 的 createScriptMockResponder 同模式）。
 * 这里刻意不做「从提示词里正则抠主题」的兜底：提示词只要改一句话，
 * 兜底就会静默退化成「当前主题」这种占位符，且没有任何报错信号。
 */
import type { MockResponder } from '../../../agent'
import type { TargetPlatform } from './types'

export type TitlesDemoContext = {
  /** 必填：演示标题直接使用这些字面量，缺了就退化成假数据 */
  topic: string
  audience: string
  platform: TargetPlatform
}

/** 演示用的确定性标题骨架：不含任何数字，避免编造数据 */
function patterns(topic: string, audience: string): Array<{ formulaId: string; title: string }> {
  return [
    { formulaId: '#A07', title: `${topic}实用指南：先把这几条理清` },
    { formulaId: '#B12', title: `大多数人做${topic}都忽视了这一步` },
    { formulaId: '#C03', title: `写给${audience}的${topic}参考建议` },
    { formulaId: '#D15', title: `别再盲目做${topic}了，多数人想反了` },
    { formulaId: '#E09', title: `为什么你的${topic}总是没起色？` },
    { formulaId: '#F21', title: `${topic}落地清单：照抄就行，建议留存` },
  ]
}

/** 第 1 轮的必改项下标：演示模式要真的走到「硬校验/评审 → 定向改写」这一段 */
const ROUND1_MUST_FIX = 0

/**
 * 编辑后的改写结果：是替换，不是拼接后缀。
 * 追加「（演示第 N 轮改写）」这类尾巴会顶破平台字数上限，
 * 让演示结果看上去像被截断的坏数据。
 */
function editTitle(index: number, topic: string, audience: string): string {
  if (index !== ROUND1_MUST_FIX) return patterns(topic, audience)[index]?.title ?? topic
  return `${topic}怎么做才对：给${audience}的参考`
}

export function createTitlesMockResponder(context: TitlesDemoContext): MockResponder {
  let reviewedRounds = 0
  const topic = context.topic.trim() || '未命名主题'
  const audience = context.audience.trim() || '目标读者'
  const platform = context.platform

  return (request) => {
    const stage = request.stageHint

    if (stage === 'understander') {
      return {
        主题: topic,
        读者: audience,
        痛点: `${topic}缺少可执行的方法与判断标准`,
        目标: '点击',
        平台: platform,
        语气强度: 50,
        假设: '演示模式：以上为演示拆解结果，未调用正式模型。',
      }
    }

    if (stage === 'writer') {
      return { titles: patterns(topic, audience) }
    }

    if (stage === 'reviewer') {
      reviewedRounds += 1
      const round = reviewedRounds
      return {
        reviews: patterns(topic, audience).map((_p, i) => {
          const mustFix = round === 1 && i === ROUND1_MUST_FIX
          return {
            id: i + 1,
            // ctr 为预估点击率百分比（一位小数），对齐评审提示词口径
            ctr: [6.8, 8.2, 5.6, 7.3, 6.5, 5.4][i] ?? 6.5,
            credibility: [78, 62, 82, 66, 74, 84][i] ?? 75,
            issue: mustFix
              ? '演示模式：结尾缺少明确的下一步动作，观众看完不知道要做什么。'
              : '演示模式：未做真实评审，此为该句式的典型问题（结尾行动感偏弱）。',
            improvement: mustFix
              ? '演示模式：在结尾加一句具体、可执行的引导。'
              : '演示模式：可把结尾换成更具体的自查或收藏引导。',
            mustFix,
          }
        }),
      }
    }

    if (stage === 'editor') {
      return {
        titles: patterns(topic, audience).map((_p, i) => ({
          id: i + 1,
          title: editTitle(i, topic, audience),
        })),
      }
    }

    return null
  }
}

/** 演示检索：明确标注为演示，不作为事实来源 */
export function mockSearchFor(query: string): Array<{ title: string; snippet: string }> {
  return [
    {
      title: `${query} · 演示检索结果`,
      snippet: '演示模式不进行真实联网检索，此内容仅用于流程演示，不可作为事实依据。',
    },
  ]
}
