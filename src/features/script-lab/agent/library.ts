/**
 * 脚本结构库（内置）。
 *
 * 遵循《短视频带货脚本框架问题讨论与优化》：
 * 1. 默认采用三段式（吸引注意 → 传递价值 → 推动行动）底层逻辑；
 * 2. 彻底移除 i===0 暴力硬编码「前3秒下钩子」，改用 resolveSegmentPurpose 语义推导；
 * 3. 扩充家庭美食 Vlog 等真实创作结构。
 */
import type { LibraryHit, ScriptConfig, ScriptGoal, ScriptMode } from './types.ts'
import { resolveSegmentPurpose } from './semantic-rules.ts'

export type LibraryProvider = {
  search(query: {
    mode: ScriptMode
    goal: ScriptGoal
    durationSec: number
    /** 用户自定义结构（命中时优先级最高） */
    customStructure?: string
  }): LibraryHit[]
}

/** 兜底公式键：无法识别目标时用它，避免返回空结构 */
const FALLBACK_GOAL: ScriptGoal = '获客'

/** 视频：按目标选公式，各段 share 之和为 1 */
const VIDEO_FORMULAS: Record<ScriptGoal, LibraryHit> = {
  获客: {
    id: 'video-acquisition',
    formulaName: '痛点场景 + 身份共情 + 干货解法 + 留资引导',
    source: '内置脚本库 · 获客公式',
    segments: [
      { name: '痛点场景', purpose: '生活痛点切入，引发共鸣', share: 0.2 },
      { name: '身份共情', purpose: '建立同理心与信任', share: 0.22 },
      { name: '干货解法', purpose: '给出具体操作步骤', share: 0.38 },
      { name: '留资引导', purpose: '评论区互动与资料领取', share: 0.2 },
    ],
  },
  流量: {
    id: 'video-traffic',
    formulaName: '生活场景 + 悬念铺垫 + 反转揭晓 + 互动引导',
    source: '内置脚本库 · 流量公式',
    segments: [
      { name: '生活场景', purpose: '真实情境代入', share: 0.2 },
      { name: '悬念铺垫', purpose: '制造反差留住观众', share: 0.28 },
      { name: '反转揭晓', purpose: '展示惊喜与解密', share: 0.32 },
      { name: '互动引导', purpose: '促成评论与讨论', share: 0.2 },
    ],
  },
  成交: {
    id: 'video-conversion',
    formulaName: '生活场景 + 使用演示 + 卖点与证据 + 自然引导',
    source: '内置脚本库 · 带货公式',
    segments: [
      { name: '生活场景', purpose: '用真实生活场景交代受众与问题', share: 0.22 },
      { name: '使用演示', purpose: '展示真实使用步骤、过程与可用证据', share: 0.35 },
      { name: '卖点与证据', purpose: '区分产品事实、用户价值与佐证', share: 0.25 },
      { name: '自然引导', purpose: '收束内容并给出与目标一致的轻量行动', share: 0.18 },
    ],
  },
}

/** 直播：固定五章，按时长分配（10/25/20/30/15） */
const LIVE_FORMULA: LibraryHit = {
  id: 'live-five-chapter',
  formulaName: '开场暖场 → 产品介绍 → 痛点共鸣 → 促单环节 → 复盘收尾',
  source: '内置脚本库 · 直播固定五章',
  segments: [
    { name: '开场暖场', purpose: '留住划过人群，建立第一印象并拉升互动停留；为流动观众说明本场对象与主题', share: 0.1 },
    { name: '产品介绍', purpose: '讲透核心卖点与痛点解决，区分产品事实、用户价值和证据，树立购买信心', share: 0.25 },
    { name: '痛点共鸣', purpose: '结合真实生活场景深挖痛点与决策障碍，拉近心理距离', share: 0.2 },
    { name: '促单环节', purpose: '解释真实条件、证据与购买顾虑，给出清楚的行动；限时限量只在用户实际提供时出现，无福利也能完成', share: 0.3 },
    { name: '复盘收尾', purpose: '总结核心优势，引导点关注、加粉丝团及下场预告', share: 0.15 },
  ],
}

