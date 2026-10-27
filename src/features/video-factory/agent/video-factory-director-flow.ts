/**
 * 视频工厂 AI 导演流程定义
 *
 * 真正的 LLM 智能分镜编排：
 * 1. 结构分析与文稿断句
 * 2. 大模型导演：匹配最佳动效镜头 + 从文案中提炼镜头专有字段（主标题、高亮词、副标、数值）
 * 3. 确定性多轨时间轴编译
 */

import { defineFlow, type AgentStageDef } from '../../../agent'

export const VIDEO_FACTORY_DIRECTOR_FLOW_ID = 'video-factory-director-v1'

export const VIDEO_FACTORY_DIRECTOR_STAGES: AgentStageDef[] = [
  {
    id: 'parse-manuscript',
    order: 1,
    roleName: '文稿分析员',
    roleTag: '算法',
    kind: 'algo',
    principle: '规范化断句与场景切分，提取信息密度并计算时序意图基线。',
    headline: '正在进行剧本文案结构化切分…',
  },
  {
    id: 'ai-director',
    order: 2,
    roleName: '分镜导演',
    roleTag: 'AI',
    kind: 'model',
    profile: 'plan',
    principle: '理解行文节奏与叙事意图，挑选最佳动效镜头，并深度提炼每个镜头的主标题、副标与数据参数。',
    headline: 'AI 导演正在精选镜头并提炼动态排版与数据视觉…',
  },
  {
    id: 'compile-timeline',
    order: 3,
    roleName: '工程编译器',
    roleTag: '算法',
    kind: 'algo',
    principle: '校验分镜合法性，综合计算时间轴微秒坐标、音画同步基准，生成多轨原子命令。',
    headline: '正在确定性求解多轨时间轴与音画对齐…',
  },
]

defineFlow(VIDEO_FACTORY_DIRECTOR_FLOW_ID, VIDEO_FACTORY_DIRECTOR_STAGES)
