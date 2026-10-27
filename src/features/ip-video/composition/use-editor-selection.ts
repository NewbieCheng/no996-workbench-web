import { useEffect, useState } from 'react'
import type { EditorInstance } from '@no996/video-editor'

/** Selection changes are editor events, not document edits; panels need to subscribe explicitly. */
export function useEditorSelection(editor: EditorInstance): string[] {
  const [selection, setSelection] = useState<string[]>(() => editor.getSelectedElementIds())
  useEffect(() => {
    const sync = () => setSelection(editor.getSelectedElementIds())
    sync()
    return editor.subscribe(sync)
  }, [editor])
  return selection
}
