/**
 * 持久化组件实例数据契约（面向模板复用、局部替换与属性锁定）
 */

import type { AssemblyComponentId, AssemblyMotionId, AssemblyLayoutId, AssemblyStyleId } from './catalog.ts'
import type { TimeUs } from '../time.ts'

export type ComponentInstanceId = string

export type ComponentDataBinding = {
  kind: 'dataset' | 'asset' | 'caption' | 'text'
  targetId: string
  field: string
}

export type ComponentProvenance = {
  origin: 'template' | 'ai' | 'user'
  timestamp: number
  version: number
}

/**
 * 持久保存在工程模型中的受控组件实例
 */
export type ComponentInstance = {
  instanceId: ComponentInstanceId
  componentId: AssemblyComponentId
  propsVersion: number
  props: Record<string, unknown>
  bindings?: ComponentDataBinding[]
  lockedFields?: string[]
  provenance: ComponentProvenance
  motionId?: AssemblyMotionId
  motionDurationUs?: number
}

/**
 * 场景元数据定义（不另造时间轴，通过 elementIds 与 instanceIds 关联公共工程）
 */
export type SceneMetadata = {
  id: string
  name?: string
  layoutId: AssemblyLayoutId
  startUs: TimeUs
  durationUs: TimeUs
  componentInstanceIds: ComponentInstanceId[]
  locked?: boolean
}

/**
 * 模板数据包裹层（另存模板时剥离账号及私有绝对资源）
 */
export type VideoTemplateEnvelope = {
  version: 2
  templateId: string
  name: string
  category: string
  description?: string
  styleId: AssemblyStyleId
  durationUs: TimeUs
  scenes: SceneMetadata[]
  components: Record<ComponentInstanceId, ComponentInstance>
  // 槽位声明供新文案、素材与数据一键灌入复用
  slots: Array<{
    slotId: string
    name: string
    type: 'text' | 'image' | 'video' | 'audio' | 'chart-data'
    targetInstanceId: ComponentInstanceId
    targetField: string
    required: boolean
  }>
}
