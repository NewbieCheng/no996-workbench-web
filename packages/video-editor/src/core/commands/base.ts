/**
 * 命令模式基类与命令执行结果
 */

import type { EditorDocument } from '../project.ts'

export interface CommandResult {
  document: EditorDocument
  selectionOverride?: string[]
}

export interface Command {
  readonly id: string
  readonly type: string
  execute(document: EditorDocument): CommandResult
  undo(document: EditorDocument): CommandResult
}

export class BatchCommand implements Command {
  readonly id: string
  readonly type = 'BatchCommand'
  private commands: Command[]

  constructor(commands: Command[], id?: string) {
    this.commands = commands
    this.id = id ?? `batch-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    let currentDoc = document
    let lastSelection: string[] | undefined

    for (const cmd of this.commands) {
      const res = cmd.execute(currentDoc)
      currentDoc = res.document
      if (res.selectionOverride !== undefined) {
        lastSelection = res.selectionOverride
      }
    }

    return {
      document: currentDoc,
      selectionOverride: lastSelection,
    }
  }

  undo(document: EditorDocument): CommandResult {
    let currentDoc = document
    let lastSelection: string[] | undefined

    // 逆序撤销
    for (let i = this.commands.length - 1; i >= 0; i--) {
      const res = this.commands[i].undo(currentDoc)
      currentDoc = res.document
      if (res.selectionOverride !== undefined) {
        lastSelection = res.selectionOverride
      }
    }

    return {
      document: currentDoc,
      selectionOverride: lastSelection,
    }
  }
}
