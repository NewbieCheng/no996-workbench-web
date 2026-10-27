import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ChevronDownIcon, PilcrowIcon } from 'lucide-react'
import { cn } from '@no996/ui/utils'
import { glassMenuItemClass, glassMenuSurfaceClass } from '@no996/ui/glass-menu'
import {
  applyArticleBlockKind,
  resolveArticleBlockKind,
  type ArticleBlockKind,
} from './article-editor-block-type'

type BlockOption = {
  kind: ArticleBlockKind
  glyph: string
  labelKey: string
  icon?: 'paragraph'
}

const BLOCK_OPTIONS: BlockOption[] = [
  { kind: 'paragraph', glyph: 'T', labelKey: 'editorBlockParagraph', icon: 'paragraph' },
  { kind: 'h1', glyph: 'H1', labelKey: 'editorBlockH1Label' },
  { kind: 'h2', glyph: 'H2', labelKey: 'editorBlockH2Label' },
  { kind: 'h3', glyph: 'H3', labelKey: 'editorBlockH3Label' },
  { kind: 'h4', glyph: 'H4', labelKey: 'editorBlockH4Label' },
  { kind: 'h5', glyph: 'H5', labelKey: 'editorBlockH5Label' },
  { kind: 'bullet', glyph: '•', labelKey: 'editorBlockBullet' },
  { kind: 'ordered', glyph: '1.', labelKey: 'editorBlockOrdered' },
  { kind: 'quote', glyph: '“', labelKey: 'editorBlockQuote' },
  { kind: 'code', glyph: '{ }', labelKey: 'editorBlockCode' },
]

type ArticleEditorBlockTypePickerProps = {
  editor: Editor
  variant?: 'bubble' | 'gutter'
  /** 由父级 useEditorState 传入时可避免在 BubbleMenu 内重复订阅 */
  blockKind?: ArticleBlockKind
}

export function ArticleEditorBlockTypePicker({
  editor,
  variant = 'bubble',
  blockKind,
}: ArticleEditorBlockTypePickerProps) {
  const { t } = useTranslation('socialPublish')
  const [open, setOpen] = useState(false)
  const active = blockKind ?? resolveArticleBlockKind(editor)

  const triggerLabel = (() => {
    if (active === 'paragraph') return t('editorBlockParagraphShort')
    if (active.startsWith('h')) return active.toUpperCase()
    if (active === 'bullet') return t('editorBlockBulletShort')
    if (active === 'ordered') return t('editorBlockOrderedShort')
    if (active === 'quote') return t('editorBlockQuoteShort')
    if (active === 'code') return t('editorBlockCodeShort')
    return t('editorBlockParagraphShort')
  })()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const root = document.querySelector(`[data-block-type-picker="${variant}"]`)
      if (root?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open, variant])

  const pick = (kind: ArticleBlockKind) => {
    applyArticleBlockKind(editor, kind)
    setOpen(false)
  }

  return (
    <div
      className={`editor-block-type-picker editor-block-type-picker--${variant}`}
      data-block-type-picker={variant}
    >
      <button
        type="button"
        className="editor-block-type-picker__trigger"
        aria-label={t('editorBlockMenuAria')}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="editor-block-type-picker__trigger-label">{triggerLabel}</span>
        <ChevronDownIcon aria-hidden />
      </button>
      {open ? (
        <div
          className={cn(
            glassMenuSurfaceClass,
            'glass-menu-surface--scroll-shell',
            'editor-block-type-picker__menu-shell',
          )}
          data-open
          role="menu"
        >
          <div className={cn('glass-menu', 'glass-menu-surface--scrollable', 'editor-block-type-picker__menu')}>
            {BLOCK_OPTIONS.map((item) => {
              const isActive = item.kind === active
              return (
                <button
                  key={item.kind}
                  type="button"
                  role="menuitem"
                  className={cn(glassMenuItemClass, 'editor-block-type-picker__item', isActive && 'is-active')}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(item.kind)}
                >
                  <span className="editor-block-type-picker__glyph glass-menu-item__icon" aria-hidden>
                    {item.icon === 'paragraph' ? <PilcrowIcon /> : item.glyph}
                  </span>
                  <span className="editor-block-type-picker__text glass-menu-item__text">{t(item.labelKey)}</span>
                  {isActive ? <CheckIcon className="editor-block-type-picker__check" aria-hidden /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
