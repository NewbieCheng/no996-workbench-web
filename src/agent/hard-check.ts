/**
 * 代码硬校验与合规检查（纯函数，不调用模型）。
 *
 * 对齐参考规格第 7 章：字数、内置违禁词、用户禁用词、必含词、
 * 医疗与收益承诺、虚假紧迫感（仅直播）、编造数据。
 *
 * 该表同时服务 titles（绝对化用语）与 script-lab（全量规则）。
 *
 * 2026-10-28 修复（线上「定稿仍有未解除的硬校验问题：第一、总字数 289」）：
 * 1. 违禁词不再「每个词只产出一条命中、只定位第一段」——同一词出现在多段时
 *    每段各一条，`mustFixIds` 才能收全；否则评审/编辑只能改到第一段，
 *    其余段里的同一个词永远修不掉，三轮后必然判失败。
 * 2. 「第一」的序数白名单补上「个 / 时间 / 反应」等常见说法；同时加「宣称语境」
 *    覆盖（销量、排名、行业、全网…），真正的极限宣称仍然命中。
 * 3. 总字数支持「口播字数」口径（去掉空白与标点），与语音语速目标同单位；
 *    命中说明带目标区间与差额，编辑步骤才有可执行数字。
 */

/** 内置违禁词：命中即标记。可按行业扩充。 */
export const BUILTIN_BANNED_WORDS = [
  '最好',
  '最强',
  '最佳',
  '第一',
  '唯一',
  '绝对',
  '100%',
  '保证',
  '根治',
  '永久',
  '全网',
  '国家级',
  '顶级',
] as const

/** 医疗与收益承诺 */
const MEDICAL_OR_PROFIT_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: '治愈', re: /治愈/ },
  { label: '治疗', re: /治疗/ },
  { label: '包治', re: /包治/ },
  { label: '稳赚', re: /稳赚/ },
  { label: '保本', re: /保本/ },
  { label: '日入', re: /日入/ },
  { label: '月入', re: /月入/ },
]

/** 虚假紧迫感：仅当用户未提供库存/福利信息时才标记 */
const FAKE_URGENCY_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: '最后一件', re: /最后一件/ },
  { label: '马上没了', re: /马上没了/ },
  { label: '只剩', re: /只剩/ },
  { label: '仅剩', re: /仅剩/ },
  { label: '抢完为止', re: /抢完为止/ },
]

/** 出现即视为「编造数字」的数值模式 */
const NUMERIC_PATTERN = /(\d+(?:\.\d+)?\s*(?:%|％|万|亿|倍|天|年|小时|分钟|秒|元|块|单|人|件|G|GB|ml|ML))/g

/**
 * 「第一」后面跟这些字时是序数/量词，不是极限宣称。
 *
 * 之前只有「步次天版轮遍条节课部分批回阶段稿款」，漏掉「个 / 时间 / 反应」
 * 这类日常说法，导致「第一个月」「第一时间」被判成绝对化用语 —— 线上事故
 * 的第一条命中就是它。这里补齐常见量词与时间表达。
 */
const ORDINAL_AFTER_FIRST =
  /第一(?=[步次天版轮遍条节课部分批回阶段稿款个种位眼层句段届场局期年月日周季集]|时间|反应|感觉|印象)/

/**
 * 「第一」前面出现这些词时是宣称语境，即使后面跟量词也仍然算极限宣称
 * （例如「行业第一位」「销量第一个」）。只看紧邻的 10 个字。
 */
const CLAIM_CONTEXT_BEFORE =
  /(?:销量|销售额|排名|排行|行业|全国|全网|全球|市场|品牌|口碑|人气|好评|增速|增长率|占有率|份额|榜单)[^。！？；\n]{0,6}$/

