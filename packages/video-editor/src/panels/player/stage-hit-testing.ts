/**
 * 舞台画面元素与动效镜头热区命中判定引擎 (Stage Hit-Testing Engine)
 *
 * 负责：
 * 1. 监视器屏幕物理坐标与画布逻辑坐标（0~1920, 0~1080）之间的精准双向映射；
 * 2. 普通视觉图层（字幕/视频/图片）几何包围盒命中判定；
 * 3. 动态镜头（Shot）基于幕次与关键帧的语义热区（如第一幕镂空大字、第二幕大盘指标等）精准提取与命中。
 */

import type { EditorDocument, TrackElement, ShotClipElement, TextClipElement } from '../../core/project.ts'
import { resolveShotFrame } from '../../render/shot-cache.ts'
import { resolveCaptionStyle } from '../../render/captions.ts'
import { burnAlignedCaptionBox } from '../captions/caption-geometry.ts'
import {
  captionClipIdForCue,
  isCaptionTextClip,
} from '../captions/sync-text-track.ts'

export type HotspotFieldType = 'text' | 'textarea' | 'number' | 'color' | 'image'

export type HotspotKind = 'caption' | 'title-text' | 'shot-field' | 'layer'

const REF_CANVAS_W = 1920
const REF_CANVAS_H = 1080

/** 镜头语义热区按 1920×1080  authoring，缩放到实际画布尺寸 */
export function scaleBox(
  box: { x: number; y: number; width: number; height: number },
  canvasW: number,
  canvasH: number,
): { x: number; y: number; width: number; height: number } {
  const sx = canvasW / REF_CANVAS_W
  const sy = canvasH / REF_CANVAS_H
  return {
    x: box.x * sx,
    y: box.y * sy,
    width: box.width * sx,
    height: box.height * sy,
  }
}

/** 选区是否处于「字幕轨/烧录字幕」编辑武装态 */
export function isCaptionArmed(selectedIds: string[], doc: EditorDocument): boolean {
  for (const id of selectedIds) {
    if (id.startsWith('caption-clip:')) return true
  }
  for (const track of doc.tracks) {
    for (const elem of track.elements) {
      if (selectedIds.includes(elem.id) && isCaptionTextClip(elem)) return true
    }
  }
  return false
}

export type StageHotspot = {
  /** 对应的时间轴元素 ID */
  elementId: string
  /** 热区类型：字幕优先于镜头字段，镜头字段优先于底板图层 */
  kind?: HotspotKind
  /** 优先级权重，数值越大优先级越高 */
  priority?: number
  /** 字段 Key（如 text, subline, dashboardTitle, kpi1Value 等，整图层时可无） */
  fieldKey?: string
  /** 字段展示中文标签 */
  label: string
  /** 字段所属分类：'content' | 'dashboard' | 'style' */
  category?: 'content' | 'dashboard' | 'style'
  /** 字段控件类型 */
  type?: HotspotFieldType
  /** 当前值 */
  currentValue?: string
  /** 在画布绝对逻辑坐标系（如 1920×1080）下的外接矩形 */
  box: {
    x: number
    y: number
    width: number
    height: number
  }
  /** 是否为镜头内部细粒度热区 */
  isShotHotspot?: boolean
  /** 镜头 ID */
  shotId?: string
}

/**
 * 将鼠标事件在容器内的 client 物理坐标转换为画布绝对坐标 (0~canvasWidth, 0~canvasHeight)
 */
export function mapClientToCanvasPoint(
  clientX: number,
  clientY: number,
  frameRect: DOMRect,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  if (frameRect.width <= 0 || frameRect.height <= 0) {
    return { x: 0, y: 0 }
  }

  const relX = clientX - frameRect.left
  const relY = clientY - frameRect.top

  const scaleX = canvasWidth / frameRect.width
  const scaleY = canvasHeight / frameRect.height

  return {
    x: Math.round(relX * scaleX),
    y: Math.round(relY * scaleY),
  }
}

