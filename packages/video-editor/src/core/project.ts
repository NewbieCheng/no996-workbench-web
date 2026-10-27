/**
 * 通用工程文档模型（EditorDocument v1）
 * 彻底统一剪辑器数据标准，全面承载多轨、空间变换、关键帧、滤镜、蒙版、转场与字幕。
 */

import type { FrameRate, TimeUs } from './time.ts'

export const CURRENT_DOCUMENT_SCHEMA_VERSION = 1

export type CanvasRatio = '9:16' | '16:9' | '1:1' | '3:4' | '4:3' | 'custom'

export type CanvasSettings = {
  width: number
  height: number
  fps: FrameRate
  backgroundColor: string
  ratio: CanvasRatio
}

export type AssetKind = 'video' | 'audio' | 'image'

export type ProjectAsset = {
  id: string
  kind: AssetKind
  name: string
  mimeType: string
  sizeBytes: number
  durationUs?: TimeUs // 针对视频和音频
  width?: number // 针对视频和图像
  height?: number
  hasAudio?: boolean
  blobId?: string // 本地 Blob 仓储定位符
  remoteUrl?: string // 可选的远端只读 URL 引用
  sourceVersionId?: string // 针对数字人成片版本的来源快照标记
  createdAt: number
}

export type TransformBox = {
  x: number // 绝对画布像素坐标
  y: number
  width: number
  height: number
  rotationDeg: number // 顺时针旋转角度 0–360
  opacity: number // 0.0 - 1.0
  cropMode: 'cover' | 'contain' | 'none'
  /** 覆盖/自适应时画面在框内的锚点（0=左/上，0.5=中，1=右/下），默认居中 */
  contentFocusX?: number
  contentFocusY?: number
  round: number // 圆角像素半径
  /** 水平镜像（绕变换框中心 scaleX -1） */
  flipX?: boolean
}

export type KeyframeEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold'

export type KeyframePoint<T = number | string> = {
  id: string
  timeUs: TimeUs // 相对于元素 startUs 的局部微秒时间
  value: T
  easing: KeyframeEasing
}

export type AnimationChannel<T = number | string> = {
  propertyPath: string
  keyframes: Array<KeyframePoint<T>>
}

export type ElementAnimations = {
  channels: Record<string, AnimationChannel>
}

export type EffectKind = 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale'

export type EffectParam = {
  id: string
  kind: EffectKind
  enabled: boolean
  intensity: number // 归一化强度或特定范围值
}

export type MaskKind = 'none' | 'rectangle' | 'circle'

export type ElementMask = {
  kind: MaskKind
  x: number
  y: number
  width: number
  height: number
  inverted: boolean
  feather: number
}

export type BaseElement = {
  id: string
  trackId: string
  startUs: TimeUs
  durationUs: TimeUs
  groupId?: string
}

export type VideoClipElement = BaseElement & {
  type: 'video'
  assetId: string
  sourceInUs: TimeUs
  sourceOutUs: TimeUs
  rate: number
  volume: number
  reverse?: boolean
  freeze?: { sourceTimeUs: TimeUs }
  transform: TransformBox
  animations?: ElementAnimations
  effects?: EffectParam[]
  mask?: ElementMask
}

export type AudioClipElement = BaseElement & {
  type: 'audio'
  assetId: string
  sourceInUs: TimeUs
  sourceOutUs: TimeUs
  rate: number
  volume: number
  reverse?: boolean
  freeze?: { sourceTimeUs: TimeUs }
  fadeInUs?: TimeUs
  fadeOutUs?: TimeUs
  animations?: ElementAnimations
}

export type ImageClipElement = BaseElement & {
  type: 'image'
  assetId: string
  transform: TransformBox
  animations?: ElementAnimations
  mask?: ElementMask
}

export type TextStyle = {
  font: string
  size: number
  weight: number
  color: string
  backgroundColor: string
  outlineColor: string
  outlineWidth: number
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
}

export type TextClipElement = BaseElement & {
  type: 'text'
  text: string
  style: TextStyle
  transform: TransformBox
  animations?: ElementAnimations
  /**
   * 预制组件身份。有值时由 `render/renderers.ts` 的组件渲染器绘制，
   * `text` / `style` 仅作降级显示与无障碍标签。
   */
  component?: {
    componentId: string
    props: Record<string, unknown>
    motionId?: string
  }
}