export type HardCheckHit = {
  /** 命中词或规则名 */
  label: string
  /** 规则分类 */
  rule: 'banned' | 'user-banned' | 'must-word' | 'medical-profit' | 'fake-urgency' | 'unsupported-number' | 'length' | 'early-selling' | 'segment-duplicate' | 'fake-offer'
  /** 命中所在的段/章 id（若可定位） */
  segmentId?: string
  /** 说明 */
  detail: string
  /**
   * 总字数命中的结构化信息：目标区间与差额。
   *
   * 有了它，编辑步骤才能拿到「要压多少字 / 要补多少字」——
   * 之前只有一句「偏差超过 15%」，模型无从下手。
   */
  length?: {
    target: number
    low: number
    high: number
    direction: 'over' | 'under'
    delta: number
  }
}

export type HardCheckInput = {
  /** 待检查的文本（通常由各段口播拼接） */
  text: string
  /** 逐段文本，用于把命中定位到段（可选） */
  segments?: Array<{ id: string; text: string }>
  bannedWords?: string[]
  mustWords?: string[]
  /** 直播场景才检查虚假紧迫感 */
  mode?: 'video' | 'live'
  /** 用户是否提供了真实库存/福利信息 */
  hasStockInfo?: boolean
  /** 视频：目标字数与容差（默认 ±15%） */
  targetChars?: number
  /**
   * 字数口径：
   * - `raw`（默认）：按码点计，标点与换行都算 —— 标题这种平台硬上限用这个；
   * - `spoken`：只数实际念出来的字（去空白与标点）—— 视频脚本用这个，
   *   与「每秒 4.17 字」的语速目标同单位。
   */
  lengthCountMode?: 'raw' | 'spoken'
  /** 视频：逐段字数预算，用于检查单段是否超 130% */
  segmentCharBudgets?: Array<{ id: string; budget: number }>
  /**
   * 单段预算的容差倍数，默认 1.3（口播分段本来就允许浮动）。
   * 标题这类有硬性平台字数上限的场景传 1，超一个字也算不合格。
   */
  segmentCharTolerance?: number
  /**
   * 允许出现数字的来源文本（brief + 检索结果 + 用户输入）。
   * 口播中的数字若不在其中，视为编造数据。
   */
  allowedNumberSources?: string
}

export type HardCheckResult = {
  pass: boolean
  hits: HardCheckHit[]
  /** 命中需要修改的段/章 id（去重） */
  mustFixIds: string[]
  /** 口播总字数 */
  charCount: number
}

/** 把命中的词定位到具体段/章（返回第一个包含该词的段 id） */
function locate(needle: string, segments?: Array<{ id: string; text: string }>): string | undefined {
  if (!segments?.length) return undefined
  return segments.find((s) => s.text.includes(needle))?.id
}

/** 按码点计数（避免 emoji 被算两次） */
function countChars(text: string): number {
  return [...text].length
}

