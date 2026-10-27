/**
 * 命令管理器：维护有界撤销重做栈与原子状态流转
 */

import type { EditorDocument } from '../project.ts'
import type { Command, CommandResult } from './base.ts'
import { isCommandPermitted, type CommandPolicy } from '../capabilities.ts'

export interface CommandHistoryEntry {
  command: Command
  previousDocument: EditorDocument
  resultDocument: EditorDocument
  selectionOverride?: string[]
}

export class CommandManager {
  private history: CommandHistoryEntry[] = []
  private redoStack: CommandHistoryEntry[] = []
  private readonly maxHistoryLimit: number

  constructor(maxLimit = 50) {
    this.maxHistoryLimit = Math.max(10, maxLimit)
  }

  execute(
    command: Command,
    currentDoc: EditorDocument,
    policy?: CommandPolicy
  ): CommandResult {
    if (!isCommandPermitted(command.type, policy)) {
      throw new Error(`当前策略禁止执行命令: ${command.type}`)
    }

    const previousDocument = currentDoc
    const result = command.execute(currentDoc)

    // 自动标记更新时间与递增版本
    const nextDoc: EditorDocument = {
      ...result.document,
      updatedAt: Date.now(),
      revision: currentDoc.revision + 1,
    }

    const entry: CommandHistoryEntry = {
      command,
      previousDocument,
      resultDocument: nextDoc,
      selectionOverride: result.selectionOverride,
    }

    this.history.push(entry)
    if (this.history.length > this.maxHistoryLimit) {
      this.history.shift()
    }
    // 执行新命令清空重做栈
    this.redoStack = []

    return {
      document: nextDoc,
      selectionOverride: result.selectionOverride,
    }
  }

  undo(currentDoc: EditorDocument): CommandResult | null {
    if (this.history.length === 0) return null

    const entry = this.history.pop()!
    const undoRes = entry.command.undo(currentDoc)

    const nextDoc: EditorDocument = {
      ...undoRes.document,
      updatedAt: Date.now(),
      revision: currentDoc.revision + 1,
    }

    this.redoStack.push(entry)

    return {
      document: nextDoc,
      selectionOverride: entry.selectionOverride,
    }
  }

  redo(currentDoc: EditorDocument): CommandResult | null {
    if (this.redoStack.length === 0) return null

    const entry = this.redoStack.pop()!
    const redoRes = entry.command.execute(currentDoc)

    const nextDoc: EditorDocument = {
      ...redoRes.document,
      updatedAt: Date.now(),
      revision: currentDoc.revision + 1,
    }

    this.history.push(entry)

    return {
      document: nextDoc,
      selectionOverride: redoRes.selectionOverride,
    }
  }

  canUndo(): boolean {
    return this.history.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.history = []
    this.redoStack = []
  }

  getHistoryLength(): number {
    return this.history.length
  }
}
