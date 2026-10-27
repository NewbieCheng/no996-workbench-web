import {
  ASSEMBLY_COMPONENT_CATALOG,
  ASSEMBLY_LAYOUTS,
  ASSEMBLY_MOTIONS,
  ASSEMBLY_STYLES,
  type AssemblyComponentId,
  type AssemblyLayoutId,
  type AssemblyMotionId,
  type AssemblyStyleId,
} from './catalog.ts'

export const ASSEMBLY_PLAN_VERSION = 1 as const
export const ASSEMBLY_PLAN_LIMITS = {
  maxJsonBytes: 65_536,
  maxScenes: 40,
  maxComponents: 100,
  maxComponentsPerScene: 20,
  maxSceneDurationUs: 300_000_000,
  maxTextCodePoints: 500,
  maxStepItems: 6,
  maxStepCodePoints: 100,
} as const

export class VideoAssemblyPlanError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'VideoAssemblyPlanError'
    this.code = code
  }
}

export type AssemblyComponentBase = {
  id: string
  componentId: AssemblyComponentId
  startOffsetUs: number
  durationUs: number
  motionId?: AssemblyMotionId
}

export type AssemblyTextComponent = AssemblyComponentBase & {
  componentId: 'title.opening' | 'title.chapter' | 'title.keyword'
  text: string
}

export type AssemblyCaptionComponent = AssemblyComponentBase & {
  componentId: 'caption.sentence'
  text: string
  timingSource: 'manual' | 'estimated'
}

export type AssemblyStepsComponent = AssemblyComponentBase & {
  componentId: 'info.steps'
  title: string
  items: string[]
}

export type AssemblyGenericComponent = AssemblyComponentBase & {
  componentId: Exclude<
    AssemblyComponentId,
    'title.opening' | 'title.chapter' | 'title.keyword' | 'caption.sentence' | 'info.steps'
  >
  props?: Record<string, unknown>
  text?: string
}

export type AssemblyComponent =
  | AssemblyTextComponent
  | AssemblyCaptionComponent
  | AssemblyStepsComponent
  | AssemblyGenericComponent

export type AssemblyScene = {
  id: string
  startUs: number
  durationUs: number
  layoutId: AssemblyLayoutId
  components: AssemblyComponent[]
}

/**
 * 纯数据建议。它不是 EditorDocument，也不能被当作 React/HTML/脚本执行。
 * v1 当前只接受目录里已实现的文本/句字幕组件。
 */
export type VideoAssemblyPlan = {
  version: typeof ASSEMBLY_PLAN_VERSION
  planId: string
  documentId: string
  baseRevision: number
  styleId: AssemblyStyleId
  scenes: AssemblyScene[]
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const ROOT_KEYS = ['version', 'planId', 'documentId', 'baseRevision', 'styleId', 'scenes']
const SCENE_KEYS = ['id', 'startUs', 'durationUs', 'layoutId', 'components']

function fail(code: string, message: string): never {
  throw new VideoAssemblyPlanError(code, message)
}

function objectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('INVALID_OBJECT', `${path} 必须是 JSON 对象`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return fail('INVALID_OBJECT', `${path} 必须是普通 JSON 对象`)
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !('value' in descriptors[key]) || !descriptors[key].enumerable) {
      return fail('INVALID_OBJECT', `${path} 不允许 Symbol、隐藏字段或访问器属性`)
    }
  }
  return value as Record<string, unknown>
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string
): void {
  const allowed = new Set([...required, ...optional])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('UNKNOWN_FIELD', `${path} 含不支持的字段: ${key}`)
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail('MISSING_FIELD', `${path} 缺少字段: ${key}`)
    }
  }
}

function safeId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    return fail('INVALID_ID', `${path} 必须为 1–64 位字母、数字、点、下划线或连字符 ID`)
  }
  return value
}

