import { isWorkbenchAiDemoMode } from '../../../api/workbench-ai'
import { polishProfileDocField } from '../../persona/agent/form-assist'
import { EMPTY_USER_FORM } from '../../../services/persona'

export type PolishMomentsContentDirectionInput = {
  value: string
  topic?: string
  mode: 'daily' | 'theme'
  allowedOptions: readonly string[]
  instruction?: string
  signal?: AbortSignal
  onPartial?: (text: string) => void
}

export async function polishMomentsContentDirection(input: PolishMomentsContentDirectionInput): Promise<string> {
  const topicLine = input.topic?.trim() ? `当前选题：${input.topic.trim()}` : ''
  const modeLine = input.mode === 'theme' ? '规划模式：主题 / 产品周' : '规划模式：日常内容周'
  const optionsLine = `可选方向标签（优先选用其一，可微调措辞但保持同类）：${input.allowedOptions.join('、')}`
  const extra = [modeLine, topicLine, optionsLine].filter(Boolean).join('\n')
  const instruction = [input.instruction?.trim(), extra].filter(Boolean).join('\n\n')

  if (isWorkbenchAiDemoMode()) {
    const current = input.value.trim()
    const pick = input.allowedOptions.find((o) => o === current) ?? input.allowedOptions[0] ?? current
    const result = instruction.includes('微调')
      ? `${pick || '专业价值'}（演示微调）`
      : pick || '专业价值'
    if (input.onPartial) {
      input.onPartial(result)
    }
    return result
  }

  return polishProfileDocField({
    fieldLabel: '朋友圈内容方向',
    value: input.value,
    form: EMPTY_USER_FORM,
    instruction,
    signal: input.signal,
    onPartial: input.onPartial,
  })
}

export type MomentsConfigFieldId = 'businessPurpose' | 'coreTasks'

export type PolishMomentsConfigFieldInput = {
  field: MomentsConfigFieldId
  fieldLabel: string
  value: string
  mode: 'daily' | 'theme'
  productName?: string
  activityName?: string
  relatedFieldLabel?: string
  relatedValue?: string
  presetHints?: readonly string[]
  instruction?: string
  signal?: AbortSignal
  onPartial?: (text: string) => void
}

const CONFIG_FIELD_ZH: Record<MomentsConfigFieldId, string> = {
  businessPurpose: '本周运营目的',
  coreTasks: '核心任务',
}

export async function polishMomentsConfigField(input: PolishMomentsConfigFieldInput): Promise<string> {
  const modeLine = input.mode === 'theme' ? '规划模式：主题 / 产品周' : '规划模式：日常内容周'
  const productLine = input.productName?.trim() ? `关联产品：${input.productName.trim()}` : ''
  const activityLine = input.activityName?.trim() ? `关联活动：${input.activityName.trim()}` : ''
  const relatedLine = input.relatedFieldLabel && input.relatedValue?.trim()
    ? `${input.relatedFieldLabel}：${input.relatedValue.trim()}`
    : ''
  const presetLine = input.presetHints?.length ? `可参考的表述示例：${input.presetHints.join('；')}` : ''
  const instruction = [input.instruction?.trim(), [modeLine, productLine, activityLine, relatedLine, presetLine].filter(Boolean).join('\n')].filter(Boolean).join('\n\n')
  const fieldLabel = CONFIG_FIELD_ZH[input.field] ?? input.fieldLabel

  if (isWorkbenchAiDemoMode()) {
    const current = input.value.trim()
    const fallback = input.presetHints?.[0] ?? `${fieldLabel}（演示补全）`
    const result = instruction.includes('简短') || instruction.includes('更短')
      ? (current || fallback).slice(0, 48) + (current.length > 48 ? '…' : '')
      : current
        ? `${current.replace(/[。．.]+$/u, '')}（演示润色）`
        : fallback
    input.onPartial?.(result)
    return result
  }

  return polishProfileDocField({
    fieldLabel: `朋友圈${fieldLabel}`,
    value: input.value,
    form: EMPTY_USER_FORM,
    instruction,
    signal: input.signal,
    onPartial: input.onPartial,
  })
}

export type PolishMomentsRevisionInput = {
  value: string
  mode: 'daily' | 'theme'
  businessPurpose: string
  coreTasks: string
  productName?: string
  activityName?: string
  instruction?: string
  signal?: AbortSignal
  onPartial?: (text: string) => void
}

export async function polishMomentsRevision(input: PolishMomentsRevisionInput): Promise<string> {
  const context = [
    `当前规划模式：${input.mode === 'theme' ? '主题推广周' : '日常经营周'}`,
    input.businessPurpose.trim() ? `本周经营目的：${input.businessPurpose.trim()}` : '',
    input.coreTasks.trim() ? `本周核心任务：${input.coreTasks.trim()}` : '',
    input.productName?.trim() ? `主推产品：${input.productName.trim()}` : '',
    input.activityName?.trim() ? `活动方案：${input.activityName.trim()}` : '',
    '请把用户意图整理成清晰、可执行的排期调整要求；保留用户提出的重点，不添加未提供的事实，不直接生成排期。',
  ].filter(Boolean).join('\n')
  const instruction = [input.instruction?.trim(), context].filter(Boolean).join('\n\n')
  return polishProfileDocField({
    fieldLabel: '朋友圈周排期整体修改要求',
    value: input.value,
    form: EMPTY_USER_FORM,
    instruction,
    signal: input.signal,
    onPartial: input.onPartial,
  })
}