/** 视频公式拆解说明（结构行展开体用） */
export const VIDEO_STRUCTURE_DESC: Record<ScriptGoal, string> = {
  获客: '从具体生活痛点切入，给出干货解法，引导评论领取或咨询。',
  流量: '以生活日常或反常识切入，靠冲突反转引发完播与评论。',
  成交: '以真实生活场景与实际使用过程切入，用可核验证据展现产品价值，给出与目标一致的行动。',
}

/** 直播五章说明 */
export const LIVE_STRUCTURE_DESC = '默认使用固定五章，也可以选择直播模板或自定义环节；每章时间由宿主按占比分配。'

export const LIVE_CHAPTER_PURPOSES = LIVE_FORMULA.segments.map((s) => ({
  name: s.name,
  share: s.share,
  purpose: s.purpose,
}))

/** 视频三种目标对应的公式名（结构行按钮文案） */
export function videoFormulaName(goal: ScriptGoal): string {
  return VIDEO_FORMULAS[goal]?.formulaName ?? VIDEO_FORMULAS[FALLBACK_GOAL].formulaName
}

export type StructurePresetOption = {
  id: string
  label: string
  /** 展示用短标签（章节名） */
  segmentLabels: string[]
  /** 与 segmentLabels 等长的相对权重（可选，缺省均分） */
  shares?: number[]
  recommended?: boolean
}

export type VideoStructurePreset = StructurePresetOption
export type LiveStructurePreset = StructurePresetOption

/** 视频结构 preset（美食 Vlog 等） */
export const VIDEO_STRUCTURE_PRESETS: VideoStructurePreset[] = [
  {
    id: 'goal-auto',
    label: '推荐',
    segmentLabels: ['生活场景', '操作演示', '卖点与证据', '自然引导'],
    recommended: true,
  },
  {
    id: 'food-vlog',
    label: '美食Vlog',
    segmentLabels: ['人物对话', '烹饪过程', '产品植入', '互动收尾'],
    shares: [0.22, 0.32, 0.26, 0.2],
  },
  {
    id: 'story-twist',
    label: '故事反转',
    segmentLabels: ['生活引入', '真实经历', '意外转折', '心得号召'],
    shares: [0.2, 0.3, 0.3, 0.2],
  },
  {
    id: 'compare-review',
    label: '对比测评',
    segmentLabels: ['生活痛点', '自做对比', '配料证据', '总结推荐'],
    shares: [0.2, 0.32, 0.28, 0.2],
  },
  {
    id: 'list-seed',
    label: '清单种草',
    segmentLabels: ['场景引入', '要点一', '要点二', '要点三', '行动建议'],
    shares: [0.16, 0.26, 0.26, 0.18, 0.14],
  },
]

/** 直播结构模板：固定五章仍是推荐默认，其余模板和自定义结构共用同一套宿主锁定机制。 */
export const LIVE_STRUCTURE_PRESETS: LiveStructurePreset[] = [
  {
    id: 'live-five-chapter',
    label: '固定五章',
    segmentLabels: ['开场暖场', '产品介绍', '痛点共鸣', '促单环节', '复盘收尾'],
    shares: [0.1, 0.25, 0.2, 0.3, 0.15],
    recommended: true,
  },
  {
    id: 'live-single-product',
    label: '单品爆破',
    segmentLabels: ['开场留人', '痛点场景', '产品演示', '信任证据', '福利说明', '促单收尾'],
    shares: [0.1, 0.18, 0.24, 0.16, 0.14, 0.18],
  },
  {
    id: 'live-knowledge',
    label: '知识直播',
    segmentLabels: ['开场提问', '问题拆解', '方法讲解', '案例演示', '答疑互动', '复盘收尾'],
    shares: [0.1, 0.18, 0.26, 0.2, 0.14, 0.12],
  },
  {
    id: 'live-qna',
    label: '答疑直播',
    segmentLabels: ['开场暖场', '常见问题一', '常见问题二', '现场答疑', '行动引导', '复盘收尾'],
    shares: [0.1, 0.2, 0.2, 0.24, 0.14, 0.12],
  },
]