/**
 * 动效镜头：由 `demos/` 里移植的 151 个镜头组件逐帧光栅化后绘制。
 * 这是视频工厂的核心元素类型。
 */
export type ShotClipElement = BaseElement & {
  type: 'shot'
  /** 对应 demos 注册表的 shotId，如 'opening/spotlight-hero-card' */
  shotId: string
  /** Content-only variant uses a static, local adapter without demo branding or textures. */
  presentation?: 'content'
  /** 该镜头在注册表里的原始帧长（30fps 基准） */
  sourceDurationFrames: number
  /** 素材槽位（页面截图、产品图等），透传给镜头组件 */
  slots?: Record<string, string>
  /** 覆盖镜头内部文案 */
  overrides?: Record<string, string>
  /** 播放速率，1 = 原速 */
  rate: number
  transform: TransformBox
  animations?: ElementAnimations
}

export type TrackElement =
  | VideoClipElement
  | AudioClipElement
  | ImageClipElement
  | TextClipElement
  | ShotClipElement

export type TrackType = 'video' | 'audio' | 'overlay' | 'text' | 'shot'

/** @deprecated 旧版按 TrackType 分桶；新工程用 insertTrackDefaultsByCategory */
export type InsertTrackDefaults = Partial<Record<TrackType, string>>

/** 上轴默认轨：画面（镜头+视频+画中画）/ 音频 / 文字，每类仅一条 */
export type InsertDefaultCategory = 'visual' | 'audio' | 'text'
export type InsertTrackDefaultsByCategory = Partial<Record<InsertDefaultCategory, string>>

export type TimelineTrack = {
  id: string
  type: TrackType
  name: string
  muted: boolean
  solo?: boolean
  hidden: boolean
  locked: boolean
  elements: TrackElement[]
}

export type CaptionTimingSource = 'estimated' | 'srt' | 'manual'

export type CaptionCue = {
  id: string
  startUs: TimeUs
  durationUs: TimeUs
  text: string
  timingSource: CaptionTimingSource
  boundClipId?: string // 可选绑定的视频主片段 ID
  /** 稀疏覆盖全片字幕样式；未填写的属性继续继承全片。 */
  styleOverride?: Partial<CaptionStyle>
}

export type CaptionMotion = 'fade-up' | 'pop' | 'slide' | 'fade' | 'none'

export type CaptionStyle = {
  /** 缺省保留历史单句渲染；口播宿主自行选择 rolling。 */
  mode?: 'rolling' | 'clean' | 'kinetic' | 'editorial'
  /** clean 模式每页显示行数；其他模式按其专属版式显示。 */
  pageLines?: 1 | 2
  /** 句级入场 / 退场动效；按 cue 时间运行，不代表逐词同步。 */
  entrance?: CaptionMotion
  exit?: CaptionMotion
  weight?: number
  /** 行距倍数。 */
  lineHeight?: number
  /** 字间距，单位为工程画布像素。 */
  letterSpacing?: number
  widthRatio?: number
  /** 文字区域中心的画布横向比例。 */
  xRatio?: number
  /** 动效强度 0..1；0 禁用位移/缩放，但仍按时间换行。 */
  motion?: number
  emphasisColor?: string
  font: string
  size: number
  color: string
  outlineColor: string
  outlineWidth: number
  backgroundColor: string
  yRatio: number // 画布垂直百分比位置 (0.0 - 1.0)
  burn: boolean
  align?: 'left' | 'center' | 'right'
}

export type TransitionKind = 'cut' | 'crossfade' | 'dissolve' | 'wipe'

export type TransitionElement = {
  id: string
  fromElementId: string
  toElementId: string
  kind: TransitionKind
  durationUs: TimeUs
}

export type ElementGroup = {
  id: string
  name: string
  elementIds: string[]
}

export type CoverMetadata = {
  title?: string
  subtitle?: string
  timestampUs?: TimeUs
  customImageUri?: string
}

