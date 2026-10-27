/**
 * 视频模板复用引擎与槽位替换（另存为模板、使用模板灌入内容）
 */

import type { EditorDocument } from '../project.ts'
import type { VideoTemplateEnvelope, ComponentInstance } from './model.ts'
import type { AssemblyRecipeId, AssemblyStyleId } from './catalog.ts'
import { ASSEMBLY_RECIPES } from './catalog.ts'
import { cloneDocument } from '../serialization.ts'

export type TemplateSlotValues = Record<string, unknown>

/**
 * 将当前工程另存为可跨用户/跨工程复用的模板
 * 默认剔除具体个人素材、私有音轨及账号隔离标记
 */
export function exportDocumentAsTemplate(
  document: EditorDocument,
  options: {
    templateId: string
    name: string
    category: string
    description?: string
    styleId?: AssemblyStyleId
  }
): VideoTemplateEnvelope {
  const scenes = Object.values(document.groups || {}).map((group, idx) => ({
    id: group.id,
    name: group.name,
    layoutId: 'layout.type-led' as const,
    startUs: idx * 3_000_000,
    durationUs: 3_000_000,
    componentInstanceIds: group.elementIds,
  }))

  const components: Record<string, ComponentInstance> = {}
  const slots: VideoTemplateEnvelope['slots'] = []

  // 从工程元素抽取插槽与纯净组件结构
  document.tracks.forEach((track) => {
    track.elements.forEach((elem) => {
      const instanceId = elem.id
      if (elem.type === 'text') {
        components[instanceId] = {
          instanceId,
          componentId: 'title.chapter',
          propsVersion: 1,
          props: { text: elem.text, size: elem.style.size },
          provenance: { origin: 'template', timestamp: Date.now(), version: 1 },
        }
        slots.push({
          slotId: `slot-${instanceId}-text`,
          name: `文本: ${elem.text.slice(0, 10)}...`,
          type: 'text',
          targetInstanceId: instanceId,
          targetField: 'text',
          required: true,
        })
      }
    })
  })

  return {
    version: 2,
    templateId: options.templateId,
    name: options.name,
    category: options.category,
    description: options.description,
    styleId: options.styleId || 'style.knowledge-editorial',
    durationUs: document.durationUs,
    scenes,
    components,
    slots,
  }
}

/**
 * 消费模板并使用新槽位输入（文案、音频、图片）实例化一份全新可编辑工程
 */
export function instantiateTemplate(
  template: VideoTemplateEnvelope,
  targetDocument: EditorDocument,
  slotValues: TemplateSlotValues
): EditorDocument {
  const newDoc = cloneDocument(targetDocument)
  newDoc.durationUs = template.durationUs

  // 更新对应槽位数据
  template.slots.forEach((slot) => {
    const value = slotValues[slot.slotId]
    if (value !== undefined) {
      const comp = template.components[slot.targetInstanceId]
      if (comp) {
        comp.props[slot.targetField] = value
      }
    }
  })

  // 同步写入目标工程轨道
  const titleTrack = newDoc.tracks.find((t) => t.type === 'text')
  if (titleTrack) {
    Object.values(template.components).forEach((comp, idx) => {
      const text = String(comp.props.text || '模板填充文案')
      const existing = titleTrack.elements.find((e) => e.id === comp.instanceId)
      if (existing && existing.type === 'text') {
        existing.text = text
      } else {
        titleTrack.elements.push({
          id: comp.instanceId,
          trackId: titleTrack.id,
          type: 'text',
          text,
          startUs: idx * 1_500_000,
          durationUs: 2_000_000,
          style: {
            font: '"Alibaba PuHuiTi", sans-serif',
            size: 60,
            weight: 700,
            color: '#FFFFFF',
            backgroundColor: '',
            outlineColor: '#000000',
            outlineWidth: 2,
            align: 'left',
            lineHeight: 1.2,
            letterSpacing: 0,
          },
          transform: {
            x: 80,
            y: 200 + idx * 120,
            width: newDoc.canvas.width - 160,
            height: 100,
            rotationDeg: 0,
            opacity: 1,
            cropMode: 'contain',
            round: 0,
          },
        })
      }
    })
  }

  newDoc.revision += 1
  newDoc.updatedAt = Date.now()
  return newDoc
}

/**
 * 依据预设组合配方生成默认场景结构建议
 */
export function createRecipeTemplate(recipeId: AssemblyRecipeId): VideoTemplateEnvelope {
  const recipe = ASSEMBLY_RECIPES[recipeId]
  if (!recipe) throw new Error(`未知的配方标识: ${recipeId}`)

  return {
    version: 2,
    templateId: `tpl-${recipeId}`,
    name: recipe.label,
    category: 'knowledge',
    styleId: 'style.knowledge-editorial',
    durationUs: recipe.sequence.length * 3_000_000,
    scenes: recipe.sequence.map((_compType, idx) => ({
      id: `scene-${idx + 1}`,
      layoutId: 'layout.type-led',
      startUs: idx * 3_000_000,
      durationUs: 3_000_000,
      componentInstanceIds: [`comp-${idx + 1}`],
    })),
    components: {},
    slots: [],
  }
}
