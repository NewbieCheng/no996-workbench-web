import { useEffect, useRef, useState } from 'react'
import { ChevronDown, CircleOff, Plus, UserCheck } from 'lucide-react'
import { getActivePersona, listPersonas, type PersonaRecord, type SavedPersona } from '../../services/persona'

/**
 * 人设绑定：让本次生成引用本机「人设定位」的某一档。
 *
 * 适用场景：需要显式选择本次引用人设的创作页。触发器使用通用人设注入样式，
 * 菜单可选本机已保存的人设或「不引用人设」。
 *
 * 与 `usePersonaInjection` 共用同一套下拉选择界面；受控页面由 hook 管理选择与注入内容，
 * 小红书页面保留组件内读取本机默认人设的方式。
 *
 * 诚实性：只列出本机真实保存过的人设；没有就显示空态，不伪造一份。
 */
export type PersonaBindingProps = {
  /** 仅有 `'button'` 一种形态（下拉形态已随标题页改版删除）。 */
  variant?: 'button'
  /** 可选的受控人设列表；提供时组件不自行读取或保存选择。 */
  options?: SavedPersona[]
  /** 当前选中的人设。 */
  value?: SavedPersona | null
  /** 有受控 options/value 时，选择回调由调用方处理。 */
  onChange: (persona: SavedPersona | null) => void
}

export function PersonaBinding({ options, value, onChange }: PersonaBindingProps) {
  const controlled = options !== undefined
  const [list, setList] = useState<PersonaRecord[]>([])
  const [open, setOpen] = useState(false)
  const [localBound, setLocalBound] = useState<SavedPersona | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const bound = controlled ? value ?? null : localBound
  const items: Array<PersonaRecord | SavedPersona> = controlled ? options : list

  // 进入页面时读本机人设：有启用档就默认引用
  useEffect(() => {
    if (controlled) return
    let alive = true
    void (async () => {
      try {
        const [records, active] = await Promise.all([listPersonas('user'), getActivePersona('user')])
        if (!alive) return
        setList(records)
        if (active?.content.trim()) {
          const initial = { name: active.name, summary: active.summary || active.name, content: active.content }
          setLocalBound(initial)
          onChange(initial)
        }
      } catch {
        /* 人设为可选增强：读取失败不阻塞生成 */
      }
    })()
    return () => {
      alive = false
    }
    // onChange 由调用方以 useState setter 传入，引用稳定；只在挂载时读一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled])

  // 点击外部关闭菜单
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div
      className="persona-injection persona-binding"
      data-on={bound ? 'true' : undefined}
      ref={rootRef}
    >
      <button
        type="button"
        className="persona-injection__label"
        data-bound={bound ? 'true' : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <UserCheck size={14} aria-hidden="true" />
        <span className="persona-injection__text">
          {bound
            ? (bound.name.length > 6 ? `${bound.name.slice(0, 5)}…` : bound.name)
            : '选择人设'}
        </span>
        <ChevronDown className="wb-disclosure-chevron" size={14} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="persona-injection__menu persona-binding__menu glass-menu-surface"
          role="menu"
          data-open=""
        >
          <p className="persona-injection__menu-label persona-binding__menu-label">选择要引用的人设</p>
          {items.length ? (
            <>
              {items.map((p) => (
                <button
                  key={p.id ?? p.name}
                  type="button"
                  role="menuitemradio"
                  aria-checked={bound?.id ? bound.id === p.id : bound?.name === p.name}
                  className="persona-injection__item"
                  data-current={(bound?.id ? bound.id === p.id : bound?.name === p.name) ? 'true' : undefined}
                  onClick={() => {
                    const next = {
                      id: p.id,
                      name: p.name,
                      summary: p.summary || p.name,
                      content: p.content,
                      mode: 'mode' in p ? p.mode : undefined,
                    }
                    if (!controlled) setLocalBound(next)
                    onChange(next)
                    setOpen(false)
                  }}
                >
                  <span className="persona-injection__item-name-row">
                    <span className="persona-injection__item-name">
                      {p.name.length > 6 ? `${p.name.slice(0, 5)}…` : p.name}
                    </span>
                    {('mode' in p && p.mode === 'advanced') ? (
                      <span className="persona-injection__badge persona-injection__badge--advanced" title="高级版">
                        <Plus className="size-2.5 shrink-0" aria-hidden="true" />
                        <span>高级版</span>
                      </span>
                    ) : (
                      <span className="persona-injection__badge persona-injection__badge--simple" title="简易版">
                        简易版
                      </span>
                    )}
                  </span>
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="persona-injection__item persona-binding__none"
                onClick={() => {
                  if (!controlled) setLocalBound(null)
                  onChange(null)
                  setOpen(false)
                }}
              >
                <CircleOff size={14} aria-hidden="true" />
                <span>不选择人设</span>
              </button>
            </>
          ) : (
            <p className="persona-injection__menu-label">
              还没有保存过人设，可先到「人设定位」创建。
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default PersonaBinding