/**
 * 判断点是否在矩形盒子内部
 */
export function isPointInBox(
  point: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  )
}

/**
 * 收集当前播放头时刻可见的所有图层与动效镜头内部热区
 */
export function collectStageHotspots(params: {
  doc: EditorDocument
  playheadUs: number
}): StageHotspot[] {
  const { doc, playheadUs } = params
  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  const { width: canvasW, height: canvasH } = doc.canvas

  const hotspots: StageHotspot[] = []

  // 1. 获取当前时刻所有可见的元素（按轨道自底向上，上面覆盖下面）
  const activeElements: TrackElement[] = []
  for (const track of doc.tracks) {
    for (const elem of track.elements) {
      if (playheadUs >= elem.startUs && playheadUs < elem.startUs + elem.durationUs) {
        activeElements.push(elem)
      }
    }
  }

  for (const elem of activeElements) {
    // A. 动态镜头元素内部语义热区
    if (elem.type === 'shot') {
      const shotElem = elem as ShotClipElement
      const frame = resolveShotFrame({
        playheadUs,
        startUs: shotElem.startUs,
        rate: shotElem.rate,
        fps,
        sourceDurationFrames: shotElem.sourceDurationFrames,
      })

      const overrides = shotElem.overrides || {}
      const shotId = shotElem.shotId

      // 1. opening/text-as-mask 镜头（文字视频遮罩）
      if (shotId === 'opening/text-as-mask') {
        const isAct1 = frame < 104 // 104帧前为第一幕大字，104帧后进入第二幕全屏大盘
        if (isAct1) {
          // 第一幕镂空大字
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'text',
            label: '第一幕 · 镂空大字',
            category: 'content',
            type: 'text',
            currentValue: overrides.text || 'CREATE',
            isShotHotspot: true,
            box: { x: 260, y: 350, width: 1400, height: 380 },
          })
          // 第一幕正文副标
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'subline',
            label: '第一幕 · 阐述正文',
            category: 'content',
            type: 'textarea',
            currentValue: overrides.subline || 'Next-gen video engine',
            isShotHotspot: true,
            box: { x: 380, y: 760, width: 1160, height: 90 },
          })
        } else {
          // 第二幕 · 侧栏品牌与导航项
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'sidebarBrand',
            label: '侧栏品牌标语',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.sidebarBrand || 'Shotcraft',
            isShotHotspot: true,
            box: { x: 10, y: 20, width: 210, height: 60 },
          })
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'navItem1',
            label: '侧栏导航 1',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.navItem1 || 'Overview',
            isShotHotspot: true,
            box: { x: 10, y: 108, width: 210, height: 48 },
          })
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'navItem2',
            label: '侧栏导航 2',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.navItem2 || 'Renders',
            isShotHotspot: true,
            box: { x: 10, y: 164, width: 210, height: 48 },
          })
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'navItem3',
            label: '侧栏导航 3',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.navItem3 || 'Shots',
            isShotHotspot: true,
            box: { x: 10, y: 220, width: 210, height: 48 },
          })
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'navItem4',
            label: '侧栏导航 4',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.navItem4 || 'Timeline',
            isShotHotspot: true,
            box: { x: 10, y: 276, width: 210, height: 48 },
          })
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'navItem5',
            label: '侧栏导航 5',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.navItem5 || 'Gallery',
            isShotHotspot: true,
            box: { x: 10, y: 332, width: 210, height: 48 },
          })

          // 第二幕 · 大盘主标题
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'dashboardTitle',
            label: '第二幕 · 看板标题',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.dashboardTitle || 'Render throughput',
            isShotHotspot: true,
            box: { x: 280, y: 35, width: 620, height: 80 },
          })
          // 第二幕 · 运行状态
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'dashboardStatus',
            label: '运行状态指示',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.dashboardStatus || 'Live',
            isShotHotspot: true,
            box: { x: 910, y: 45, width: 190, height: 60 },
          })
          // 第二幕 · KPI 1
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'kpi1Value',
            label: '核心指标 1 数值',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.kpi1Value || '2.48M',
            isShotHotspot: true,
            box: { x: 290, y: 150, width: 520, height: 200 },
          })
          // 第二幕 · KPI 2
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'kpi2Value',
            label: '核心指标 2 数值',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.kpi2Value || '42s −18%',
            isShotHotspot: true,
            box: { x: 834, y: 150, width: 500, height: 200 },
          })
          // 第二幕 · KPI 3 队列卡片
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'kpi3Label',
            label: '队列卡片标签',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.kpi3Label || 'Render queue',
            isShotHotspot: true,
            box: { x: 1358, y: 150, width: 502, height: 200 },
          })
          // 第二幕 · 折线面积图
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'chartTitle',
            label: '图表主标题',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.chartTitle || 'Frames / sec',
            isShotHotspot: true,
            box: { x: 290, y: 376, width: 1570, height: 470 },
          })
          // 第二幕 · 底部完成度条
          hotspots.push({
            elementId: elem.id,
            shotId,
            fieldKey: 'region1Value',
            label: '底部分项进度 1',
            category: 'dashboard',
            type: 'text',
            currentValue: overrides.region1Value || '92%',
            isShotHotspot: true,
            box: { x: 290, y: 870, width: 1570, height: 170 },
          })
        }
      }
      // 2. opening/spotlight-hero-card
      else if (shotId === 'opening/spotlight-hero-card') {
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: 'title',
          label: '卡片主标题',
          category: 'content',
          type: 'text',
          currentValue: overrides.title || 'Your product, in motion.',
          isShotHotspot: true,
          box: { x: 440, y: 440, width: 1040, height: 180 },
        })
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: 'subline',
          label: '卡片标签说明',
          category: 'content',
          type: 'text',
          currentValue: overrides.subline || 'Featured Highlights',
          isShotHotspot: true,
          box: { x: 500, y: 330, width: 920, height: 80 },
        })
      }
      // 3. typography/lead-word-zoom-assemble
      else if (shotId === 'typography/lead-word-zoom-assemble') {
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: 'text',
          label: '主标题文案',
          category: 'content',
          type: 'text',
          currentValue: overrides.text || 'Introducing Studio Video',
          isShotHotspot: true,
          box: { x: 220, y: 330, width: 1480, height: 350 },
        })
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: 'subline',
          label: '底部副标题',
          category: 'content',
          type: 'textarea',
          currentValue: overrides.subline || 'One shot card, one motion recipe',
          isShotHotspot: true,
          box: { x: 300, y: 730, width: 1320, height: 120 },
        })
      }
      // 4. typography/blur-slide
      else if (shotId === 'typography/blur-slide') {
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: 'text',
          label: '主标题',
          category: 'content',
          type: 'text',
          currentValue: overrides.text || 'Focus on what matters',
          isShotHotspot: true,
          box: { x: 240, y: 360, width: 1440, height: 260 },
        })
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: 'subline',
          label: '副标题说明',
          category: 'content',
          type: 'text',
          currentValue: overrides.subline || 'Automate your creative workflow',
          isShotHotspot: true,
          box: { x: 320, y: 640, width: 1280, height: 140 },
        })
      }
      // 5. data/chart-live-moves~AxisRescaleShockV2
      else if (shotId.includes('AxisRescaleShockV2')) {
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: 'value',
          label: '核心爆发数值',
          category: 'content',
          type: 'text',
          currentValue: overrides.value || '+328%',
          isShotHotspot: true,
          box: { x: 380, y: 340, width: 1160, height: 280 },
        })
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: 'metric',
          label: '指标名称',
          category: 'content',
          type: 'text',
          currentValue: overrides.metric || 'Active Users Growth',
          isShotHotspot: true,
          box: { x: 380, y: 220, width: 1160, height: 100 },
        })
      }
      // 6. 其它镜头的通用文案热区
      else if (overrides.text || overrides.title || overrides.brand) {
        hotspots.push({
          elementId: elem.id,
          shotId,
          fieldKey: overrides.text ? 'text' : overrides.title ? 'title' : 'brand',
          label: '核心文字',
          category: 'content',
          type: 'text',
          currentValue: overrides.text || overrides.title || overrides.brand,
          isShotHotspot: true,
          box: { x: 300, y: 360, width: 1320, height: 360 },
        })
      }
    }

    // B. 非烧录字幕的普通标题文字（字幕 clip 在循环后按 burn 盒单独推一条）
    else if (elem.type === 'text' && !isCaptionTextClip(elem)) {
      const textElem = elem as TextClipElement
      const t = textElem.transform || { x: 100, y: 100, width: 400, height: 100 }
      hotspots.push({
        elementId: textElem.id,
        kind: 'title-text',
        priority: 90,
        label: '标题文字',
        category: 'content',
        type: 'text',
        currentValue: textElem.text,
        isShotHotspot: false,
        box: { x: t.x, y: t.y, width: t.width, height: t.height },
      })
    }

    // C. 其它普通图层（视频/图片），作为中间图层（priority: 80）
    else if ('transform' in elem && (elem as any).transform) {
      const t = (elem as any).transform
      hotspots.push({
        elementId: elem.id,
        kind: 'layer',
        priority: 80,
        label: elem.type === 'video' ? '视频素材' : '图片素材',
        category: 'content',
        isShotHotspot: false,
        box: { x: t.x, y: t.y, width: t.width, height: t.height },
      })
    }
  }

  for (const h of hotspots) {
    if (h.isShotHotspot) {
      h.kind = 'shot-field'
      h.priority = 50
      h.box = scaleBox(h.box, canvasW, canvasH)
    }
  }

  const activeCue = doc.captions.find(
    (cue) =>
      playheadUs >= cue.startUs &&
      playheadUs < cue.startUs + cue.durationUs &&
      cue.text.trim() &&
      resolveCaptionStyle(doc.captionStyle, cue.styleOverride).burn,
  )
  if (activeCue) {
    const resolvedStyle = resolveCaptionStyle(doc.captionStyle, activeCue.styleOverride)
    hotspots.push({
      elementId: captionClipIdForCue(activeCue.id),
      kind: 'caption',
      priority: 100,
      label: '字幕文本',
      category: 'content',
      type: 'text',
      currentValue: activeCue.text,
      isShotHotspot: false,
      box: burnAlignedCaptionBox(doc, resolvedStyle, activeCue.text),
    })
  }

  return hotspots
}

/**
 * 在所有热区中检索点命中的最优先热区：
 * 严格按照优先级（字幕 priority=100 > 画中画 priority=80 > 镜头字段 priority=50 > 底板）降序匹配，
 * 彻底解决字幕与底层镜头重叠时的点击冲突问题！
 */
export function hitTestHotspots(
  point: { x: number; y: number },
  hotspots: StageHotspot[],
  options?: { captionArmed?: boolean; altPeek?: boolean; selectedIds?: string[] },
): StageHotspot | null {
  const captionSelectable = (h: StageHotspot) =>
    options?.captionArmed ||
    options?.altPeek ||
    (options?.selectedIds?.includes(h.elementId) ?? false)

  const matched = hotspots
    .filter((h) => {
      if (h.kind === 'caption' && !captionSelectable(h)) return false
      return isPointInBox(point, h.box)
    })
    .sort((a, b) => {
      const prioA = a.priority ?? (a.isShotHotspot ? 50 : 10)
      const prioB = b.priority ?? (b.isShotHotspot ? 50 : 10)
      return prioB - prioA
    })

  return matched[0] || null
}
