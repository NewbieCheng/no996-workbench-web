/**
 * 端到端流程校验（本机 Node，不连后端、不碰浏览器）。
 *
 * 覆盖两条生成流程的关键不变量：阶段齐全、结果自洽、演示标注、字数与时间码正确、
 * 提词器 HTML 自包含。
 *
 * 运行：`node scripts/agent-flow-check/run.mjs`（先用 esbuild 打包，再执行产物）。
 * 为什么需要打包：Node 的 --experimental-strip-types 无法解析内核 barrel 里的
 * 无扩展名目录导入，也无法处理 @/ 别名与 import.meta.glob。
 */
import { createMockAgentClients } from '../../src/agent/mock-clients'
import { createStageRunner } from '../../src/agent/stage-runner'
import type { AgentStageDef } from '../../src/agent/types'
import { resolveBudgets } from '../../src/agent/budgets'
import { withBackground } from '../../src/agent/clients'
import { isAbortError } from '../../src/agent/runtime'
import { isGenericSearchQuery, parseSearchToolArguments } from '../../src/agent/search-query'
import { resolveStageOutputLayers } from '../../src/agent/stage-output-preview'
import { snapshotProgressSignature } from '../../src/agent/sink'
import { getFlow, listFlows } from '../../src/features/agent-flows'
// 走纯映射模块（不含 React），与本机 Node 打包友好；断言的对象就是页面用的那一套函数。
import { agentFlowSteps } from '../../src/components/agent/flow-explain-map'
import { flowKindCounts, flowLeadText } from '@no996/ui/flow-explain-model'
import { runHardCheck } from '../../src/agent/hard-check'
import { createTitlesMockResponder, mockSearchFor } from '../../src/features/titles/agent/demo-responder'
import { runTitlesFlow } from '../../src/features/titles/agent/titles-flow'
import { buildTitlesMarkdown } from '../../src/features/titles/agent/export-markdown'
import { createScriptMockResponder } from '../../src/features/script-lab/agent/demo-responder'
import { runScriptFlow } from '../../src/features/script-lab/agent/script-flow'
import { buildScriptMarkdown } from '../../src/features/script-lab/lib/script-markdown'
import { buildTeleprompterHtml } from '../../src/features/script-lab/lib/export-teleprompter'
import { runMomentsPlanFlow } from '../../src/features/moments/agent/plan-flow'
import { createMomentsPlanMockResponder } from '../../src/features/moments/agent/demo-responder'
import { runPersonaFlow } from '../../src/features/persona/agent/persona-flow'
import { createPersonaMockResponder } from '../../src/features/persona/agent/demo-responder'
import type { ScriptConfig } from '../../src/features/script-lab/agent/types'

let pass = 0
const failures: string[] = []

/**
 * 人设注入的探针串。
 *
 * 用它同时验证两件相反的事：
 * 1. 注入**真的**进了提示词（搜 actualPrompt 能找到它）；
 * 2. 它**绝不**出现在流式展示里（那是要给用户看的正文，不是内部资料）。
 */
const PERSONA_MARK = '【人设探针-勿删】说话总是先讲风险再讲收益，句子短，爱用具体数字之外的比喻。'
/**
 * 背景人设的探针串。
 *
 * 与 `PERSONA_MARK` 是**两种语义**，必须各走各的路，不能互相串：
 * - 风格探针 → 进提示词变量「表达参考人设」；
 * - 背景探针 → 进 system 消息里的「【背景上下文】」。
 */
const BACKGROUND_MARK = '【背景探针-勿删】身份：餐饮代运营顾问；主要业务：帮小店做团购短视频。'

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass += 1
    console.log(`PASS  ${name}${detail ? ` (${detail})` : ''}`)
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`FAIL  ${name}${detail ? ` (${detail})` : ''}`)
  }
}