function safeTime(value: unknown, path: string, allowZero: boolean): number {
  if (!Number.isSafeInteger(value) || (value as number) < (allowZero ? 0 : 1)) {
    return fail('INVALID_TIME', `${path} 必须是${allowZero ? '非负' : '正'}安全整数微秒`)
  }
  return value as number
}

function safeText(value: unknown, path: string, maxCodePoints: number): string {
  if (typeof value !== 'string') return fail('INVALID_TEXT', `${path} 必须是字符串`)
  const text = value.trim()
  if (!text) return fail('EMPTY_TEXT', `${path} 不能为空`)
  if (Array.from(text).length > maxCodePoints) {
    return fail('TEXT_OVERFLOW', `${path} 最多允许 ${maxCodePoints} 个字符`)
  }
  if (/[\r\n\u0000]/u.test(text)) {
    return fail('INVALID_TEXT', `${path} 当前只支持单行普通文本`)
  }
  return text
}

function componentMotion(value: unknown, componentId: AssemblyComponentId, path: string): AssemblyMotionId | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(ASSEMBLY_MOTIONS, value)) {
    return fail('UNKNOWN_MOTION', `${path} 不是已登记的动效`)
  }
  const motionId = value as AssemblyMotionId
  const definition = ASSEMBLY_COMPONENT_CATALOG[componentId]
  if (!definition.allowedMotions.includes(motionId)) {
    return fail('MOTION_NOT_ALLOWED', `${componentId} 不允许使用 ${motionId}`)
  }
  return motionId
}

function parseComponent(value: unknown, path: string): AssemblyComponent {
  const record = objectRecord(value, path)
  const componentId = record.componentId
  if (typeof componentId !== 'string' || !Object.prototype.hasOwnProperty.call(ASSEMBLY_COMPONENT_CATALOG, componentId)) {
    return fail('UNKNOWN_COMPONENT', `${path}.componentId 不是当前已实现的组件`)
  }
  const typedId = componentId as AssemblyComponentId
  const allowedMotionKey = ['motionId']
  const commonRequired = ['id', 'componentId', 'startOffsetUs', 'durationUs']

  switch (typedId) {
    case 'title.opening':
    case 'title.chapter':
    case 'title.keyword': {
      exactKeys(record, [...commonRequired, 'text'], allowedMotionKey, path)
      return {
        id: safeId(record.id, `${path}.id`),
        componentId: typedId,
        startOffsetUs: safeTime(record.startOffsetUs, `${path}.startOffsetUs`, true),
        durationUs: safeTime(record.durationUs, `${path}.durationUs`, false),
        text: safeText(record.text, `${path}.text`, ASSEMBLY_PLAN_LIMITS.maxTextCodePoints),
        ...(componentMotion(record.motionId, typedId, `${path}.motionId`) ? { motionId: record.motionId as AssemblyMotionId } : {}),
      }
    }
    case 'caption.sentence': {
      exactKeys(record, [...commonRequired, 'text', 'timingSource'], allowedMotionKey, path)
      if (record.motionId !== undefined) {
        fail('MOTION_NOT_ALLOWED', '句字幕当前不支持独立动效')
      }
      if (record.timingSource !== 'manual' && record.timingSource !== 'estimated') {
        fail('INVALID_TIMING_SOURCE', `${path}.timingSource 只能是 manual 或 estimated`)
      }
      return {
        id: safeId(record.id, `${path}.id`),
        componentId: typedId,
        startOffsetUs: safeTime(record.startOffsetUs, `${path}.startOffsetUs`, true),
        durationUs: safeTime(record.durationUs, `${path}.durationUs`, false),
        text: safeText(record.text, `${path}.text`, ASSEMBLY_PLAN_LIMITS.maxTextCodePoints),
        timingSource: record.timingSource,
      }
    }
    case 'info.steps': {
      exactKeys(record, [...commonRequired, 'title', 'items'], allowedMotionKey, path)
      if (record.motionId !== undefined && record.motionId !== 'motion.step-focus') {
        fail('MOTION_NOT_ALLOWED', '步骤卡只允许 motion.step-focus')
      }
      if (!Array.isArray(record.items) || record.items.length < 1 || record.items.length > ASSEMBLY_PLAN_LIMITS.maxStepItems) {
        fail('INVALID_STEPS', `${path}.items 必须包含 1–${ASSEMBLY_PLAN_LIMITS.maxStepItems} 项`)
      }
      return {
        id: safeId(record.id, `${path}.id`),
        componentId: typedId,
        startOffsetUs: safeTime(record.startOffsetUs, `${path}.startOffsetUs`, true),
        durationUs: safeTime(record.durationUs, `${path}.durationUs`, false),
        title: safeText(record.title, `${path}.title`, 80),
        items: record.items.map((item, index) => safeText(item, `${path}.items[${index}]`, ASSEMBLY_PLAN_LIMITS.maxStepCodePoints)),
        ...(record.motionId === 'motion.step-focus' ? { motionId: 'motion.step-focus' as const } : {}),
      }
    }
    default: {
      // 通用 32 组件结构化支持：自动校验白名单中的组件
      const definition = ASSEMBLY_COMPONENT_CATALOG[typedId]
      const validProps: Record<string, unknown> = {}
      for (const field of definition.editableFields) {
        if (field in record && record[field] !== undefined) {
          validProps[field] = record[field]
        }
      }
      return {
        id: safeId(record.id, `${path}.id`),
        componentId: typedId as any,
        startOffsetUs: safeTime(record.startOffsetUs, `${path}.startOffsetUs`, true),
        durationUs: safeTime(record.durationUs, `${path}.durationUs`, false),
        props: validProps,
        text: typeof record.text === 'string' ? safeText(record.text, `${path}.text`, ASSEMBLY_PLAN_LIMITS.maxTextCodePoints) : undefined,
        ...(record.motionId && componentMotion(record.motionId, typedId, `${path}.motionId`)
          ? { motionId: record.motionId as AssemblyMotionId }
          : {}),
      }
    }
  }
}

