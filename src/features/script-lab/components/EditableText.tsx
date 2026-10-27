import { useEffect, useRef } from 'react'

/**
 * 可就地编辑的文本块（contenteditable）。
 *
 * React 与 contenteditable 天然冲突，这里用受控的规避手法：
 * - 非受控：不把 value 写回 DOM，只在「外部值变化且非聚焦状态」时同步
 * - 失焦提交：避免每敲一个字就触发上层重渲染导致光标跳到开头
 * - 回车不插入 <br>，用纯文本换行
 * - 不使用 dangerouslySetInnerHTML，内容一律通过 textContent 写入
 */
export type EditableTextProps = {
  value: string
  onCommit: (next: string) => void
  className?: string
  ariaLabel: string
  placeholder?: string
  /** 单行模式：回车直接提交 */
  singleLine?: boolean
}

export function EditableText({
  value,
  onCommit,
  className = '',
  ariaLabel,
  placeholder,
  singleLine,
}: EditableTextProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const focused = useRef(false)
  const lastValue = useRef(value)

  // 外部值变化时同步（仅在未聚焦时，避免打断输入）
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (focused.current) {
      lastValue.current = value
      return
    }
    if (value !== lastValue.current || el.textContent !== value) {
      el.textContent = value
      lastValue.current = value
    }
  }, [value])

  return (
    <div
      ref={ref}
      className={`sl-editable ${className}`.trim()}
      contentEditable
      role="textbox"
      aria-multiline={!singleLine}
      aria-label={ariaLabel}
      data-placeholder={placeholder ?? ''}
      spellCheck={false}
      suppressContentEditableWarning
      onFocus={() => {
        focused.current = true
      }}
      onBlur={() => {
        focused.current = false
        const next = ref.current?.textContent ?? ''
        if (next !== lastValue.current) {
          lastValue.current = next
          onCommit(next)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.currentTarget.blur()
          return
        }
        if (singleLine && e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onPaste={(e) => {
        // 只接受纯文本，避免粘贴带入外部样式
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        const el = e.currentTarget
        const selection = window.getSelection()
        if (!selection?.rangeCount) return
        const range = selection.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(text))
        range.collapse(false)
        el.normalize()
      }}
    />
  )
}

export default EditableText