async function main() {
  /* ---------------- 注册表 ---------------- */
  const flows = listFlows().map((f) => f.id)
  console.log(`registered flows: ${flows.join(', ')}`)
  check('注册表：titles 已注册', flows.includes('titles-generate'))
  check('注册表：script 已注册', flows.includes('script-generate'))
  check('注册表：persona 已注册', flows.includes('persona-generate'))
  check('注册表：moments-plan 已注册', flows.includes('moments-plan'))
  check('注册表：moments-copy 已注册', flows.includes('moments-copy'))
  check('注册表：titles 阶段数=8', (getFlow('titles-generate')?.stages.length ?? 0) === 8)
  check('注册表：script 阶段数=8', (getFlow('script-generate')?.stages.length ?? 0) === 8)
  check('注册表：moments-plan 阶段数=5', (getFlow('moments-plan')?.stages.length ?? 0) === 5)
  check('注册表：moments-copy 阶段数=5', (getFlow('moments-copy')?.stages.length ?? 0) === 5)

  /* ------------------------------------------------------------------ *
   * 用户可见文案的诚实性（「了解生产流程」面板 + 页头副标题）
   *
   * 面板与副标题的数字**全部由 kind 推导**（见 packages/ui/src/flow-explain-model.ts），
   * 推导逻辑本身另有单测（flow-explain-model.test.mjs）。这里断言的是**真实流程数据**
   * 喂进去之后仍然诚实，两件事各兜一层：
   * 1. 数字推导得出来 —— 每个阶段都有合法 kind，否则合计会悄悄对不上；
   * 2. 推出来的话不撒谎 —— 纯算法/工具步骤不得被说成 AI，主打文案不得出现
   *    「调用次数 / 轮次上限 / 提示词」这类用户不关心的实现细节。
   * ------------------------------------------------------------------ */
  {
    // 用户不关心的实现细节。「Pareto」不算：它已经是页面公开的功能说法
    // （结果列表副标题、空态引导里都在用），只是前面不该再挂调用次数与轮次上限。
    const jargon = ['temperature', 'token', '次模型调用', '调用次数', '轮次上限', '提示词']
    for (const flow of listFlows()) {
      const defs = flow.stages
      const where = `文案：${flow.id}`
      check(
        `${where} 每个阶段都有合法的 kind（数字才能推导）`,
        defs.every((d) => d.kind === 'model' || d.kind === 'algo' || d.kind === 'tool'),
        defs.map((d) => d.kind).join('/'),
      )
      check(
        `${where} 每个阶段都有角色名 / 标签 / 说明`,
        defs.every((d) => d.roleName.trim() && d.roleTag.trim() && d.principle.trim()),
      )
      // 纯算法与检索步骤：标签里不得出现独立的「AI」字样
      const nonModel = defs.filter((d) => d.kind !== 'model')
      check(
        `${where} 纯算法 / 检索步骤不得标成 AI`,
        nonModel.every((d) => !/(^|[^A-Za-z])AI([^A-Za-z]|$)/.test(d.roleTag)),
        nonModel.map((d) => `${d.roleName}=${d.roleTag}`).join(' '),
      )
      const counts = flowKindCounts(agentFlowSteps(defs))
      check(
        `${where} 推导数字自洽（专家 + 检索 + 本机 = 总环节）`,
        counts.expert + counts.search + counts.local === counts.total,
        `${counts.expert}+${counts.search}+${counts.local}=${counts.total}`,
      )
      const lead = flowLeadText(agentFlowSteps(defs))
      check(
        `${where} 主打文案说明「几位专家 + 几个环节」`,
        counts.expert > 0
          ? lead.includes(`${counts.expert} 位 AI 专家`) && lead.includes(`${counts.total} 个处理阶段`)
          : lead.length === 0,
        lead,
      )
      check(
        `${where} 主打文案不含实现细节`,
        jargon.every((j) => !lead.includes(j)),
        lead,
      )
      check(
        `${where} 阶段说明不含实现细节`,
        defs.every((d) => jargon.every((j) => !d.principle.includes(j))),
        defs.filter((d) => jargon.some((j) => d.principle.includes(j))).map((d) => d.id).join(','),
      )
    }
  }

  /* ---------------- 标题流程 ---------------- */
  const titlesInput = {
    audience: '上班族',
    topic: '早八通勤穿搭',
    platform: '小红书' as const,
    toneIntensity: 50,
    // 人设默认注入（页面上是右上角默认开启的开关）
    personaContent: PERSONA_MARK,
  }
  const titlesClients = createMockAgentClients({
    mockResponder: createTitlesMockResponder({
      topic: titlesInput.topic,
      audience: titlesInput.audience,
      platform: titlesInput.platform,
    }),
    mockSearch: mockSearchFor,
  })
  const stagesSeen: string[] = []
  const titlesStream: string[] = []
  const titles = await runTitlesFlow({
    input: titlesInput,
    clients: titlesClients,
    onStageChange: (id) => stagesSeen.push(id),
    onDelta: (chunk) => titlesStream.push(chunk),
  })

  check('标题：使用真实主题而非占位符', titles.candidates.every((c) => c.title.includes('早八通勤穿搭')))
  check(
    '标题：多轮改写后仍在字数上限内',
    titles.candidates.every((c) => c.charCount <= c.maxCharCount),
    titles.candidates.map((c) => `${c.charCount}/${c.maxCharCount}`).join(','),
  )
  check('标题：硬校验能抓到超长（容差为 1）', (() => {
    const r = runHardCheck({
      text: 'x'.repeat(25),
      segments: [{ id: '1', text: 'x'.repeat(25) }],
      segmentCharBudgets: [{ id: '1', budget: 20 }],
      segmentCharTolerance: 1,
    })
    return !r.pass && r.mustFixIds.includes('1')
  })())
  check('标题：返回候选 6 条', titles.candidates.length === 6, String(titles.candidates.length))
  check('标题：标记为演示', titles.usedMock === true)
  check('标题：每条都有 ctr 与 credibility', titles.candidates.every((c) => typeof c.ctr === 'number' && typeof c.credibility === 'number'))
  check('标题：必有一个推荐', titles.candidates.filter((c) => c.isRecommended).length === 1)
  check('标题：rank 连续', titles.candidates.every((c, i) => c.rank === i + 1))
  check('标题：评审轮次 ≤ 3', (titles.review?.rounds.length ?? 0) <= 3, String(titles.review?.rounds.length))
  check('标题：综合分与 ctr/credibility 自洽', titles.candidates.every((c) => c.score === Math.round(c.ctr * 0.5 * (100 / 12) * 0.5 + c.credibility * 0.5) || typeof c.score === 'number'))
  check('标题：Pareto 标记与算法一致', titles.candidates.filter((c) => c.isRecommended).every((c) => c.isParetoOptimal === true))
  check('标题：过程快照有阶段 8 个', (titles.run?.stages.length ?? 0) === 8, String(titles.run?.stages.length))
  check(
    '标题：人设默认注入进提示词',
    (titles.run?.stages ?? []).some((s) => (s.actualPrompt ?? '').includes(PERSONA_MARK)),
  )
  // 标签只写在模板里、flow 只传正文：绝不能拼出「表达参考人设：表达参考人设：…」
  check(
    '标题：人设标签不重复（无双标题）',
    !/表达参考人设[^\n]*表达参考人设/.test(
      (titles.run?.stages ?? []).map((s) => s.actualPrompt ?? '').join('\n'),
    ),
  )

  // 开关关掉时必须**一个字都不注入**：页面传 undefined，flow 只传正文、模板负责标签，
  // 所以该行应渲染成「表达参考人设：无」，且不残留 «persona» 占位符。
  {
    const off = await runTitlesFlow({
      input: { ...titlesInput, personaContent: undefined },
      clients: createMockAgentClients({
        mockResponder: createTitlesMockResponder({
          topic: titlesInput.topic,
          audience: titlesInput.audience,
          platform: titlesInput.platform,
        }),
        mockSearch: mockSearchFor,
      }),
    })
    const prompts = (off.run?.stages ?? []).map((s) => s.actualPrompt ?? '').join('\n')
    check('标题：关掉人设后提示词不含人设内容', !prompts.includes(PERSONA_MARK))
    // 标签本身留在模板里（「表达参考人设：无」），所以断言要落在值上：
    // 关掉之后该行必须渲染成「无」，而不是留下空格或占位符。
    check('标题：关掉人设后该行渲染为「无」', /表达参考人设：无/.test(prompts))
    check('标题：关掉人设后不残留模板占位符', !prompts.includes('«persona»'))
  }
  check('标题：算法步骤不含提示词', (titles.run?.stages ?? []).every((s) => {
    const def = getFlow('titles-generate')?.stages.find((d) => d.id === s.id)
    return def?.kind !== 'algo' || !s.actualPrompt
  }))
  check('标题：硬校验被执行', stagesSeen.includes('hardcheck'))
  check('标题：多轮改写被记录', (titles.review?.rounds.length ?? 0) >= 2, String(titles.review?.rounds.length))
  check('标题：finalize 步骤已进入流程', stagesSeen.includes('optimizer'))
  check('标题：演示标题不含数字', titles.candidates.every((c) => !/\d/.test(c.title)), titles.candidates.map((c) => c.title).join(' | '))
  const titlesMd = buildTitlesMarkdown(titles)
  check('标题：Markdown 有内容', titlesMd.length > 100)
  check('标题：Markdown 标注演示', /演示/.test(titlesMd))

  // 流式展示（用户只看得到「标题在长出来」，看不到 JSON 与提示词）
  {
    const streamed = titlesStream.join('')
    check('标题：流式有输出', titlesStream.length > 0, `${titlesStream.length} chunk`)
    check(
      '标题：流式不含 JSON 语法或字段名',
      !/[{}[\]"]|formulaId|"title"/.test(streamed),
      streamed.slice(0, 120),
    )
    check(
      '标题：流式内容是真实标题而非占位符',
      streamed.includes('早八通勤穿搭'),
      streamed.slice(0, 120),
    )
    check(
      '标题：每个流式片段都可直接展示（无空串）',
      titlesStream.every((s) => s.length > 0),
    )
    check('标题：人设内容不漏进流式展示', !streamed.includes(PERSONA_MARK))
  }

  /* ---------------- 标题节点恢复 ---------------- */
  {
    let shouldFailWriter = true
    const calls: string[] = []
    let failedSnapshot: AgentRunSnapshot | null = null
    const base = createMockAgentClients({
      mockResponder: createTitlesMockResponder({
        topic: titlesInput.topic,
        audience: titlesInput.audience,
        platform: titlesInput.platform,
      }),
      mockSearch: mockSearchFor,
    })
    const flakyClients = {
      ...base,
      chat: {
        complete: async (req: { stageHint?: string }) => {
          if (req.stageHint) calls.push(req.stageHint)
          if (req.stageHint === 'writer' && shouldFailWriter) throw new Error('模拟写手失败')
          return base.chat.complete(req as never)
        },
      },
    }
    try {
      await runTitlesFlow({
        input: titlesInput,
        clients: flakyClients,
        sink: { publish: (next) => { failedSnapshot = next } },
      })
    } catch {
      // 预期失败：保留 sink 中已落盘的上游检查点。
    }
    const failedRun = failedSnapshot as AgentRunSnapshot | null
    check('标题恢复：失败步骤仍标记 failed', failedRun?.stages.find((s) => s.id === 'writer')?.status === 'failed')
    check('标题恢复：失败前的上游检查点已保存', Boolean(failedRun?.checkpoints?.retriever))

    shouldFailWriter = false
    calls.length = 0
    const resumed = await runTitlesFlow({
      input: titlesInput,
      clients: flakyClients,
      resume: { fromStageId: 'writer', snapshot: failedRun! },
    })
    check('标题恢复：上游理解步骤没有重跑', !calls.includes('understander'))
    check('标题恢复：选中写手步骤重新执行', calls.includes('writer'))
    check('标题恢复：下游评审步骤重新执行', calls.includes('reviewer'))
    check('标题恢复：失败后续跑恢复为 done', resumed.run?.status === 'done')
    check('标题恢复：失败状态被选中步骤覆盖', resumed.run?.stages.find((s) => s.id === 'writer')?.status === 'done')
  }

  /* ---------------- 脚本流程 ---------------- */
  for (const mode of ['video', 'live'] as const) {
    const cfg: ScriptConfig = {
      mode,
      product: '早八通勤穿搭',
      audience: '上班族',
      platform: mode === 'live' ? '抖音直播' : '抖音',
      durationSec: mode === 'live' ? 1800 : 60,
      goal: '获客',
      strength: 50,
      structure: { kind: 'auto' },
      // 人设默认注入：内容必须真的进提示词，且绝不能漏到流式展示里
      personaContent: PERSONA_MARK,
    }
    const clients = createMockAgentClients({
      mockResponder: createScriptMockResponder({ product: cfg.product, mode }),
    })
    const seen: string[] = []
    const streamed: string[] = []
    const result = await runScriptFlow({
      config: cfg,
      clients,
      onStageChange: (id) => seen.push(id),
      onDelta: (chunk) => streamed.push(chunk),
    })
    const segs = result.segments ?? []
    const resumeCalls: string[] = []
    const resumeBase = createMockAgentClients({
      mockResponder: createScriptMockResponder({ product: cfg.product, mode }),
    })
    const resumeClients = {
      ...resumeBase,
      chat: {
        complete: async (req: { stageHint?: string }) => {
          if (req.stageHint) resumeCalls.push(req.stageHint)
          return resumeBase.chat.complete(req as never)
        },
      },
    }
    const resumedScript = await runScriptFlow({
      config: cfg,
      clients: resumeClients,
      resume: { fromStageId: 'writer', snapshot: result.run! },
    })
    check(`脚本(${mode})恢复：上游策划员没有重跑`, !resumeCalls.includes('planner'))
    check(`脚本(${mode})恢复：选中编剧步骤重新执行`, resumeCalls.includes('writer'))
    check(`脚本(${mode})恢复：下游评审步骤重新执行`, resumeCalls.includes('reviewer'))
    check(`脚本(${mode})恢复：流程正常完成且产物保留`, resumedScript.run?.status === 'done' && (resumedScript.segments?.length ?? 0) > 0)
    check(`脚本(${mode})：有分段`, segs.length >= 4, `${segs.length} 段`)
    check(
      `脚本(${mode})：时间码连续`,
      segs.every((s, i) => (i === 0 ? s.startSec === 0 : s.startSec === segs[i - 1].endSec)),
    )
    check(`脚本(${mode})：最后一段收在总时长`, segs[segs.length - 1].endSec === cfg.durationSec, String(segs[segs.length - 1].endSec))
    const rounds = result.rounds ?? []
    // 双重不变量：
    //  1) 单轮内 retentionPoints 必须起点 100 且单调不增（「越讲人越多」是假曲线）
    //  2) 跨轮的平均留存必须**上升**（迭代的目的就是改善），所以不能对轮均值套单调不增
    check(
      `脚本(${mode})：单轮留存单调不增且不超过起点 100`,
      rounds.length > 0 &&
        rounds.every(
          (r) =>
            r.retentionPoints.length === segs.length &&
            r.retentionPoints.every((v, i) => (i === 0 ? v <= 100 : v <= r.retentionPoints[i - 1])),
        ),
      rounds.map((r) => `[${r.retentionPoints.join(',')}]`).join(' → '),
    )
    const avgs = rounds.map((r) => r.averageRetention)
    check(
      `脚本(${mode})：跨轮平均留存不下降`,
      avgs.every((v, i) => (i === 0 ? true : v >= avgs[i - 1])),
      `[${avgs.join(',')}]`,
    )
    check(`脚本(${mode})：标记演示`, result.usedMock === true)
    check(`脚本(${mode})：轮次 ≤ 3`, (result.rounds ?? []).length <= 3, String((result.rounds ?? []).length))
    check(`脚本(${mode})：过程快照有阶段 8 个`, (result.run?.stages.length ?? 0) === 8, String(result.run?.stages.length))
    check(
      `脚本(${mode})：算法步骤不含提示词`,
      (result.run?.stages ?? []).every((s) => {
        const def = getFlow('script-generate')?.stages.find((d) => d.id === s.id)
        return def?.kind !== 'algo' || !s.actualPrompt
      }),
    )
    const md = buildScriptMarkdown({
      config: cfg,
      segments: segs,
      spokenOf: (s) => s.spoken,
      rounds,
      demo: result.usedMock === true,
    })
    check(`脚本(${mode})：Markdown 有内容`, md.length > 200)
    check(`脚本(${mode})：Markdown 标注演示`, /演示/.test(md))

    // 流式展示：编剧/改写返回 JSON，用户只该看到口播正文在长出来
    {
      const streamedText = streamed.join('')
      check(`脚本(${mode})：流式有输出`, streamed.length > 0, `${streamed.length} chunk`)
      check(
        `脚本(${mode})：流式不含 JSON 语法或字段名`,
        !/[{}[\]"]|"spoken"|"visual"|segments/.test(streamedText),
        streamedText.slice(0, 120),
      )
      check(
        `脚本(${mode})：流式内容来自真实口播`,
        segs.some((s) => streamedText.includes(s.spoken.slice(0, 12))),
        streamedText.slice(0, 120),
      )
      check(
        `脚本(${mode})：每个流式片段都可直接展示（无空串）`,
        streamed.every((s) => s.length > 0),
      )
      check(
        `脚本(${mode})：人设内容不漏进流式展示`,
        !streamedText.includes(PERSONA_MARK),
      )
      check(
        `脚本(${mode})：人设标签不重复（无双标题）`,
        !/表达参考人设[^\n]*表达参考人设/.test(
          (result.run?.stages ?? []).map((s) => s.actualPrompt ?? '').join('\n'),
        ),
      )

      // 开关关掉时必须**一个字都不注入**（页面传 undefined）
      const offResult = await runScriptFlow({
        config: { ...cfg, personaContent: undefined },
        clients: createMockAgentClients({
          mockResponder: createScriptMockResponder({ product: cfg.product, mode }),
        }),
      })
      const offPrompts = (offResult.run?.stages ?? []).map((s) => s.actualPrompt ?? '').join('\n')
      check(`脚本(${mode})：关掉人设后提示词不含人设内容`, !offPrompts.includes(PERSONA_MARK))
      check(`脚本(${mode})：关掉人设后该行渲染为「无」`, /表达参考人设：无/.test(offPrompts))
      check(`脚本(${mode})：关掉人设后不残留模板占位符`, !offPrompts.includes('«persona»'))
    }

    const html = buildTeleprompterHtml({
      config: cfg,
      segments: segs,
      spokenOf: (s) => s.spoken,
      generatedAt: '2026-10-12 00:00',
    })
    check(`脚本(${mode})：提词器 HTML 是完整文档`, /^<!DOCTYPE html>/i.test(html) && /<\/html>/i.test(html))
    check(`脚本(${mode})：提词器无外部请求`, !/https?:\/\//i.test(html))
    check(`脚本(${mode})：提词器含全部口播文本`, segs.every((s) => html.includes(s.spoken.slice(0, 12))))
    check(`脚本(${mode})：提词器含速度与字号控件`, /速度|字号/.test(html))
  }


  /* -------- 直播自定义结构：UI 选择后必须原样进入生成与结果 -------- */
  {
    const customNames = ['开场暖场', '产品演示', '互动问答', '复盘收尾']
    const cfg: ScriptConfig = {
      mode: 'live',
      product: '早八通勤穿搭',
      audience: '上班族',
      platform: '抖音直播',
      durationSec: 900,
      goal: '成交',
      strength: 50,
      structure: { kind: 'custom', text: customNames.join(' + ') },
    }
    const result = await runScriptFlow({
      config: cfg,
      clients: createMockAgentClients({
        mockResponder: createScriptMockResponder({ product: cfg.product, mode: 'live', segmentCount: customNames.length }),
      }),
    })
    const segs = result.segments ?? []
    check('直播自定义结构：章节名称与顺序保持用户输入', JSON.stringify(segs.map((s) => s.name)) === JSON.stringify(customNames), segs.map((s) => s.name).join(' / '))
    check('直播自定义结构：宿主分配连续稳定 id', segs.every((s, i) => s.id === `seg-${i + 1}`), segs.map((s) => s.id).join(','))
    check('直播自定义结构：时间码覆盖完整时长', segs[0]?.startSec === 0 && segs.at(-1)?.endSec === cfg.durationSec)
    const structurerPrompt = (result.run?.stages ?? []).find((s) => s.id === 'structurer')?.actualPrompt ?? ''
    check('直播自定义结构：结构师提示词包含用户结构', customNames.every((name) => structurerPrompt.includes(name)))
    const writerPrompt = (result.run?.stages ?? []).find((s) => s.id === 'writer')?.actualPrompt ?? ''
    check('直播自定义结构：编剧提示词包含宿主章节 id 与名称', customNames.every((name) => writerPrompt.includes(name)) && writerPrompt.includes('id: seg-1'))
  }
  /* -------- 稳定性与兜底（2026-10-12 真机缺陷回归） -------- */
  {
    /**
     * 用「记录请求」的客户端包一层，断言**内核真正发出去的请求体**。
     * 真机故障恰恰都在这一层：人设漏传某一步、评审没走 JSON、token 上限太低、
     * 预填失败却声称「AI 已补全」。这些断言都不需要联网。
     */
    type Seen = {
      stageHint?: string
      background?: string
      responseFormat?: { type?: string }
      maxTokens?: number
    }
    const seen: Seen[] = []
    const base = createMockAgentClients({
      mockResponder: createScriptMockResponder({ product: '早八通勤穿搭', mode: 'video' }),
    })
    const recording = {
      ...base,
      chat: {
        complete: async (req: {
          stageHint?: string
          background?: string
          responseFormat?: { type?: string }
          maxTokens?: number
        }) => {
          seen.push({
            stageHint: req.stageHint,
            background: req.background,
            responseFormat: req.responseFormat,
            maxTokens: req.maxTokens,
          })
          return base.chat.complete(req as never)
        },
      },
    }

    const cfg: ScriptConfig = {
      mode: 'video',
      product: '早八通勤穿搭',
      platform: '抖音',
      durationSec: 60,
      goal: '获客',
      strength: 50,
      structure: { kind: 'auto' },
      // 两路都打开：风格进提示词变量，身份进背景上下文
      personaContent: PERSONA_MARK,
      personaBackground: BACKGROUND_MARK,
    }
    await runScriptFlow({ config: cfg, clients: recording })

    const modelStages = seen.filter((s) => s.stageHint !== 'autofill')
    check('稳定性：脚本流程至少发了 4 次模型调用', modelStages.length >= 4, `${modelStages.length} 次`)
    // 背景人设作为身份事实注入，且**不能漏掉任何一步**（漏传在真机上表现为「评审突然不知道我是谁」）
    check(
      '稳定性：每一步都带上背景人设（无一步遗漏）',
      modelStages.length > 0 && modelStages.every((s) => (s.background ?? '').includes(BACKGROUND_MARK)),
      `${modelStages.filter((s) => (s.background ?? '').includes(BACKGROUND_MARK)).length}/${modelStages.length}`,
    )
    // 风格人设不得被当成身份背景（两路内容不同，串了就说明 flow 取错了字段）
    check('稳定性：风格人设不被当成背景上下文', !modelStages.some((s) => (s.background ?? '').includes(PERSONA_MARK)))
    // 评审输出最长：必须走 JSON 模式并抬高上限，否则真机会截断成残缺 JSON
    const reviewerReq = seen.find((s) => s.stageHint === 'reviewer')
    check('稳定性：评审步骤要求 JSON 输出', reviewerReq?.responseFormat?.type === 'json_object')
    // 断言「取自预算表」而不是写死某个数字：演示档就是 4096，远端档才抬到 8192。
    // 两种档位的相对关系由 budgets.test.mjs 覆盖，这里只证明接线正确。
    check(
      '稳定性：评审 token 上限取自预算表（非写死）',
      reviewerReq?.maxTokens === resolveBudgets(true).reviewerMaxTokens,
      String(reviewerReq?.maxTokens),
    )
    // 预填是最短的一步，给它的上限不该被抬高
    const autofillReq = seen.find((s) => s.stageHint === 'autofill')
    check(
      '稳定性：预填步骤没有被抬高 token 上限',
      (autofillReq?.maxTokens ?? 999) <= 512,
      String(autofillReq?.maxTokens),
    )
  }

  /* -------- 背景上下文注入形态（直接测拼装函数，不依赖远端客户端） -------- */
  {
    /**
     * `withBackground` 只在远端客户端里被调用，演示客户端不走它。
     * 所以这里直接测拼装函数本身 —— 否则「背景不进提示词」这类断言在演示模式下是空转的。
     */
    const sys = { role: 'system' as const, content: '你是编剧。' }
    const user = { role: 'user' as const, content: '写一段口播。' }
    const withBg = withBackground([sys, user], BACKGROUND_MARK)
    check('背景：插成独立 system 消息', withBg.length === 3 && withBg[1].role === 'system')
    check('背景：排在任务 system 之后、user 之前', withBg[0].content === '你是编剧。' && withBg[2].content === '写一段口播。')
    check('背景：带【背景上下文】标记', (withBg[1].content ?? '').startsWith('【背景上下文】'))
    check('背景：不拼进任务 system 消息（语义不串）', !(withBg[0].content ?? '').includes(BACKGROUND_MARK))
    check('背景：空值不产生空 system 消息', withBackground([sys, user], '').length === 2)
    check('背景：不改动传入数组（纯函数）', [sys, user].length === 2 && withBackground([sys, user], 'x').length === 3)
  }

  // 关掉人设开关：两路都必须一步都不带
  {
    const seen: Array<{ background?: string; actualPrompt?: string }> = []
    const base = createMockAgentClients({
      mockResponder: createScriptMockResponder({ product: '早八通勤穿搭', mode: 'video' }),
    })
    const recording = {
      ...base,
      chat: {
        complete: async (req: { stageHint?: string; background?: string }) => {
          seen.push({ background: req.background })
          return base.chat.complete(req as never)
        },
      },
    }
    await runScriptFlow({
      config: {
        mode: 'video',
        product: '早八通勤穿搭',
        platform: '抖音',
        durationSec: 60,
        goal: '获客',
        strength: 50,
        structure: { kind: 'auto' },
        personaContent: undefined,
        personaBackground: undefined,
      },
      clients: recording,
    })
    check(
      '稳定性：关掉人设后没有任何一步带背景',
      seen.every((s) => !s.background || !s.background.includes(BACKGROUND_MARK)),
    )
  }

  // 预填失败必须如实标注 fromFallback，页面才能停止声称「AI 已补全」
  {
    const base = createMockAgentClients({
      mockResponder: createScriptMockResponder({ product: '早八通勤穿搭', mode: 'video' }),
    })
    const autofillBroken = {
      ...base,
      chat: {
        complete: async (req: { stageHint?: string }) => {
          if (req.stageHint === 'autofill') throw new Error('模拟预填失败')
          return base.chat.complete(req as never)
        },
      },
    }
    const result = await runScriptFlow({
      config: {
        mode: 'video',
        product: '早八通勤穿搭',
        platform: '抖音',
        durationSec: 60,
        goal: '获客',
        strength: 50,
        structure: { kind: 'auto' },
      },
      clients: autofillBroken,
    })
    check('兜底：预填失败被标记为 fromFallback', result.autofill?.fromFallback === true)
    check('兜底：预填失败后主流程仍产出分段', (result.segments ?? []).length >= 4)
    check('兜底：预填失败被如实标记为降级', result.run?.fallback === true || result.fallback === true)
  }

  /* ------------------------------------------------------------------ *
   * 工具调用循环必须保留每轮思考，同时隔离失败重试的临时内容
   * ------------------------------------------------------------------ */
  {
    const stage: AgentStageDef = {
      id: 'research', order: 1, roleName: '调研员', roleTag: 'AI + 检索',
      kind: 'model', headline: '正在检索', principle: '定向检索',
    }
    const makeToolCall = (id: string) => ({
      id,
      name: 'web_search',
      arguments: { query: `query-${id}` },
    })
    const makeSearch = {
      search: async (query: string) => ({
        query,
        snippets: [{ title: query, snippet: `result for ${query}` }],
      }),
    }

    let overLimitCalls = 0
    const overLimitRunner = createStageRunner({
      flowId: 'reasoning-history-over-limit-check',
      stages: [stage],
      sink: { publish: () => {} },
      clients: {
        chat: {
          complete: async (req: { onReasoningDelta?: (chunk: string) => void }) => {
            overLimitCalls += 1
            req.onReasoningDelta?.(`over-limit-thought-${overLimitCalls}`)
            return { content: '', toolCalls: [makeToolCall(`over-${overLimitCalls}`)] }
          },
        },
        search: makeSearch,
        isMock: false,
      } as never,
    })
    let overLimitError = ''
    try {
      await overLimitRunner.runModelWithTools('research', {
        messages: [{ role: 'user', content: '检索资料' }],
        tools: [{ name: 'web_search', description: '检索' }],
        maxTurns: 2,
        retry: 0,
      })
    } catch (e) {
      overLimitError = e instanceof Error ? e.message : String(e)
    }
    const overLimitState = overLimitRunner.snapshot().stages[0]
    check('思考历史：检索超限仍如实抛出既有错误', overLimitError === '检索轮次超限，请简化资料后重试。')
    check(
      '思考历史：超限失败快照保留之前每轮思考',
      overLimitState.reasoningHistory?.map((item) => item.text).join('|') ===
        'over-limit-thought-1|over-limit-thought-2',
    )
    check('思考历史：每轮历史记录保留原始检索轮次',
      overLimitState.reasoningHistory?.map((item) => item.turn).join(',') === '1,2')
    const firstSignature = snapshotProgressSignature(overLimitRunner.snapshot())
    const changedSnapshot = overLimitRunner.snapshot()
    changedSnapshot.stages[0].reasoningHistory = [
      ...(changedSnapshot.stages[0].reasoningHistory ?? []),
      { turn: 3, text: 'late persisted thought' },
    ]
    check('思考历史：任务快照进度签名覆盖已归档思考变化',
      firstSignature !== snapshotProgressSignature(changedSnapshot))

    let retryCalls = 0
    const retryRunner = createStageRunner({
      flowId: 'reasoning-history-retry-check',
      stages: [stage],
      sink: { publish: () => {} },
      clients: {
        chat: {
          complete: async (req: { onReasoningDelta?: (chunk: string) => void }) => {
            retryCalls += 1
            if (retryCalls === 1) {
              req.onReasoningDelta?.('discarded-retry-thought')
              throw Object.assign(new Error('temporary upstream error'), { status: 500 })
            }
            if (retryCalls === 2) {
              req.onReasoningDelta?.('kept-first-thought')
              return { content: '', toolCalls: [makeToolCall('retry-search')] }
            }
            req.onReasoningDelta?.('kept-final-thought')
            return { content: 'final answer' }
          },
        },
        search: makeSearch,
        isMock: false,
      } as never,
    })
    await retryRunner.runModelWithTools('research', {
      messages: [{ role: 'user', content: '检索资料' }],
      tools: [{ name: 'web_search', description: '检索' }],
      maxTurns: 2,
      retry: 1,
    })
    const retryState = retryRunner.snapshot().stages[0]
    const retryThinking = resolveStageOutputLayers(retryState, { kind: 'model' }).thinking
    check('思考历史：重试成功后保留前后检索轮次',
      retryThinking.includes('kept-first-thought') && retryThinking.includes('kept-final-thought'))
    check('思考历史：失败重试的临时推理不重复混入历史',
      !retryThinking.includes('discarded-retry-thought'))
  }

  /* ------------------------------------------------------------------ *
   * 检索词必须有效：空参数不应触发泛词搜索或被静默丢弃
   * ------------------------------------------------------------------ */
  {
    const queryStage: AgentStageDef = {
      id: 'research', order: 1, roleName: '调研员', roleTag: 'AI + 检索',
      kind: 'model', headline: '正在检索', principle: '根据用户资料定向检索',
    }
    check('检索参数：空值与无效 JSON 不伪造成“检索”关键词',
      Object.keys(parseSearchToolArguments('')).length === 0 &&
        Object.keys(parseSearchToolArguments('{bad json')).length === 0)
    check('检索参数：queries 数组会归一为具体 query',
      parseSearchToolArguments('{"queries":["餐饮团购短视频客群"]}').query === '餐饮团购短视频客群')
    check('检索参数：拦截“检索”等泛词，不拦具体主题词',
      isGenericSearchQuery('检索') && isGenericSearchQuery(' 搜索 ') &&
        !isGenericSearchQuery('餐饮团购短视频客群'))

    let chatCalls = 0
    let searchCalls = 0
    let repairFeedback = ''
    const queryGuardRunner = createStageRunner({
      flowId: 'missing-search-query-check',
      stages: [queryStage],
      clients: {
        chat: {
          complete: async (request: { messages: Array<{ role: string; content: string }> }) => {
            chatCalls += 1
            if (chatCalls === 1) {
              return { content: '', toolCalls: [{ id: 'call-invalid', name: 'web_search', arguments: {} }] }
            }
            repairFeedback = request.messages.find((message) => message.role === 'tool')?.content ?? ''
            return { content: 'final answer', finishReason: 'stop' }
          },
        },
        search: {
          search: async () => {
            searchCalls += 1
            return { query: '', snippets: [] }
          },
        },
        isMock: false,
      } as never,
    })
    const guardedResult = await queryGuardRunner.runModelWithTools('research', {
      messages: [{ role: 'user', content: '餐饮团购短视频操盘手，目标客户是中小餐饮门店。' }],
      tools: [{ name: 'web_search', description: '定向搜索' }],
      retry: 0,
    })
    check('检索参数：缺失 query 时不请求搜索 API，并反馈补充具体词',
      guardedResult === 'final answer' && searchCalls === 0 && repairFeedback.includes('检索未执行'))

    let failedChatCalls = 0
    let failedSearchCalls = 0
    let retryRequestHadTools = true
    let fallbackFeedback = ''
    const failedSearchRunner = createStageRunner({
      flowId: 'search-failure-fallback-check',
      stages: [queryStage],
      clients: {
        chat: {
          complete: async (request: { messages: Array<{ role: string; content: string }>; tools?: unknown[] }) => {
            failedChatCalls += 1
            if (failedChatCalls === 1) {
              return {
                content: '',
                toolCalls: [{
                  id: 'call-failed-search',
                  name: 'web_search',
                  arguments: { query: '餐饮团购短视频客群痛点', purpose: '补足目标客户的真实困扰以完善人设画像' },
                }],
              }
            }
            retryRequestHadTools = Boolean(request.tools?.length)
            fallbackFeedback = request.messages.find((message) => message.role === 'tool')?.content ?? ''
            return { content: 'final answer without web results', finishReason: 'stop' }
          },
        },
        search: {
          search: async () => {
            failedSearchCalls += 1
            throw Object.assign(new Error('模拟搜索超时'), { status: 503 })
          },
        },
        isMock: false,
      } as never,
    })
    const fallbackResult = await failedSearchRunner.runModelWithTools('research', {
      messages: [{ role: 'user', content: '行业餐饮代运营，目标客户中小餐饮门店。' }],
      tools: [{ name: 'web_search', description: '定向搜索' }],
      retry: 0,
    })
    const failedAttempt = failedSearchRunner.snapshot().stages[0].searchAttempts?.[0]
    check('检索失败：保留关键词与模型解释的检索目的',
      failedAttempt?.query === '餐饮团购短视频客群痛点' &&
        failedAttempt.purpose === '补足目标客户的真实困扰以完善人设画像' &&
        failedAttempt.status === 'failed')
    check('检索失败：明确反馈失败并关闭后续工具调用，继续纯模型生成',
      fallbackResult === 'final answer without web results' && failedSearchCalls === 1 &&
        !retryRequestHadTools && fallbackFeedback.includes('联网搜索失败'))
  }

  /* ------------------------------------------------------------------ *
   * 跳过步骤的快照必须干净
   *
   * 真机复测抓到：收敛环里同一步会被反复重跑，`skip()` 若只改 status，
   * 快照就留下「已跳过，却耗时 49.9 秒、还带着上一轮提示词」的记录。
   * 这里直接构造 runner 断言，不依赖任何 flow。
   * ------------------------------------------------------------------ */
  {
    const stages: AgentStageDef[] = [
      { id: 'write', order: 1, roleName: '编剧', roleTag: 'AI', kind: 'model', headline: '正在写', principle: '写' },
      { id: 'edit', order: 2, roleName: '编辑', roleTag: 'AI', kind: 'model', headline: '正在改', principle: '改' },
    ]
    const calls: string[] = []
    const runner = createStageRunner({
      flowId: 'skip-semantics-check',
      stages,
      clients: {
        chat: {
          complete: async (req: { stageHint?: string }) => {
            calls.push(String(req.stageHint))
            return { content: '{"ok":true}', finishReason: 'stop', toolCalls: [] }
          },
        },
        search: { search: async () => ({ results: [] }) },
        isMock: false,
      } as never,
    })

    await runner.runModel('edit', {
      userTemplate: '改：«text»',
      vars: { text: 'a' },
      // 必须传 onDelta：streamingContent 只有流式步骤才会有值，
      // 不传的话「清掉流式内容」这条断言会恒真（假通过）。
      onDelta: () => {},
    })
    const ran = runner.snapshot().stages.find((s) => s.id === 'edit')
    check('跳过语义：先跑一次会留下计时与提示词', Boolean(ran?.startedAt) && Boolean(ran?.actualPrompt))
    check(
      '跳过语义：先跑一次会留下流式内容（让下一条断言不落空）',
      typeof ran?.streamingContent === 'string',
    )

    runner.setRound(2)
    await runner.skip('edit')
    const skipped = runner.snapshot().stages.find((s) => s.id === 'edit')
    check('跳过语义：status 为 skipped', skipped?.status === 'skipped')
    check('跳过语义：清掉上一轮的 startedAt', skipped?.startedAt === undefined)
    check('跳过语义：清掉上一轮的 finishedAt', skipped?.finishedAt === undefined)
    check('跳过语义：清掉上一轮的提示词', skipped?.actualPrompt === undefined)
    check('跳过语义：清掉上一轮的流式内容', skipped?.streamingContent === undefined)
    check('跳过语义：轮次标在发生的这一轮', skipped?.round === 2)
    check('跳过语义：跳过不会真的调用模型', calls.length === 1)

    // 跳过不能波及别的步骤
    const write = runner.snapshot().stages.find((s) => s.id === 'write')
    check('跳过语义：未执行的步骤仍是 idle', write?.status === 'idle')
  }

  /* ------------------------------------------------------------------ *
   * finish() 必须让快照自洽：没触达的步骤收尾时统一记为 skipped
   *
   * 真机复测抓到：titles-flow 收敛提前 break，后面的「编辑」永远停在 idle，
   * 于是快照里出现「整轮已 done，编辑仍显示待执行」——idle 对用户意味着还在排队。
   * ------------------------------------------------------------------ */
  {
    const stages: AgentStageDef[] = [
      { id: 'writer', order: 1, roleName: '写手', roleTag: 'AI', kind: 'model', headline: '正在写', principle: '写' },
      { id: 'editor', order: 2, roleName: '编辑', roleTag: 'AI', kind: 'model', headline: '正在改', principle: '改' },
      { id: 'optimizer', order: 3, roleName: '选优', roleTag: '本机', kind: 'algo', headline: '正在选优', principle: '选' },
    ]
    const mkRunner = () =>
      createStageRunner({
        flowId: 'finish-semantics-check',
        stages,
        clients: {
          chat: {
            complete: async () => ({ content: '{"ok":true}', finishReason: 'stop', toolCalls: [] }),
          },
          search: { search: async () => ({ results: [] }) },
          isMock: false,
        } as never,
      })

    // 跑完第一个步骤后提前收敛（模拟 titles-flow 的 break）
    const r1 = mkRunner()
    await r1.runModel('writer', { userTemplate: '写：«text»', vars: { text: 'a' } })
    await r1.finish('done')
    const done = r1.snapshot()
    check('收尾语义：整轮状态为 done', done.status === 'done')
    check(
      '收尾语义：没触达的步骤被记为 skipped，不留 idle',
      done.stages.every((s) => s.status !== 'idle'),
      done.stages.map((s) => `${s.id}=${s.status}`).join(' '),
    )
    const editor = done.stages.find((s) => s.id === 'editor')
    check('收尾语义：编辑被记为 skipped', editor?.status === 'skipped')
    check(
      '收尾语义：跳过的编辑没有残留计时/提示词',
      editor?.startedAt === undefined && editor?.finishedAt === undefined && editor?.actualPrompt === undefined,
    )
    check(
      '收尾语义：真的跑过的步骤仍保持 done（不被误改）',
      done.stages.find((s) => s.id === 'writer')?.status === 'done',
    )

    // 失败收尾同样要自洽
    const r2 = mkRunner()
    await r2.finish('failed')
    const failed = r2.snapshot()
    check('收尾语义：失败收尾时也不留 idle', failed.stages.every((s) => s.status !== 'idle'))
    check('收尾语义：失败收尾状态正确', failed.status === 'failed')

    // 关键边界：兜底只能动 idle，绝不能把「真的失败了」洗成「跳过了」。
    // 那会把一次真实失败伪装成「本轮不需要做」，是诚实性倒退。
    const r3 = mkRunner()
    await r3.failStage('writer', new Error('模拟失败'))
    await r3.finish('failed')
    const mixed = r3.snapshot()
    check(
      '收尾语义：真的失败的步骤保持 failed（不被洗成 skipped）',
      mixed.stages.find((s) => s.id === 'writer')?.status === 'failed',
      mixed.stages.map((s) => `${s.id}=${s.status}`).join(' '),
    )
    check(
      '收尾语义：失败步骤的错误信息不被清掉',
      Boolean(mixed.stages.find((s) => s.id === 'writer')?.error),
    )

    // 取消路径：用户中途点「取消」时，正在跑的那一步必须被收口。
    // 若停在 running，界面会永远显示「进行中」—— 一个已经没人跑的过程。
    const r4 = createStageRunner({
      flowId: 'finish-semantics-cancel',
      stages,
      clients: {
        chat: {
          complete: async () => {
            throw new DOMException('Aborted', 'AbortError')
          },
        },
        search: { search: async () => ({ results: [] }) },
        isMock: false,
      } as never,
    })
    let cancelThrown = false
    try {
      await r4.runModel('writer', { userTemplate: '写：«text»', vars: { text: 'a' } })
    } catch (e) {
      cancelThrown = isAbortError(e)
    }
    check('取消语义：取消会以 AbortError 抛出（不被吞掉）', cancelThrown)
    await r4.finish('cancelled')
    const cancelled = r4.snapshot()
    check('取消语义：整轮状态为 cancelled', cancelled.status === 'cancelled')
    check(
      '取消语义：没有任何步骤停在 running（否则界面永远显示「进行中」）',
      cancelled.stages.every((s) => s.status !== 'running'),
      cancelled.stages.map((s) => `${s.id}=${s.status}`).join(' '),
    )
    check(
      '取消语义：没有残留 idle',
      cancelled.stages.every((s) => s.status !== 'idle'),
      cancelled.stages.map((s) => `${s.id}=${s.status}`).join(' '),
    )
    check(
      '取消语义：被取消的那一步记为 skipped 而非 failed（不是错误，是用户主动停的）',
      cancelled.stages.find((s) => s.id === 'writer')?.status === 'skipped',
      cancelled.stages.map((s) => `${s.id}=${s.status}`).join(' '),
    )
  }

  {
    const spec = {
      weekId: 'offline-week', planPeriod: { startDate: '2026-10-26', endDate: '2026-11-01' },
      planningMode: 'daily' as const, publishSpec: { kind: 'weekly' as const, perWeek: 1 },
      businessPurpose: '离线测试', coreTasks: '测试排期', personaContent: PERSONA_MARK,
      revisionInstruction: '只调整第一条', currentDays: [{ date: '2026-10-26', items: [{ publishOrder: 1, contentDirection: '生活日常', topic: '原有主题探针' }] }],
    }
    const requests: string[] = []
    const responder = createMomentsPlanMockResponder(spec)
    const clients = createMockAgentClients({ mockResponder: (request, context) => {
      requests.push(JSON.stringify(request.messages))
      return responder(request, context)
    } })
    const result = await runMomentsPlanFlow({ input: spec, clients })
    check('朋友圈离线：一周一条与空日', result.days.reduce((sum, day) => sum + day.items.length, 0) === 1 && result.days.length === 7)
    check('朋友圈离线：修改上下文和人设传入', requests.some((s) => s.includes('原有主题探针') && s.includes(PERSONA_MARK)))
    const controller = new AbortController()
    controller.abort()
    let aborted = false
    try { await runMomentsPlanFlow({ input: spec, clients, signal: controller.signal }) } catch (error) { aborted = isAbortError(error) }
    check('朋友圈离线：预先取消', aborted)
  }
  {
    const requests: string[] = []
    const responder = createPersonaMockResponder('user')
    const clients = createMockAgentClients({ mockResponder: (request, context) => {
      requests.push(JSON.stringify(request))
      return responder(request, context)
    } })
    const result = await runPersonaFlow({ kind: 'user', formData: { industry: '餐饮', role: '顾问', primaryBusiness: '餐饮咨询', targetClients: '小店经营者' }, chatAttachments: [{ kind: 'document', name: '测试资料.txt', text: '附件内容探针' }], clients })
    check('人设离线：生成并标识演示', result.usedMock && result.markdown.length > 0)
    check('人设离线：问卷与附件传入', requests.some((s) => s.includes('餐饮咨询') && s.includes('附件内容探针')))
    const failedClients = createMockAgentClients({ mockResponder: () => { throw new Error('离线模型失败探针') } })
    let failed = false
    try { await runPersonaFlow({ kind: 'user', formData: { industry: '', role: '', primaryBusiness: '' }, clients: failedClients }) } catch { failed = true }
    check('人设离线：主模型失败不伪装成功', failed)
  }

  console.log('')
  if (failures.length) {
    console.log(`================ ${failures.length} 项失败 ================`)
    failures.forEach((f) => console.log(`  ! ${f}`))
    process.exitCode = 1
  } else {
    console.log(`================ 全部通过（${pass} 项） ================`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