/** 直播自定义环节快捷选项 */
export const LIVE_STRUCTURE_QUICK_SEGMENTS = [
  '开场暖场',
  '产品介绍',
  '痛点共鸣',
  '互动问答',
  '实物演示',
  '信任证据',
  '福利发放',
  '促单环节',
  '答疑',
  '复盘收尾',
  '下场预告',
] as const

export function presetById(id: string): VideoStructurePreset | undefined {
  return VIDEO_STRUCTURE_PRESETS.find((p) => p.id === id)
}

export function livePresetById(id: string): LiveStructurePreset | undefined {
  return LIVE_STRUCTURE_PRESETS.find((p) => p.id === id)
}

/** Agent / 预览轨：从 config 解析自定义结构字符串 */
export function structureCustomText(config: {
  mode: ScriptMode
  goal: ScriptGoal
  structure: ScriptConfig['structure']
}): string | undefined {
  const { structure, goal, mode } = config
  if (structure.kind === 'custom' && structure.text?.trim()) {
    return structure.text.trim()
  }
  if (structure.kind === 'preset' && structure.presetId) {
    if (mode === 'live') {
      const livePreset = livePresetById(structure.presetId)
      if (livePreset) return livePreset.segmentLabels.join(' + ')
    }
    if (structure.presetId === 'goal-auto' && mode === 'video') {
      return VIDEO_FORMULAS[goal]?.formulaName ?? VIDEO_FORMULAS[FALLBACK_GOAL].formulaName
    }
    const preset = presetById(structure.presetId)
    if (preset) return preset.segmentLabels.join(' + ')
  }
  return undefined
}

/**
 * 内置检索：按模式与目标返回结构。
 * 用户自定义结构优先；返回结果始终带有 libraryIds，保证可追溯。
 */
export const builtinLibraryProvider: LibraryProvider = {
  search({ mode, goal, customStructure }) {
    if (customStructure?.trim()) {
      const names = customStructure
        .split(/[+＋,，、→>-]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const maxSegments = mode === 'live' ? 10 : 7
      if (names.length >= 2 && names.length <= maxSegments) {
        // 预设结构被展开成自定义字符串后，仍复用其份额与来源标签。
        const matchedPreset = [...VIDEO_STRUCTURE_PRESETS, ...LIVE_STRUCTURE_PRESETS].find(
          (p) => p.segmentLabels.join(' + ') === customStructure.trim(),
        )
        const total = names.length
        const segments = names.map((name, i) => {
          const semantic = resolveSegmentPurpose(name, i, total, mode)
          const presetShare = matchedPreset?.shares?.[i]
          return {
            name,
            purpose: semantic.purpose,
            share: presetShare ?? semantic.share,
          }
        })
        const shareSum = segments.reduce((sum, segment) => sum + segment.share, 0)
        return [
          {
            id: 'custom-structure',
            formulaName: customStructure.trim(),
            source: matchedPreset ? '内置脚本库 · ' + matchedPreset.label : '用户自定义结构',
            segments: shareSum > 0
              ? segments.map((segment) => ({ ...segment, share: segment.share / shareSum }))
              : segments.map((segment) => ({ ...segment, share: 1 / segments.length })),
          },
        ]
      }
    }
    if (mode === 'live') return [LIVE_FORMULA]
    const hit = VIDEO_FORMULAS[goal] ?? VIDEO_FORMULAS[FALLBACK_GOAL]
    return [hit]
  },
}

/** 当前生效的检索实现（后端就绪后在此替换） */
export let libraryProvider: LibraryProvider = builtinLibraryProvider

export function setLibraryProvider(next: LibraryProvider): void {
  libraryProvider = next
}
