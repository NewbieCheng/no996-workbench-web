/**
 * 工程序列化、反序列化与深克隆工具
 */

import { validateEditorDocument } from './schema.ts'
import type { EditorDocument } from './project.ts'

export function serializeDocument(doc: EditorDocument): string {
  validateEditorDocument(doc)
  return JSON.stringify(doc)
}

export function deserializeDocument(jsonStr: string): EditorDocument {
  if (typeof jsonStr !== 'string' || !jsonStr.trim()) {
    throw new Error('反序列化失败：输入不是非空字符串')
  }
  const parsed = JSON.parse(jsonStr)
  validateEditorDocument(parsed)
  return parsed
}

/**
 * 纯深克隆，断开对象引用，同时保证不改变内部结构与字段
 */
export function cloneDocument(doc: EditorDocument): EditorDocument {
  return JSON.parse(JSON.stringify(doc)) as EditorDocument
}