export type BrandPreset = {
  brandColor: string
  logoAssetId?: string
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export type ProjectTemplateMetadata = {
  templateId?: string
  presetName?: string
  category?: string
  cover?: CoverMetadata
  brand?: BrandPreset
}

/**
 * 核心完整文档结构
 */
export type EditorDocument = {
  schemaVersion: 1
  id: string
  name: string
  scope: string // 宿主账号隔离标识
  createdAt: number
  updatedAt: number
  revision: number
  canvas: CanvasSettings
  durationUs: TimeUs
  assets: Record<string, ProjectAsset>
  tracks: TimelineTrack[]
  captions: CaptionCue[]
  captionStyle: CaptionStyle
  transitions: Record<string, TransitionElement>
  groups: Record<string, ElementGroup>
  templateMeta?: ProjectTemplateMetadata
  /** 库面板「+」与拖放落轴时优先使用的轨道（旧版，读取时迁移） */
  insertTrackDefaults?: InsertTrackDefaults
  /** 库面板默认上轴轨（画面 / 音频 / 文字，每类一颗星） */
  insertTrackDefaultsByCategory?: InsertTrackDefaultsByCategory
}

export function createDefaultCanvasSettings(ratio: CanvasRatio = '9:16'): CanvasSettings {
  if (ratio === '16:9') {
    return { width: 1920, height: 1080, fps: { num: 30, den: 1 }, backgroundColor: '#0d0f12', ratio: '16:9' }
  }
  if (ratio === '1:1') {
    return { width: 1080, height: 1080, fps: { num: 30, den: 1 }, backgroundColor: '#0d0f12', ratio: '1:1' }
  }
  if (ratio === '3:4') {
    return { width: 1080, height: 1440, fps: { num: 30, den: 1 }, backgroundColor: '#0d0f12', ratio: '3:4' }
  }
  if (ratio === '4:3') {
    return { width: 1440, height: 1080, fps: { num: 30, den: 1 }, backgroundColor: '#0d0f12', ratio: '4:3' }
  }
  return { width: 1080, height: 1920, fps: { num: 30, den: 1 }, backgroundColor: '#0d0f12', ratio: '9:16' }
}

/** 与 CAPTION_PRESETS「清爽讲解」(studio) 全字段一致，避免 core→panels 循环依赖故内联。 */
export function createDefaultCaptionStyle(): CaptionStyle {
  return {
    mode: 'clean',
    font: 'Alibaba PuHuiTi',
    weight: 700,
    size: 58,
    color: '#ffffff',
    emphasisColor: '#ffd60a',
    outlineColor: '#111111',
    outlineWidth: 0,
    backgroundColor: '#101820cc',
    xRatio: 0.5,
    yRatio: 0.8,
    widthRatio: 0.82,
    lineHeight: 1.4,
    letterSpacing: 0,
    motion: 0.5,
    entrance: 'fade-up',
    exit: 'fade',
    align: 'center',
    pageLines: 2,
    burn: true,
  }
}

export function createEmptyDocument(id: string, name: string, scope = 'default', ratio: CanvasRatio = '9:16'): EditorDocument {
  const now = Date.now()
  return {
    schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
    id,
    name,
    scope,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    canvas: createDefaultCanvasSettings(ratio),
    durationUs: 0,
    assets: {},
    tracks: [
      { id: 'track-shot', type: 'shot', name: '镜头轨', muted: false, hidden: false, locked: false, elements: [] },
      { id: 'track-main-video', type: 'video', name: '主视频轨', muted: false, hidden: false, locked: false, elements: [] },
      { id: 'track-voice-audio', type: 'audio', name: '配音轨', muted: false, hidden: false, locked: false, elements: [] },
      { id: 'track-overlay', type: 'overlay', name: '贴图画中画', muted: false, hidden: false, locked: false, elements: [] },
      { id: 'track-title-text', type: 'text', name: '标题文字', muted: false, hidden: false, locked: false, elements: [] },
    ],
    captions: [],
    captionStyle: createDefaultCaptionStyle(),
    transitions: {},
    groups: {},
    insertTrackDefaultsByCategory: {
      visual: 'track-shot',
      audio: 'track-voice-audio',
      text: 'track-title-text',
    },
  }
}
