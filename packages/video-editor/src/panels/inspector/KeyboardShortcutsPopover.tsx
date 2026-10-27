/**
 * 剪辑工作台大厂快捷键速查气泡组件
 */

import { useState, useRef, useEffect } from 'react'
import { KeyboardIcon } from './inspector-icons.tsx'

interface ShortcutItem {
  key: string
  desc: string
}

const SHORTCUT_GROUPS: Array<{ title: string; items: ShortcutItem[] }> = [
  {
    title: '播放与导航',
    items: [
      { key: 'Space', desc: '播放 / 暂停' },
      { key: '← / →', desc: '微调移动选中片段 (0.1s)' },
      { key: 'Shift + ←/→', desc: '大步移动选中片段 (1.0s)' },
    ],
  },
  {
    title: '剪辑与轨道',
    items: [
      { key: 'B', desc: '指针处分割片段' },
      { key: 'Del / Backspace', desc: '删除选中片段' },
      { key: 'Shift + 拖拽', desc: '磁吸贴靠/对齐吸附' },
    ],
  },
  {
    title: '历史与视图',
    items: [
      { key: 'Ctrl + Z', desc: '撤销上一步' },
      { key: 'Ctrl + Y', desc: '重做下一步' },
      { key: 'Ctrl + 滚轮', desc: '平滑缩放时间轴' },
    ],
  },
]

export function KeyboardShortcutsPopover() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="快捷键"
        style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: open ? 'var(--accent)' : 'transparent',
          border: '1px solid transparent',
          borderRadius: 4,
          color: open ? 'var(--primary)' : 'var(--muted-foreground)',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.15s ease',
        }}
      >
        <KeyboardIcon size={14} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 260,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            padding: 12,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            fontSize: 11,
            color: 'var(--foreground)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>快捷键</span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>按 Esc 关闭</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 600 }}>
                  {group.title}
                </span>
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: 'var(--foreground)' }}>{item.desc}</span>
                    <kbd
                      style={{
                        padding: '1px 5px',
                        background: 'var(--muted)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        color: 'var(--primary)',
                        fontWeight: 600,
                      }}
                    >
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
