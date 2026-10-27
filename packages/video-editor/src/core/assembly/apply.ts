import type { Command, CommandResult } from '../commands/base.ts'
import type { EditorInstance } from '../instance.ts'
import { cloneDocument } from '../serialization.ts'
import type {
  CaptionCue,
  EditorDocument,
  ElementGroup,
  ElementAnimations,
  TextClipElement,
  TextStyle,
  TimelineTrack,
} from '../project.ts'
import { frameIndexToTimeUs } from '../time.ts'
import { ASSEMBLY_COMPONENT_CATALOG, ASSEMBLY_MOTIONS, ASSEMBLY_TEXT_THEME, type AssemblyTextStyle } from './catalog.ts'
import { validateVideoAssemblyPlan, VideoAssemblyPlanError, type AssemblyComponent, type AssemblyScene, type VideoAssemblyPlan } from './plan.ts'

export type VideoAssemblySummary = {
  sceneCount: number
  componentCount: number
  textElementCount: number
  captionCount: number
  baseRevision: number
}

export type PreparedVideoAssembly = Readonly<{
  planId: string
  documentId: string
  baseRevision: number
  previewDocument: EditorDocument
  summary: VideoAssemblySummary
}>

type PreparedState = {
  command: ApplyVideoAssemblyCommand
  documentId: string
  baseRevision: number
}

const preparedStates = new WeakMap<object, PreparedState>()
const MIN_FONT_SIZE = 32
const MAX_FONT_SIZE = 84

type SupportedMotion = 'motion.fade-in' | 'motion.step-focus'

function fail(code: string, message: string): never {
  throw new VideoAssemblyPlanError(code, message)
}

function safeTextTrack(document: EditorDocument): TimelineTrack {
  const track = document.tracks.find((item) => item.id === 'track-title-text' && !item.locked)
    ?? document.tracks.find((item) => item.type === 'text' && !item.locked)
    ?? document.tracks.find((item) => item.type === 'overlay' && !item.locked)
  if (!track) return fail('TEXT_TRACK_UNAVAILABLE', '工程中没有可写入文字的轨道')
  return track
}

function textUnits(text: string): number {
  let units = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    units += code >= 0x2e80 || (code >= 0x1f300 && code <= 0x1faff) ? 1 : 0.56
  }
  return Math.max(units, 1)
}

function fitFontSize(text: string, width: number, preferred: number): number {
  const fitted = Math.min(preferred, Math.floor(width / (textUnits(text) * 1.08)))
  if (fitted < MIN_FONT_SIZE) {
    return fail('TEXT_DOES_NOT_FIT', '文字过长，当前安全区内无法保持可读字号；请拆分场景或缩短文案')
  }
  return Math.min(MAX_FONT_SIZE, fitted)
}

function resolveTextStyle(
  componentId: AssemblyComponent['componentId'],
  text: string,
  width: number
): AssemblyTextStyle {
  const isOpening = componentId === 'title.opening'
  const isKeyword = componentId === 'title.keyword'
  return {
    font: ASSEMBLY_TEXT_THEME.font,
    size: fitFontSize(text, width, isOpening ? 78 : 62),
    weight: isOpening || isKeyword ? 800 : 700,
    color: isKeyword ? ASSEMBLY_TEXT_THEME.accent : ASSEMBLY_TEXT_THEME.primary,
    outlineColor: ASSEMBLY_TEXT_THEME.outline,
    outlineWidth: 3,
    align: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
  }
}

function makeTextStyle(style: AssemblyTextStyle): TextStyle {
  return { ...style, backgroundColor: '' }
}

function fadeAnimations(durationUs: number, offsetUs = 0, motionId: SupportedMotion = 'motion.fade-in'): ElementAnimations {
  const motion = ASSEMBLY_MOTIONS[motionId]
  if (offsetUs < 0 || offsetUs + motion.durationUs > durationUs) {
    fail('MOTION_DURATION_TOO_SHORT', `动效 ${motionId} 超出文字元素可用时长`)
  }
  return {
    channels: {
      'transform.opacity': {
        propertyPath: 'transform.opacity',
        keyframes: [
          { id: `fade-start-${offsetUs}`, timeUs: offsetUs, value: 0, easing: 'linear' },
          { id: `fade-end-${offsetUs}`, timeUs: offsetUs + motion.durationUs, value: 1, easing: motion.easing },
        ],
      },
    },
  }
}

