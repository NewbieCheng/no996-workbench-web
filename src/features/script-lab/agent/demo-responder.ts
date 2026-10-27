/**
 * 演示模式的确定性应答器（脚本引擎）。
 *
 * 演示模式不调用正式模型，但必须让整条编排流程真实跑完，
 * 因此这里按阶段返回符合 schema 的样例，并由 UI 统一标注「演示」。
 */
import type { MockResponder } from '../../../agent'

const VIDEO_STRUCTURE = [
  { name: '痛点场景', purpose: '用具体场景建立观看理由', share: 0.2 },
  { name: '身份共情', purpose: '建立信任', share: 0.22 },
  { name: '干货价值', purpose: '给出可执行步骤', share: 0.38 },
  { name: '营销钩子', purpose: '与目标一致的轻量行动', share: 0.2 },
]

const LIVE_STRUCTURE = [
  { name: '开场暖场', purpose: '留住划过人群，说明本场对象与主题', share: 0.1 },
  { name: '产品介绍', purpose: '讲透价值、事实与证据', share: 0.25 },
  { name: '痛点共鸣', purpose: '用真实场景深挖痛点与决策障碍', share: 0.2 },
  { name: '促单环节', purpose: '解释真实条件并给出清楚行动', share: 0.3 },
  { name: '复盘收尾', purpose: '总结优势并引导关注与下场预告', share: 0.15 },
]

type DemoContext = { product: string; mode: 'video' | 'live' }

function demoSpoken(index: number, ctx: DemoContext): string {
  const { product, mode } = ctx
  if (mode === 'video') {
    const lines = [
      `如果你也遇到过，先别急着换方法。今天用一分钟说清${product}，重点不是多买，而是先找出每天重复的小麻烦。`,
      `我以前也踩过同样的坑，后来发现真正的问题不在工具，而在流程。我把过程拆成三个能马上照做的动作，你边看边对照自己的情况，不用一次全改。`,
      `第一步，先记录一周你实际遇到的场景；第二步，把重复出现的问题挑出来；第三步，只针对最高频的那一个做调整。做完以后停一天再看，哪个步骤最影响结果，就把下一步只放在那里。`,
      `这套思路我整理成了一份清单，需要的朋友可以在评论里说一声，我看到后回复你，也可以先收藏备用。`,
    ]
    return lines[index] ?? lines[lines.length - 1]
  }
  const lines = [
    `欢迎刚进来的朋友，先点个关注，今天这场主要聊${product}，后面会留时间回答大家的问题。`,
    `先说清${product}适合什么场景、不适合什么场景，大家对照自己的情况判断。`,
    `很多朋友问我，为什么按步骤做了还是没效果。通常不是步骤错了，而是漏了复盘这一步。`,
    `需要了解细节的朋友，可以在评论区扣个1，我会按顺序说明适合你的做法。`,
    `今天就聊到这里，重点已经帮大家总结好了，有问题随时留言。`,
  ]
  return lines[index] ?? lines[lines.length - 1]
}

function buildSegments(ctx: DemoContext, count: number, withRound: number) {
  const structure = ctx.mode === 'video' ? VIDEO_STRUCTURE : LIVE_STRUCTURE
  return structure.slice(0, count).map((seg, i) => {
    const spoken = demoSpoken(i, ctx)
    const item: Record<string, unknown> = {
      id: `seg-${i + 1}`,
      name: seg.name,
      purpose: seg.purpose,
      share: seg.share,
      spoken: withRound > 1 ? `${spoken}（第 ${withRound} 轮优化版）` : spoken,
      note: withRound > 1 ? '调整了开场与承接方式' : undefined,
    }
    if (ctx.mode === 'video') {
      item.visual = i === 0 ? '正面近景，字幕展示关键词' : '切换到操作或清单画面'
    } else {
      item.action = i === 0 ? '口播 + 引导关注' : '口播 + 评论区互动'
      item.nodes =
        i === 3
          ? [{ type: '福利', action: '说明福利内容，请观众扣1' }]
          : [{ type: '互动', action: '读评论并回应一个问题' }]
    }
    return item
  })
}

function buildReview(ctx: DemoContext, count: number, round: number) {
  const base = ctx.mode === 'video' ? [78, 71, 64, 58] : [86, 79, 72, 66, 61]
  return {
    items: Array.from({ length: count }, (_, i) => ({
      segmentId: `seg-${i + 1}`,
      retention: Math.min(100, (base[i] ?? 55) + (round - 1) * 4),
      primaryIssue: round === 1 && i === 0 ? '开场信息密度偏高' : '承接略平，可再加一句钩子',
      improvementDirection: round === 1 && i === 0 ? '把结论提到第一句' : '补一个具体场景',
      mustFix: round === 1 ? i === 0 : false,
    })),
    hookStrength: 68 + (round - 1) * 4,
    conversion: 62 + (round - 1) * 5,
  }
}

export function createScriptMockResponder(config: { product: string; mode: 'video' | 'live'; segmentCount?: number }): MockResponder {
  const ctx: DemoContext = { product: config.product.trim() || '示例产品', mode: config.mode }
  const segmentCount = config.segmentCount ?? (ctx.mode === 'video' ? 4 : 5)
  // 评审轮次计数与本次生成绑定（闭包内），避免多次生成互相干扰
  let reviewerRound = 0

  return (request) => {
    switch (request.stageHint) {
      case 'autofill':
        return {
          audience: '刚接手内容工作的小团队负责人',
          sellingPoints: '流程清晰、上手快、不依赖复杂工具',
          pain: '内容产出不稳定，每次都从头开始',
          assumptions: '演示模式按常见场景推断，请按实际情况修改。',
        }
      case 'planner':
        return {
          goal: ctx.mode === 'video' ? '获客' : '成交',
          audience: '刚接手内容工作的小团队负责人',
          pain: '内容产出不稳定，每次都从头开始',
          sellingPoints: '流程清晰、上手快、不依赖复杂工具',
          product: ctx.product,
          assumption: '演示内容，未调用正式模型。',
        }
      case 'structurer':
        return {
          formulaId: ctx.mode === 'video' ? 'video-acquisition' : 'live-five-chapter',
          formulaName: ctx.mode === 'video' ? '痛点场景 + 身份共情 + 干货解法 + 行动引导' : '固定五章',
          segments: (ctx.mode === 'video' ? VIDEO_STRUCTURE : LIVE_STRUCTURE).map((s) => ({ ...s })),
        }
      case 'writer':
        return { segments: buildSegments(ctx, segmentCount, 1) }
      case 'reviewer': {
        reviewerRound += 1
        return buildReview(ctx, segmentCount, reviewerRound)
      }
      case 'editor':
        return { segments: buildSegments(ctx, segmentCount, reviewerRound + 1) }
      case 'alternate':
        return {
          spoken: `${demoSpoken(0, ctx)}（换个角度：先说结果，再说过程。）`,
          visual: ctx.mode === 'video' ? '特写 + 字幕强调结果' : undefined,
          action: ctx.mode === 'live' ? '口播 + 引导评论' : undefined,
        }
      default:
        return {}
    }
  }
}
