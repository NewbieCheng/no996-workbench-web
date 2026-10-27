import type { MockResponder } from '../../../agent'
import { weekRange } from '../service/week-range'
import type { MomentsCopyInput, MomentsPlanInput } from './types'
import { DAILY_DIRECTIONS, THEME_PRODUCT_DIRECTIONS } from './stages'

function fence(payload: unknown): string {
  return `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
}

function expectedCount(input: MomentsPlanInput, dateIndex: number): number {
  if (input.publishSpec.kind === 'daily') return input.publishSpec.perDay[dateIndex] ?? 1
  return Math.floor(input.publishSpec.perWeek / 7) + (dateIndex < input.publishSpec.perWeek % 7 ? 1 : 0)
}

export function createMomentsPlanMockResponder(input: MomentsPlanInput): MockResponder {
  return (request) => {
    if (request.stageHint && request.stageHint !== 'draft') {
      return { 演示: true }
    }
    const range = weekRange(input.planPeriod.startDate)
    const directions = input.planningMode === 'theme' ? THEME_PRODUCT_DIRECTIONS : DAILY_DIRECTIONS
    const days = range.dates.map((date, dateIndex) => {
      const count = expectedCount(input, dateIndex)
      return {
        date,
        items: Array.from({ length: count }, (_, i) => ({
          publishOrder: i + 1,
          contentDirection: directions[i % directions.length],
          topic: `【演示】${input.businessPurpose.slice(0, 12) || '本周'} · ${date} 第${i + 1}条`,
        })),
      }
    })
    return fence({
      status: 'success',
      planningMode: input.planningMode,
      days,
    })
  }
}

export function createMomentsCopyMockResponder(input: MomentsCopyInput): MockResponder {
  return (request) => {
    if (request.stageHint && request.stageHint !== 'versions') {
      return { 演示: true }
    }
    const items = input.rewrite
      ? input.items.filter((item) => item.id === input.rewrite?.scheduleItemId)
      : input.items
    return fence({
      status: 'success',
      day: {
        date: input.date,
        contents: items.map((item) => ({
          scheduleItemId: item.id,
          contentDirection: item.contentDirection,
          topic: item.topic,
          versions: [
            `【演示】${item.topic}：今天先把这件事说清楚，不着急成交。`,
            `【演示】很多人卡在「${item.topic}」这一步，其实只要换个问法。`,
            `【演示】站在经营者这边看「${item.topic}」，你只需要记住一个动作。`,
          ],
          versionMeta: [
            { version: 0, angleTitle: '从现场问题切入', imageSuggestion: '工作现场一角', naturalBridge: '评论区问一句今天卡在哪' },
            { version: 1, angleTitle: '从常见误区切入', imageSuggestion: '对照清单截图', naturalBridge: '把误区对应到自己的场景' },
            { version: 2, angleTitle: '从经营者视角切入', imageSuggestion: '手写便签', naturalBridge: '需要的人私信「资料」' },
          ],
          currentVersion: 0,
        })),
      },
    })
  }
}