/**
 * 校验模型/导入数据。未知字段、未知组件和可执行对象一律拒绝，不做猜测或回退。
 */
export function validateVideoAssemblyPlan(input: unknown): VideoAssemblyPlan {
  let candidate = input
  if (typeof candidate === 'string') {
    if (new TextEncoder().encode(candidate).byteLength > ASSEMBLY_PLAN_LIMITS.maxJsonBytes) {
      return fail('PLAN_TOO_LARGE', '组装计划超过大小限制')
    }
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return fail('INVALID_JSON', '组装计划不是合法 JSON')
    }
  }

  const root = objectRecord(candidate, 'plan')
  exactKeys(root, ROOT_KEYS, [], 'plan')
  if (root.version !== ASSEMBLY_PLAN_VERSION) {
    return fail('UNSUPPORTED_PLAN_VERSION', `不支持组装计划版本: ${String(root.version)}`)
  }
  const planId = safeId(root.planId, 'plan.planId')
  const documentId = safeId(root.documentId, 'plan.documentId')
  if (!Number.isSafeInteger(root.baseRevision) || (root.baseRevision as number) < 1) {
    return fail('INVALID_BASE_REVISION', 'plan.baseRevision 必须是正安全整数')
  }
  if (typeof root.styleId !== 'string' || !Object.prototype.hasOwnProperty.call(ASSEMBLY_STYLES, root.styleId)) {
    return fail('UNKNOWN_STYLE', 'plan.styleId 不是当前已实现的风格')
  }
  if (!Array.isArray(root.scenes) || root.scenes.length < 1 || root.scenes.length > ASSEMBLY_PLAN_LIMITS.maxScenes) {
    return fail('INVALID_SCENES', `plan.scenes 必须包含 1–${ASSEMBLY_PLAN_LIMITS.maxScenes} 个场景`)
  }

  const sceneIds = new Set<string>()
  const componentIds = new Set<string>()
  let previousSceneEnd = 0
  let componentCount = 0
  const scenes: AssemblyScene[] = root.scenes.map((value, sceneIndex) => {
    const path = `plan.scenes[${sceneIndex}]`
    const scene = objectRecord(value, path)
    exactKeys(scene, SCENE_KEYS, [], path)
    const id = safeId(scene.id, `${path}.id`)
    if (sceneIds.has(id)) fail('DUPLICATE_SCENE_ID', `场景 ID 重复: ${id}`)
    sceneIds.add(id)

    const startUs = safeTime(scene.startUs, `${path}.startUs`, true)
    const durationUs = safeTime(scene.durationUs, `${path}.durationUs`, false)
    const endUs = startUs + durationUs
    if (!Number.isSafeInteger(endUs) || endUs > ASSEMBLY_PLAN_LIMITS.maxSceneDurationUs) {
      fail('DURATION_OVERFLOW', `${path} 超过 300 秒计划时长上限`)
    }
    if (startUs < previousSceneEnd) fail('SCENE_OVERLAP', '首批组件暂不支持重叠场景')
    previousSceneEnd = endUs

    if (scene.layoutId !== 'layout.type-led' || !Object.prototype.hasOwnProperty.call(ASSEMBLY_LAYOUTS, scene.layoutId)) {
      fail('UNKNOWN_LAYOUT', `${path}.layoutId 不是当前已实现的布局`)
    }
    if (!Array.isArray(scene.components) || scene.components.length < 1 || scene.components.length > ASSEMBLY_PLAN_LIMITS.maxComponentsPerScene) {
      fail('INVALID_COMPONENTS', `${path}.components 必须包含 1–${ASSEMBLY_PLAN_LIMITS.maxComponentsPerScene} 个组件`)
    }

    const components = scene.components.map((item, componentIndex) => {
      const component = parseComponent(item, `${path}.components[${componentIndex}]`)
      if (componentIds.has(component.id)) fail('DUPLICATE_COMPONENT_ID', `组件实例 ID 重复: ${component.id}`)
      componentIds.add(component.id)
      const componentEnd = component.startOffsetUs + component.durationUs
      if (!Number.isSafeInteger(componentEnd) || componentEnd > durationUs) {
        fail('COMPONENT_OUTSIDE_SCENE', `组件 ${component.id} 超出场景时长`)
      }
      if (component.motionId) {
        const motion = ASSEMBLY_MOTIONS[component.motionId]
        const requiredMotionDuration = component.componentId === 'info.steps' && component.motionId === 'motion.step-focus'
          ? ((component as AssemblyStepsComponent).items.length + 1) * motion.durationUs
          : motion.durationUs
        if (component.durationUs < requiredMotionDuration) {
          fail('MOTION_DURATION_TOO_SHORT', `组件 ${component.id} 至少需要 ${requiredMotionDuration} 微秒才能播放 ${component.motionId}`)
        }
      }
      return component
    })

    componentCount += components.length
    if (componentCount > ASSEMBLY_PLAN_LIMITS.maxComponents) {
      fail('COMPONENTS_OVERFLOW', `组装计划最多允许 ${ASSEMBLY_PLAN_LIMITS.maxComponents} 个组件实例`)
    }
    return { id, startUs, durationUs, layoutId: scene.layoutId, components }
  })

  const normalized: VideoAssemblyPlan = {
    version: ASSEMBLY_PLAN_VERSION,
    planId,
    documentId,
    baseRevision: root.baseRevision as number,
    styleId: root.styleId as AssemblyStyleId,
    scenes,
  }
  const serialized = JSON.stringify(normalized)
  if (new TextEncoder().encode(serialized).byteLength > ASSEMBLY_PLAN_LIMITS.maxJsonBytes) {
    return fail('PLAN_TOO_LARGE', '组装计划超过大小限制')
  }
  return normalized
}

export function parseVideoAssemblyPlan(json: string): VideoAssemblyPlan {
  if (typeof json !== 'string') return fail('INVALID_JSON', '组装计划必须是 JSON 字符串')
  return validateVideoAssemblyPlan(json)
}
