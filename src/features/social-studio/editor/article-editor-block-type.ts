import type { Editor } from '@tiptap/core'

export type ArticleBlockKind =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'bullet'
  | 'ordered'
  | 'quote'
  | 'code'

export function resolveArticleBlockKind(editor: Editor): ArticleBlockKind {
  if (editor.isActive('heading', { level: 1 })) return 'h1'
  if (editor.isActive('heading', { level: 2 })) return 'h2'
  if (editor.isActive('heading', { level: 3 })) return 'h3'
  if (editor.isActive('heading', { level: 4 })) return 'h4'
  if (editor.isActive('heading', { level: 5 })) return 'h5'
  if (editor.isActive('bulletList')) return 'bullet'
  if (editor.isActive('orderedList')) return 'ordered'
  if (editor.isActive('blockquote')) return 'quote'
  if (editor.isActive('codeBlock')) return 'code'
  return 'paragraph'
}

export function applyArticleBlockKind(editor: Editor, kind: ArticleBlockKind): void {
  const chain = editor.chain().focus()
  switch (kind) {
    case 'paragraph':
      chain.setParagraph().run()
      break
    case 'h1':
      chain.toggleHeading({ level: 1 }).run()
      break
    case 'h2':
      chain.toggleHeading({ level: 2 }).run()
      break
    case 'h3':
      chain.toggleHeading({ level: 3 }).run()
      break
    case 'h4':
      chain.toggleHeading({ level: 4 }).run()
      break
    case 'h5':
      chain.toggleHeading({ level: 5 }).run()
      break
    case 'bullet':
      chain.toggleBulletList().run()
      break
    case 'ordered':
      chain.toggleOrderedList().run()
      break
    case 'quote':
      chain.toggleBlockquote().run()
      break
    case 'code':
      chain.toggleCodeBlock().run()
      break
    default:
      break
  }
}

/** 仅在光标位于空行（如 Enter 换段后）时显示左侧格式柄 */
export function shouldShowArticleBlockMenu(editor: Editor): boolean {
  if (!editor.isEditable || !editor.isFocused) return false
  const { selection } = editor.state
  if (!selection.empty) return false
  const { $from } = selection
  const parent = $from.parent
  if (!parent.isTextblock) return false
  return parent.content.size === 0
}