function layoutText(
  document: EditorDocument,
  scene: AssemblyScene,
  component: AssemblyComponent,
  text: string,
  elementId: string,
  trackId: string,
  options: { rowIndex?: number; rowCount?: number; groupId?: string; motionId?: SupportedMotion; motionOffsetUs?: number } = {}
): TextClipElement {
  const { width: canvasWidth, height: canvasHeight } = document.canvas
  const margin = Math.max(40, Math.round(canvasWidth * 0.075))
  const boxWidth = canvasWidth - margin * 2
  const startUs = scene.startUs + component.startOffsetUs
  const rowCount = Math.max(1, options.rowCount ?? 1)
  const rowIndex = options.rowIndex ?? 0
  const preferredSize = component.componentId === 'title.opening' ? 78 : 62
  const size = fitFontSize(text, boxWidth, preferredSize)
  const rowHeight = Math.max(size * 1.7, Math.min(140, canvasHeight * 0.12))
  const top = component.componentId === 'title.opening'
    ? Math.round(canvasHeight * 0.16)
    : component.componentId === 'title.keyword'
      ? Math.round(canvasHeight * 0.62)
      : (component.componentId === 'info.steps' || options.groupId)
        ? Math.round(canvasHeight * 0.26 + (canvasHeight * 0.48 * rowIndex) / rowCount)
        : Math.round(canvasHeight * 0.2)
  const height = Math.max(size * 1.55, rowHeight)
  const textStyle = resolveTextStyle(component.componentId, text, boxWidth)
  const animations = options.motionId
    ? fadeAnimations(component.durationUs, options.motionOffsetUs ?? 0, options.motionId)
    : undefined

  return {
    id: elementId,
    trackId,
    type: 'text',
    text,
    startUs,
    durationUs: component.durationUs,
    groupId: options.groupId,
    style: makeTextStyle(textStyle),
    transform: {
      x: margin,
      y: Math.max(0, Math.min(canvasHeight - height, top)),
      width: boxWidth,
      height,
      rotationDeg: 0,
      opacity: 1,
      cropMode: 'contain',
      round: 0,
    },
    animations,
  }
}

function compileTextElements(
  document: EditorDocument,
  scene: AssemblyScene,
  component: AssemblyComponent,
  trackId: string
): { elements: TextClipElement[]; group?: ElementGroup } {
  if (component.componentId === 'caption.sentence') return { elements: [] }

  if (component.componentId === 'info.steps') {
    const groupId = `assembly:${document.id}:${component.id}`
    const heading: AssemblyComponent = {
      id: `${component.id}-heading`,
      componentId: 'title.chapter',
      startOffsetUs: component.startOffsetUs,
      durationUs: component.durationUs,
      text: component.title,
    }
    const elements = [layoutText(document, scene, heading, component.title,
      `assembly:${document.id}:${component.id}:heading`, trackId, { rowIndex: 0, rowCount: component.items.length + 1, groupId })]

    component.items.forEach((item, index) => {
      const row: AssemblyComponent = {
        id: `${component.id}-step-${index + 1}`,
        componentId: 'title.chapter',
        startOffsetUs: component.startOffsetUs,
        durationUs: component.durationUs,
        text: `${index + 1}. ${item}`,
      }
      const motionOffsetUs = (index + 1) * ASSEMBLY_MOTIONS['motion.step-focus'].durationUs
      elements.push(layoutText(document, scene, row, row.text,
        `assembly:${document.id}:${component.id}:step:${index + 1}`, trackId, {
          rowIndex: index + 1,
          rowCount: component.items.length + 1,
          groupId,
          ...(component.motionId === 'motion.step-focus' ? { motionId: 'motion.step-focus', motionOffsetUs } : {}),
        }))
    })

    if (component.motionId === 'motion.step-focus') {
      const motionDurationUs = ASSEMBLY_MOTIONS['motion.step-focus'].durationUs
      const requiredDurationUs = component.items.length * motionDurationUs + motionDurationUs
      if (component.durationUs < requiredDurationUs) {
        fail('MOTION_DURATION_TOO_SHORT', `步骤卡至少需要 ${requiredDurationUs} 微秒，才能依次显现全部内容`)
      }
      elements[0].animations = fadeAnimations(component.durationUs, 0, 'motion.step-focus')
    }

    return {
      elements,
      group: { id: groupId, name: component.title, elementIds: elements.map((element) => element.id) },
    }
  }

  const elementId = `assembly:${document.id}:${component.id}`
  const displayText = 'text' in component && typeof component.text === 'string'
    ? component.text
    : ('props' in component && component.props && typeof component.props.title === 'string'
      ? component.props.title
      : ASSEMBLY_COMPONENT_CATALOG[component.componentId]?.label || component.componentId)

  return {
    elements: [layoutText(document, scene, component, displayText, elementId, trackId,
      component.motionId === 'motion.fade-in' ? { motionId: 'motion.fade-in' } : {})],
  }
}

