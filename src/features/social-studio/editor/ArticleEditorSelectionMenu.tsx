import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { useEditorState } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@no996/ui/utils'
import { glassMenuSurfaceClass } from '@no996/ui/glass-menu'
import { ArticleEditorBlockTypePicker } from './ArticleEditorBlockTypePicker'
import { resolveArticleBlockKind } from './article-editor-block-type'
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react'

type ArticleEditorSelectionMenuProps = {
  editor: Editor | null
}

function shouldShowSelectionMenu(editor: Editor): boolean {
  if (!editor.isEditable || !editor.isFocused) return false
  const { selection } = editor.state
  if (selection.empty) return false
  const { from, to } = selection
  const text = editor.state.doc.textBetween(from, to, ' ')
  return text.trim().length > 0
}

function selectEditorToolbarState(editor: Editor | null) {
  if (!editor) return null
  return {
    blockKind: resolveArticleBlockKind(editor),
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    strike: editor.isActive('strike'),
    underline: editor.isActive('underline'),
    link: editor.isActive('link'),
    code: editor.isActive('code'),
  }
}

export function ArticleEditorSelectionMenu({ editor }: ArticleEditorSelectionMenuProps) {
  const { t } = useTranslation('socialPublish')
  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) => selectEditorToolbarState(current),
  })

  if (!editor || !toolbar) return null

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt(t('editorSelectionLinkPrompt'), previous ?? 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="articleEditorSelectionMenu"
      shouldShow={({ editor: current }) => shouldShowSelectionMenu(current)}
      appendTo={() => document.body}
      options={{ placement: 'top', offset: 8 }}
      className="editor-selection-bubble"
    >
      <div
        className={cn(glassMenuSurfaceClass, 'editor-selection-bubble__inner')}
        data-open
        role="toolbar"
        aria-label={t('editorSelectionToolbarAria')}
      >
        <ArticleEditorBlockTypePicker editor={editor} variant="bubble" blockKind={toolbar.blockKind} />
        <span className="editor-selection-bubble__sep glass-menu-separator" aria-hidden />
        <button
          type="button"
          className={toolbar.bold ? 'is-active' : ''}
          aria-label={t('editorSelectionBold')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon aria-hidden />
        </button>
        <button
          type="button"
          className={toolbar.italic ? 'is-active' : ''}
          aria-label={t('editorSelectionItalic')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon aria-hidden />
        </button>
        <button
          type="button"
          className={toolbar.strike ? 'is-active' : ''}
          aria-label={t('editorSelectionStrike')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikethroughIcon aria-hidden />
        </button>
        <button
          type="button"
          className={toolbar.underline ? 'is-active' : ''}
          aria-label={t('editorSelectionUnderline')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon aria-hidden />
        </button>
        <span className="editor-selection-bubble__sep glass-menu-separator" aria-hidden />
        <button
          type="button"
          className={toolbar.link ? 'is-active' : ''}
          aria-label={t('editorSelectionLink')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={setLink}
        >
          <LinkIcon aria-hidden />
        </button>
        <button
          type="button"
          className={toolbar.code ? 'is-active' : ''}
          aria-label={t('editorSelectionCode')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon aria-hidden />
        </button>
      </div>
    </BubbleMenu>
  )
}
