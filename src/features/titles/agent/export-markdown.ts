/**
 * 爆款标题 · 结果导出
 */
import type { TitleGeneratePayload } from './types'

/** 结果导出为 Markdown（与脚本页同一交互形态：可复制、可下载） */
export function buildTitlesMarkdown(payload: TitleGeneratePayload, demo: boolean): string {
  const { input, requirement, candidates, formulas, evidence, hardCheck, review } = payload
  const lines: string[] = []
  lines.push(`# 爆款标题 · ${requirement.theme}`, '')
  if (demo) lines.push('> 演示模式：以下内容为流程演示结果，未经正式模型评审。', '')
  lines.push(
    `- 受众：${input.audience || '未填写'}`,
    `- 主题：${input.topic || '未填写'}`,
    `- 平台：${input.platform}`,
    `- 语气强度：${input.toneIntensity}/100`,
    `- 目标：${requirement.goal}`,
    `- 字数上限：${candidates[0]?.maxCharCount ?? 0} 字`,
    '',
  )

  const recommended = candidates.find((c) => c.isRecommended)
  if (recommended) {
    lines.push('## 首选推荐', '', `**${recommended.title}**`, '')
    lines.push(
      `- 句式：${recommended.formulaName}（${recommended.sourceTag}）`,
      `- 预估点击率：${recommended.ctr}%`,
      `- 可信度：${recommended.credibility}`,
      `- 综合分：${recommended.score}`,
      '',
    )
  }

  lines.push('## 全部候选', '')
  lines.push('| 排名 | 标题 | 句式 | 字数 | 预估点击率 | 可信度 | 综合分 | 最优曲线 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const c of candidates) {
    lines.push(
      `| ${c.rank} | ${c.title} | ${c.formulaName} | ${c.charCount}/${c.maxCharCount} | ${c.ctr}% | ${c.credibility} | ${c.score} | ${c.isParetoOptimal ? '是' : ''} |`,
    )
  }
  lines.push('')

  const multiRound = candidates.some((c) => c.rounds.length > 1)
  if (multiRound) {
    lines.push('## 改写轨迹', '')
    for (const c of candidates) {
      if (c.rounds.length < 2) continue
      lines.push(`### ${c.formulaName}`, '')
      for (const r of c.rounds) {
        lines.push(`- 第 ${r.round} 轮：${r.title}（点击率 ${r.ctr}% · 可信度 ${r.credibility} · 综合分 ${r.score}）`)
        if (r.issue) lines.push(`  - 问题：${r.issue}`)
        if (r.improvement) lines.push(`  - 方向：${r.improvement}`)
      }
      lines.push('')
    }
  }

  lines.push('## 合规硬校验', '')
  if (hardCheck.pass) {
    lines.push('- 通过（字数、违禁词、绝对化用语、无依据数字均已检查）', '')
  } else {
    for (const hit of hardCheck.hits) {
      lines.push(`- ${hit.segmentId ? `第 ${hit.segmentId} 条 ` : ''}${hit.label}：${hit.detail}`)
    }
    lines.push('')
  }

  if (review.rounds.length) {
    lines.push('## 迭代轮次', '')
    for (const r of review.rounds) {
      lines.push(
        `- 第 ${r.round} 轮：平均综合分 ${r.averageScore}，平均点击率 ${r.averageCtr}%，平均可信度 ${r.averageCredibility}，必改 ${r.mustFixCount} 条`,
      )
    }
    lines.push('')
  }

  if (formulas.length) {
    lines.push('## 使用的句式库', '')
    for (const f of formulas) {
      lines.push(`- ${f.id}｜${f.formulaName}：${f.templateWords}`)
    }
    lines.push('')
  }

  if (evidence.length) {
    lines.push('## 检索到的事实来源', '')
    for (const item of evidence) lines.push(`- ${item}`)
    lines.push('')
  }

  lines.push('---', '', '预估点击率与可信度均为模型评审的创作参考，不代表真实平台数据。')
  return lines.join('\n')
}

export function titlesMarkdownFilename(payload: TitleGeneratePayload): string {
  const base = (payload.requirement.theme || payload.input.topic || '爆款标题').replace(/[\\/:*?"<>|\s]+/g, '-')
  return `${base}-标题方案.md`
}