function compileCaptions(scenes: AssemblyScene[]): CaptionCue[] {
  const captions: CaptionCue[] = []
  for (const scene of scenes) {
    for (const component of scene.components) {
      if (component.componentId !== 'caption.sentence') continue
      captions.push({
        id: `assembly:${scene.id}:${component.id}`,
        startUs: scene.startUs + component.startOffsetUs,
        durationUs: component.durationUs,
        text: component.text,
        timingSource: component.timingSource,
      })
    }
  }
  return captions
}

function updateDuration(document: EditorDocument): void {
  let endUs = document.durationUs
  for (const track of document.tracks) {
    for (const element of track.elements) endUs = Math.max(endUs, element.startUs + element.durationUs)
  }
  for (const caption of document.captions) endUs = Math.max(endUs, caption.startUs + caption.durationUs)
  document.durationUs = endUs
}

class ApplyVideoAssemblyCommand implements Command {
  readonly id: string
  readonly type = 'ApplyVideoAssemblyPlan'
  private readonly baseDocumentId: string
  private readonly baseRevision: number
  private readonly textElements: TextClipElement[]
  private readonly captions: CaptionCue[]
  private readonly groups: ElementGroup[]
  private previousDurationUs = 0
  private firstExecution = true
  private applied = false

  constructor(input: {
    planId: string
    documentId: string
    baseRevision: number
    textElements: TextClipElement[]
    captions: CaptionCue[]
    groups: ElementGroup[]
  }) {
    this.id = `assembly-command:${input.planId}`
    this.baseDocumentId = input.documentId
    this.baseRevision = input.baseRevision
    this.textElements = input.textElements
    this.captions = input.captions
    this.groups = input.groups
  }

  private buildCandidate(document: EditorDocument): EditorDocument {
    const doc = cloneDocument(document)
    const elementIds = new Set(this.textElements.map((element) => element.id))
    const captionIds = new Set(this.captions.map((caption) => caption.id))

    for (const track of doc.tracks) {
      for (const element of track.elements) {
        if (elementIds.has(element.id)) fail('DUPLICATE_ELEMENT_ID', `工程已存在元素 ID: ${element.id}`)
      }
    }
    for (const caption of doc.captions) {
      if (captionIds.has(caption.id)) fail('DUPLICATE_CAPTION_ID', `工程已存在字幕 ID: ${caption.id}`)
    }
    for (const group of this.groups) {
      if (Object.prototype.hasOwnProperty.call(doc.groups, group.id)) fail('DUPLICATE_GROUP_ID', `工程已存在分组 ID: ${group.id}`)
    }

    for (const element of this.textElements) {
      const track = doc.tracks.find((item) => item.id === element.trackId)
      if (!track || track.locked) fail('TEXT_TRACK_UNAVAILABLE', `文字轨道不可用: ${element.trackId}`)
      track.elements.push(element)
      track.elements.sort((a, b) => a.startUs - b.startUs)
    }
    doc.captions.push(...this.captions)
    for (const group of this.groups) doc.groups[group.id] = group
    updateDuration(doc)
    return doc
  }

  preview(document: EditorDocument): EditorDocument {
    return this.buildCandidate(document)
  }

  execute(document: EditorDocument): CommandResult {
    if (this.firstExecution && (document.id !== this.baseDocumentId || document.revision !== this.baseRevision)) {
      fail('DOCUMENT_REVISION_CONFLICT', '工程在生成预览后已变化；请重新生成或刷新预览')
    }
    const candidate = this.buildCandidate(document)
    this.previousDurationUs = document.durationUs
    this.firstExecution = false
    this.applied = true
    return {
      document: candidate,
      selectionOverride: this.textElements.map((element) => element.id),
    }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.applied) fail('ASSEMBLY_NOT_APPLIED', '尚未应用的组装计划不能撤销')
    const doc = cloneDocument(document)
    const textIds = new Set(this.textElements.map((element) => element.id))
    for (const track of doc.tracks) track.elements = track.elements.filter((element) => !textIds.has(element.id))
    const captionIds = new Set(this.captions.map((caption) => caption.id))
    doc.captions = doc.captions.filter((caption) => !captionIds.has(caption.id))
    for (const group of this.groups) delete doc.groups[group.id]
    doc.durationUs = this.previousDurationUs
    this.applied = false
    return { document: doc, selectionOverride: [] }
  }
}

