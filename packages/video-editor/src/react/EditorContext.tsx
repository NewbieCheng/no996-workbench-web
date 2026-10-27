/**
 * React 编辑器实例上下文定义
 */

import { createContext } from 'react'
import type { EditorInstance } from '../core/instance.ts'

export const EditorContext = createContext<EditorInstance | null>(null)
