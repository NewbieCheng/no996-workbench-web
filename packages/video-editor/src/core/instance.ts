/**
 * 编辑器独立实例工厂（支持多实例并存，零静态单例）
 */

import type { TimeUs } from './time.ts'
import type { EditorDocument } from './project.ts'
import {
  DEFAULT_FULL_PROFILE,
  type CommandPolicy,
  type PanelProfile,
} from './capabilities.ts'
import { cloneDocument } from './serialization.ts'
import { CommandManager } from './commands/manager.ts'
import type { Command, CommandResult } from './commands/base.ts'

export type EditorInstanceOptions = {
  document: EditorDocument
  profile?: PanelProfile
  commandPolicy?: CommandPolicy
  onDocumentChange?: (doc: EditorDocument) => void
}

export type EditorSnapshot = {
  document: EditorDocument
  playheadUs: TimeUs
  isPlaying: boolean
  selectedElementIds: string[]
  profile: PanelProfile
}

export interface EditorInstance {
  readonly id: string
  readonly profile: PanelProfile
  readonly commandPolicy?: CommandPolicy

  getSnapshot(): EditorSnapshot
  getDocument(): EditorDocument
  setDocument(doc: EditorDocument): void
  updateDocument(updater: (prev: EditorDocument) => EditorDocument): void

  getPlayheadUs(): TimeUs
  setPlayheadUs(timeUs: TimeUs): void

  getIsPlaying(): boolean
  setIsPlaying(playing: boolean): void

  getSelectedElementIds(): string[]
  setSelection(ids: string[]): void
  clearSelection(): void

  executeCommand(command: Command): CommandResult
  undo(): CommandResult | null
  redo(): CommandResult | null
  canUndo(): boolean
  canRedo(): boolean

  subscribe(listener: () => void): () => void
  dispose(): void
}

let instanceSeq = 0

export function createEditor(options: EditorInstanceOptions): EditorInstance {
  const instanceId = `editor-instance-${++instanceSeq}`
  let currentDoc = cloneDocument(options.document)
  let currentPlayheadUs: TimeUs = 0
  let currentIsPlaying = false
  let currentSelection: string[] = []
  const profile = options.profile ?? DEFAULT_FULL_PROFILE
  const commandPolicy = options.commandPolicy
  const commandManager = new CommandManager()

  const listeners = new Set<() => void>()
  let isDisposed = false

  function notify() {
    if (isDisposed) return
    for (const listener of listeners) {
      listener()
    }
  }

  function getSnapshot(): EditorSnapshot {
    return {
      document: currentDoc,
      playheadUs: currentPlayheadUs,
      isPlaying: currentIsPlaying,
      selectedElementIds: currentSelection,
      profile,
    }
  }

  return {
    id: instanceId,
    profile,
    commandPolicy,

    getSnapshot,

    getDocument() {
      return currentDoc
    },

    setDocument(nextDoc) {
      if (isDisposed || nextDoc === currentDoc) return
      currentDoc = cloneDocument(nextDoc)
      notify()
      options.onDocumentChange?.(currentDoc)
    },

    updateDocument(updater) {
      if (isDisposed) return
      const next = updater(currentDoc)
      currentDoc = { ...next, updatedAt: Date.now(), revision: currentDoc.revision + 1 }
      notify()
      options.onDocumentChange?.(currentDoc)
    },

    getPlayheadUs() {
      return currentPlayheadUs
    },

    setPlayheadUs(timeUs) {
      if (isDisposed) return
      const safeTimeUs = Math.max(0, Math.min(timeUs, currentDoc.durationUs || Number.MAX_SAFE_INTEGER))
      if (safeTimeUs === currentPlayheadUs) return
      currentPlayheadUs = safeTimeUs
      notify()
    },

    getIsPlaying() {
      return currentIsPlaying
    },

    setIsPlaying(playing) {
      if (isDisposed || currentIsPlaying === playing) return
      currentIsPlaying = playing
      notify()
    },

    getSelectedElementIds() {
      return currentSelection
    },

    setSelection(ids) {
      if (isDisposed) return
      currentSelection = [...ids]
      notify()
    },

    clearSelection() {
      if (isDisposed || currentSelection.length === 0) return
      currentSelection = []
      notify()
    },

    executeCommand(command) {
      if (isDisposed) throw new Error('实例已释放')
      const result = commandManager.execute(command, currentDoc, commandPolicy)
      currentDoc = result.document
      if (result.selectionOverride !== undefined) {
        currentSelection = [...result.selectionOverride]
      }
      notify()
      options.onDocumentChange?.(currentDoc)
      return result
    },

    undo() {
      if (isDisposed) return null
      const result = commandManager.undo(currentDoc)
      if (result) {
        currentDoc = result.document
        if (result.selectionOverride !== undefined) {
          currentSelection = [...result.selectionOverride]
        }
        notify()
        options.onDocumentChange?.(currentDoc)
      }
      return result
    },

    redo() {
      if (isDisposed) return null
      const result = commandManager.redo(currentDoc)
      if (result) {
        currentDoc = result.document
        if (result.selectionOverride !== undefined) {
          currentSelection = [...result.selectionOverride]
        }
        notify()
        options.onDocumentChange?.(currentDoc)
      }
      return result
    },

    canUndo() {
      return !isDisposed && commandManager.canUndo()
    },

    canRedo() {
      return !isDisposed && commandManager.canRedo()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    dispose() {
      isDisposed = true
      listeners.clear()
    },
  }
}