/**
 * 校验并准备一份纯数据组装计划。
 * previewDocument 是副本；正式应用必须调用 applyVideoAssemblyPlan，经编辑器命令/撤销系统提交。
 */
export function prepareVideoAssemblyPlan(
  document: EditorDocument,
  rawPlan: unknown
): PreparedVideoAssembly {
  const plan: VideoAssemblyPlan = validateVideoAssemblyPlan(rawPlan)
  if (document.id !== plan.documentId) fail('DOCUMENT_ID_MISMATCH', '组装计划目标工程与当前工程不匹配')
  if (document.revision !== plan.baseRevision) fail('DOCUMENT_REVISION_CONFLICT', '工程已变化；请以当前版本重新生成计划')

  const minFrameUs = frameIndexToTimeUs(1, document.canvas.fps)
  if (!Number.isSafeInteger(minFrameUs) || minFrameUs < 1) fail('INVALID_FRAME_RATE', '工程帧率不合法')
  const textComponents = plan.scenes.flatMap((scene) => scene.components.filter((component) => component.componentId !== 'caption.sentence'))
  const track = textComponents.length > 0 ? safeTextTrack(document) : undefined
  const textElements: TextClipElement[] = []
  const groups: ElementGroup[] = []

  for (const scene of plan.scenes) {
    for (const component of scene.components) {
      if (component.durationUs < minFrameUs) {
        fail('ELEMENT_DURATION_TOO_SHORT', `组件 ${component.id} 小于当前工程的一帧时长`)
      }
      const compiled = compileTextElements(document, scene, component, track?.id ?? '')
      textElements.push(...compiled.elements)
      if (compiled.group) groups.push(compiled.group)
    }
  }

  const captions = compileCaptions(plan.scenes)
  const existingElementIds = new Set(document.tracks.flatMap((item) => item.elements.map((element) => element.id)))
  for (const element of textElements) {
    if (existingElementIds.has(element.id)) fail('DUPLICATE_ELEMENT_ID', `工程已存在元素 ID: ${element.id}`)
  }
  const existingCaptionIds = new Set(document.captions.map((caption) => caption.id))
  for (const caption of captions) {
    if (existingCaptionIds.has(caption.id)) fail('DUPLICATE_CAPTION_ID', `工程已存在字幕 ID: ${caption.id}`)
  }

  const command = new ApplyVideoAssemblyCommand({
    planId: plan.planId,
    documentId: plan.documentId,
    baseRevision: plan.baseRevision,
    textElements,
    captions,
    groups,
  })
  const prepared: PreparedVideoAssembly = Object.freeze({
    planId: plan.planId,
    documentId: plan.documentId,
    baseRevision: plan.baseRevision,
    previewDocument: cloneDocument(command.preview(document)),
    summary: Object.freeze({
      sceneCount: plan.scenes.length,
      componentCount: plan.scenes.reduce((sum, scene) => sum + scene.components.length, 0),
      textElementCount: textElements.length,
      captionCount: captions.length,
      baseRevision: plan.baseRevision,
    }),
  })
  preparedStates.set(prepared, { command, documentId: plan.documentId, baseRevision: plan.baseRevision })
  return prepared
}

/** Apply one already-prepared plan as a single undoable EditorInstance command. */
export function applyVideoAssemblyPlan(
  editor: Pick<EditorInstance, 'getDocument' | 'executeCommand'>,
  prepared: PreparedVideoAssembly
): CommandResult {
  const state = preparedStates.get(prepared)
  if (!state) fail('INVALID_PREPARATION', '组装预览不是由当前进程的安全准备器生成')
  const current = editor.getDocument()
  if (current.id !== state.documentId || current.revision !== state.baseRevision) {
    fail('DOCUMENT_REVISION_CONFLICT', '工程在预览后已变化；未应用组装计划')
  }
  return editor.executeCommand(state.command)
}