/** 空白 + 中英文标点 */
const NON_SPOKEN_CHARS = /[\s\u3000-\u303f\uff00-\uffef!-/:-@[-`{-~]/g

/**
 * 口播字数：只数真正要念出来的字。
 *
 * 标点、空格、换行都不念，所以不应该占掉「每秒 4.17 字」的预算。
 * 之前用原始码点计数，一篇 60 秒稿子光标点就有 20–40 个字，
 * 直接把 15% 的容差吃掉大半。
 */
export function countSpokenChars(text: string): number {
  return [...String(text ?? '').replace(NON_SPOKEN_CHARS, '')].length
}

/** 某一处「第一」是否属于序数用法（不是极限宣称） */
function isOrdinalFirstAt(text: string, index: number): boolean {
  if (!ORDINAL_AFTER_FIRST.test(text.slice(index))) return false
  const before = text.slice(Math.max(0, index - 10), index)
  return !CLAIM_CONTEXT_BEFORE.test(before)
}

/**
 * 文本里是否还有「未被序数豁免」的该词出现。
 *
 * 只有内置违禁词「第一」需要这个判断；其余词一律按出现即命中。
 */
function hasClaimOccurrence(word: string, text: string, builtinFirst: boolean): boolean {
  if (!builtinFirst) return text.includes(word)
  let index = text.indexOf(word)
  while (index >= 0) {
    if (!isOrdinalFirstAt(text, index)) return true
    index = text.indexOf(word, index + word.length)
  }
  return false
}

/** 该段是否包含需要命中的出现（用于按段展开） */
function segmentHasHit(word: string, segmentText: string, builtinFirst: boolean): boolean {
  return hasClaimOccurrence(word, segmentText, builtinFirst)
}

export function runHardCheck(input: HardCheckInput): HardCheckResult {
  const hits: HardCheckHit[] = []
  const text = input.text ?? ''

  // 1. 内置违禁词 + 用户禁用词（按段展开）
  const banned: string[] = [...BUILTIN_BANNED_WORDS]
  for (const w of input.bannedWords ?? []) {
    const word = String(w).trim()
    if (word) banned.push(word)
  }
  const userBanned = new Set((input.bannedWords ?? []).map((w) => String(w).trim()).filter(Boolean))
  for (const word of Array.from(new Set(banned))) {
    if (!word || !text.includes(word)) continue
    const builtinFirst = word === '第一' && !userBanned.has(word)

    if (input.segments?.length) {
      // 同一词出现在多段时每段各一条：否则 mustFixIds 只含第一段，
      // 其余段里的同一个词在「编辑只合并 targetIds」的约束下永远修不掉。
      const targets = input.segments.filter((segment) => segmentHasHit(word, segment.text, builtinFirst))
      if (!targets.length) continue
      for (const segment of targets) {
        hits.push({
          label: word,
          rule: userBanned.has(word) ? 'user-banned' : 'banned',
          segmentId: segment.id,
          detail: userBanned.has(word)
            ? '命中用户设置的禁用词'
            : builtinFirst
              ? '命中内置违禁词（此处不是「第一步」这类序数用法，属极限宣称）'
              : '命中内置违禁词',
        })
      }
      continue
    }

    if (!hasClaimOccurrence(word, text, builtinFirst)) continue
    hits.push({
      label: word,
      rule: userBanned.has(word) ? 'user-banned' : 'banned',
      segmentId: locate(word, input.segments),
      detail: userBanned.has(word) ? '命中用户设置的禁用词' : '命中内置违禁词',
    })
  }

  // 2. 必含词（全局规则：没有任何段可定位时由评审与编辑按全文补齐）
  for (const w of input.mustWords ?? []) {
    const word = String(w).trim()
    if (!word) continue
    if (!text.includes(word)) {
      hits.push({
        label: word,
        rule: 'must-word',
        detail: `必须出现的词「${word}」未在脚本中出现，需要挑一段自然补进去`,
      })
    }
  }

  // 3. 医疗与收益承诺
  for (const { label, re } of MEDICAL_OR_PROFIT_PATTERNS) {
    if (re.test(text)) {
      hits.push({ label, rule: 'medical-profit', segmentId: locate(label, input.segments), detail: '涉嫌医疗或收益承诺' })
    }
  }

  // 4. 虚假紧迫感（仅直播，且用户未提供真实库存信息）
  if (input.mode === 'live' && !input.hasStockInfo) {
    for (const { label, re } of FAKE_URGENCY_PATTERNS) {
      if (re.test(text)) {
        hits.push({ label, rule: 'fake-urgency', segmentId: locate(label, input.segments), detail: '用户未提供库存信息，涉嫌虚假紧迫感' })
      }
    }
  }

  // 5. 字数：总量与单段预算（同一口径）
  const counter = input.lengthCountMode === 'spoken' ? countSpokenChars : countChars
  const charCount = counter(text)
  if (input.targetChars && input.targetChars > 0) {
    const low = Math.round(input.targetChars * 0.85)
    const high = Math.round(input.targetChars * 1.15)
    if (charCount < low || charCount > high) {
      const over = charCount > high
      const delta = over ? charCount - high : low - charCount
      hits.push({
        label: `总字数 ${charCount}`,
        rule: 'length',
        detail: `目标 ${input.targetChars} 字（合格区间 ${low}–${high}），当前 ${charCount} 字，${over ? '超出上限' : '不足下限'} ${delta} 字`,
        length: {
          target: input.targetChars,
          low,
          high,
          direction: over ? 'over' : 'under',
          delta,
        },
      })
    }
  }
  const tolerance = input.segmentCharTolerance ?? 1.3
  for (const seg of input.segmentCharBudgets ?? []) {
    const segText = input.segments?.find((s) => s.id === seg.id)?.text
    if (!segText || !seg.budget) continue
    const used = counter(segText)
    if (used > seg.budget * tolerance) {
      hits.push({
        label: `第 ${seg.id} 段 ${used} 字`,
        rule: 'length',
        segmentId: seg.id,
        detail:
          tolerance === 1
            ? `超过 ${seg.budget} 字上限`
            : `超过该段字数预算 ${seg.budget} 的 ${Math.round(tolerance * 100)}%`,
      })
    }
  }

  // 6. 编造数据：口播里的数字必须能在允许来源（brief + 用户输入 + 检索结果）里找到
  const allowed = input.allowedNumberSources ?? ''
  const seenNumbers = new Set<string>()
  for (const match of Array.from(text.matchAll(NUMERIC_PATTERN))) {
    const token = match[0].replace(/\s+/g, '')
    if (seenNumbers.has(token)) continue
    seenNumbers.add(token)
    const bare = token.replace(/[^\d.]/g, '')
    // 来源里出现同样数字即视为可追溯
    if (allowed.includes(token) || (bare && allowed.includes(bare))) continue
    hits.push({
      label: token,
      rule: 'unsupported-number',
      segmentId: locate(match[0], input.segments),
      detail: '该数字未能在用户提供的信息或检索结果中找到来源',
    })
  }

  // 7. 短视频开场过度推销检测（首段严禁出现叫卖催单）
  if (input.mode === 'video' && input.segments && input.segments.length > 1) {
    const firstSeg = input.segments[0]
    const earlySellPattern = /(?:小黄车|拍下|现在就拍|抢到才算|抢到算你的|活动价只保今天|过点就恢复原价|恢复原价|想吃的别再犹豫|赶紧拍|链接在下方)/
    if (earlySellPattern.test(firstSeg.text)) {
      hits.push({
        label: '开场催单推销',
        rule: 'early-selling',
        segmentId: firstSeg.id,
        detail: '第 1 段生活场景中出现催单叫卖词汇，严重脱离生活情境，必须重写为生活背景或痛点',
      })
    }
  }

  // 8. 首尾段大面积雷同检测（防止编辑合并错位导致第1段与尾段一模一样）
  if (input.segments && input.segments.length >= 3) {
    const first = input.segments[0]?.text.trim() ?? ''
    const last = input.segments[input.segments.length - 1]?.text.trim() ?? ''
    if (first.length >= 15 && last.length >= 15 && (first === last || first.includes(last) || last.includes(first))) {
      hits.push({
        label: '首尾段文案雷同',
        rule: 'segment-duplicate',
        segmentId: input.segments[0].id,
        detail: '第 1 段与结尾段内容大面积雷同，属于无效重复或合并错位，必须修改',
      })
    }
  }

  // 9. 虚构福利活动检测（未提供真实活动信息时，正文严禁编造降价逼单）
  if (!input.hasStockInfo) {
    const fakeOfferPattern = /(?:活动价只保今天|今天下单.*立减|原价.*现价|前.*名送|拍一发[两三四五]|抢完恢复原价)/
    if (fakeOfferPattern.test(text)) {
      hits.push({
        label: '虚构促销福利',
        rule: 'fake-offer',
        segmentId: locate('活动价', input.segments) ?? locate('立减', input.segments) ?? locate('拍一发', input.segments),
        detail: '用户未提供促销活动信息，脚本中虚构了限时折扣或优惠活动',
      })
    }
  }

  const mustFixIds = Array.from(
    new Set(hits.map((h) => h.segmentId).filter((id): id is string => Boolean(id))),
  )

  return { pass: hits.length === 0, hits, mustFixIds, charCount }
}

/** 供 UI 展示的一句话摘要 */
export function hardCheckSummary(result: HardCheckResult): string {
  if (result.pass) return '通过'
  const words = Array.from(new Set(result.hits.map((h) => h.label)))
  return `${words.length} 处风险：${words.join('、')}`
}
