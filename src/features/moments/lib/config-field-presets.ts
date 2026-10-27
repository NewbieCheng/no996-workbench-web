import type { MomentsPlanningMode } from '../domain/moments'

const DAILY_BUSINESS_PURPOSE = [
  '让熟人先建立对日常生活的真实感，再自然进入互动与私聊。',
  '让用户先理解你的专业价值，再引导到咨询或体验环节。',
] as const

const THEME_BUSINESS_PURPOSE = [
  '让用户先理解这个产品能解决什么问题，再自然进入咨询和体验。',
  '把本周主题产品和真实场景绑在一起，降低硬广感。',
] as const

const DAILY_CORE_TASKS = [
  '围绕真实生活场景建立信任，减少生硬的产品介绍。',
  '保持稳定更新节奏，让熟人持续看到你的专业与状态。',
] as const

const THEME_CORE_TASKS = [
  '用场景和证据验证产品价值，铺垫本周的咨询或下单动作。',
  '完成从认知到意向的阶梯内容，避免一条圈讲完所有卖点。',
] as const

export function businessPurposePresets(mode: MomentsPlanningMode): readonly string[] {
  return mode === 'theme' ? THEME_BUSINESS_PURPOSE : DAILY_BUSINESS_PURPOSE
}

export function coreTasksPresets(mode: MomentsPlanningMode): readonly string[] {
  return mode === 'theme' ? THEME_CORE_TASKS : DAILY_CORE_TASKS
}
