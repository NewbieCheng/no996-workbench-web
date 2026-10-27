import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDownIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  TextIcon,
} from 'lucide-react'
import { cn } from '@no996/ui/utils'
import { glassMenuSurfaceClass } from '@no996/ui/glass-menu'
import {
  applyArticleBlockKind,
  resolveArticleBlockKind,
  shouldShowArticleBlockMenu,
  type ArticleBlockKind,
} from './article-editor-block-type'

type ArticleEditorBlockMenuProps = {
  editor: Editor | null
}

const HEADING_KINDS: ArticleBlockKind[] = ['h1', 'h2', 'h3', 'h4', 'h5']
const HANDLE_HEIGHT = 26

export function ArticleEditorBlockMenu({ editor }: ArticleEditorBlockMenuProps) {
  const { t } = useTranslation('socialPublish')
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const [fixedTop, setFixedTop] = useState(0)
  const [fixedLeft, setFixedLeft] = useState(0)

  const syncGutter = useCallback(() => {
    if (!editor) {
      setVisible(false)
      return
    }
    if (!shouldShowArticleBlockMenu(editor)) {
      setVisible(false)
      setExpanded(false)
      return
    }
    const { from } = editor.state.selection
    const coords = editor.view.coordsAtPos(from)
    const proseRect = (editor.view.dom as HTMLElement).getBoundingClientRect()
    const lineHeight = Math.max(coords.bottom - coords.top, HANDLE_HEIGHT)
    const centerY = coords.top + lineHeight / 2
    setFixedTop(centerY - HANDLE_HEIGHT / 2)
    setFixedLeft(proseRect.left)
    setVisible(true)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const onChange = () => {
      setExpanded(false)
      syncGutter()
    }
    const onBlur = () => {
      setVisible(false)
      setExpanded(false)
    }
    editor.on('selectionUpdate', onChange)
    editor.on('focus', onChange)
    editor.on('blur', onBlur)
    return () => {
      editor.off('selectionUpdate', onChange)
      editor.off('focus', onChange)
      editor.off('blur', onBlur)
    }
  }, [editor, syncGutter])

  useEffect(() => {
    if (!visible) return
    const onLayout = () => syncGutter()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [visible, syncGutter])

  if (!editor || !visible) return null

  const active = resolveArticleBlockKind(editor)

  const badgeLabel = (kind: ArticleBlockKind) => {
    switch (kind) {
      case 'paragraph':
        return t('editorBlockParagraphShort')
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
        return kind.toUpperCase()
      case 'bullet':
        return t('editorBlockBulletShort')
      case 'ordered':
        return t('editorBlockOrderedShort')
      case 'quote':
        return t('editorBlockQuoteShort')
      case 'code':
        return t('editorBlockCodeShort')
      default:
        return t('editorBlockParagraphShort')
    }
  }

  const pick = (kind: ArticleBlockKind) => {
    applyArticleBlockKind(editor, kind)
    setExpanded(false)
  }

  const menu = (
    <div
      className="editor-block-menu-gutter"
      style={{
        top: `${fixedTop}px`,
        left: `${fixedLeft}px`,
        transform: 'translateX(calc(-100% - 6px))',
      }}
    >
      <div className={`editor-block-menu${expanded ? ' is-expanded' : ''}`}>
        <div className={cn(glassMenuSurfaceClass, 'editor-block-menu__handle')} data-open>
          <span className="editor-block-menu__badge" aria-hidden>{badgeLabel(active)}</span>
          <button
            type="button"
            className="editor-block-menu__toggle"
            aria-label={t('editorBlockMenuAria')}
            aria-expanded={expanded}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDownIcon aria-hidden />
          </button>
        </div>

        {expanded ? (
          <div
            className={cn(
              glassMenuSurfaceClass,
              'glass-menu-surface--scroll-shell',
              'editor-block-menu__panel-shell',
            )}
            data-open
            role="menu"
          >
            <div className={cn('glass-menu', 'glass-menu-surface--scrollable', 'editor-block-menu__panel')}>
            <p className="editor-block-menu__hint">{t('editorBlockMarkdownHint')}</p>
            <div
              className="editor-block-menu__row editor-block-menu__row--headings"
              role="group"
              aria-label={t('editorBlockHeadings')}
            >
              <span className="editor-block-menu__row-label" aria-hidden>
                <TextIcon />
              </span>
              <button
                type="button"
                role="menuitem"
                className={active === 'paragraph' ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick('paragraph')}
              >
                <PilcrowIcon aria-hidden />
                <span>{t('editorBlockParagraph')}</span>
              </button>
              {HEADING_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  className={active === kind ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(kind)}
                >
                  {kind.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="editor-block-menu__row" role="group" aria-label={t('editorBlockLists')}>
              <button
                type="button"
                role="menuitem"
                className={active === 'ordered' ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick('ordered')}
                title={t('editorBlockOrdered')}
              >
                <ListOrderedIcon aria-hidden />
              </button>
              <button
                type="button"
                role="menuitem"
                className={active === 'bullet' ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick('bullet')}
                title={t('editorBlockBullet')}
              >
                <ListIcon aria-hidden />
              </button>
              <button
                type="button"
                role="menuitem"
                className={active === 'quote' ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick('quote')}
                title={t('editorBlockQuote')}
              >
                <QuoteIcon aria-hidden />
              </button>
              <button
                type="button"
                role="menuitem"
                className={active === 'code' ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick('code')}
                title={t('editorBlockCode')}
              >
                <span className="editor-block-menu__code-icon" aria-hidden>{'{ }'}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setHorizontalRule().run()
                  setExpanded(false)
                }}
                title={t('editorBlockDivider')}
              >
                <MinusIcon aria-hidden />
              </button>
            </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
