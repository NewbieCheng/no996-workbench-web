/**
 * 声音与配音模块专享调试数据
 * 仅供本地开发调试（import.meta.env.DEV）快速填充高质量业务文案与一键模拟完整高阶配音分段生成结果，
 * 方便无网络或无需等待模型调用时快速走查视觉层次、音频彩带及分段编辑/试听交互。
 * 生产构建时此文件通过静态条件分析被 tree-shaking 剔除。
 */
import type { VoiceDubSegment } from '../agent/types'

export const DEV_VOICE_FIXTURE_INPUT = {
  title: '新一代效率工具发布会口播',
  docText: `大家好，今天给你们带来一款真正能省时间的新工具。
以前做短视频口播，录一段卡一次，配音又要逐句调语调，折腾一上午出不了一条片。
现在只要把文案往这一贴，AI 自动按情绪层次拆解，开场抓人、中间有力、结尾有号召力。
而且音色完全贴合真人呼吸感，听起来自然饱满，没有机械冷漠的电音味。
如果你也经常被视频配音折磨，不妨试试这个新方法，今天就开启高效创作！`,
  tonePreset: '热情' as const,
  voiceId: 'longanlingxin',
  rate: 1.05,
}

export const DEV_VOICE_FIXTURE_SEGMENTS: VoiceDubSegment[] = [
  {
    id: 'seg_dev_1',
    title: '开场抓人',
    text: '大家好，今天给你们带来一款真正能省时间的新工具。',
    instruction: '热情洋溢，语速稍快，像发布会开场，带一点微笑',
    estimatedSeconds: 6,
    status: 'done',
  },
  {
    id: 'seg_dev_2',
    title: '痛点共鸣',
    text: '以前做短视频口播，录一段卡一次，配音又要逐句调语调，折腾一上午出不了一条片。',
    instruction: '语调稍带无奈与困扰，语速平稳，引起创作者共鸣',
    estimatedSeconds: 8,
    status: 'done',
  },
  {
    id: 'seg_dev_3',
    title: '核心亮点',
    text: '现在只要把文案往这一贴，AI 自动按情绪层次拆解，开场抓人、中间有力、结尾有号召力。而且音色完全贴合真人呼吸感，听起来自然饱满，没有机械冷漠的电音味。',
    instruction: '从容自信，语调坚定上扬，重点突出呼吸感与自然度',
    estimatedSeconds: 12,
    status: 'done',
  },
  {
    id: 'seg_dev_4',
    title: '行动号召',
    text: '如果你也经常被视频配音折磨，不妨试试这个新方法，今天就开启高效创作！',
    instruction: '亲切真诚，语调上扬，富有号召力与感染力',
    estimatedSeconds: 5,
    status: 'done',
  },
]
