import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserCheck } from 'lucide-react'
import {
  listPersonaOptions,
  personaInjectionParts,
  personaMenuHint,
  type PersonaRecord,
  type SavedPersona,
} from '../../services/persona'

/**
 * 人设选择：可在下拉菜单中选择一个本机人设，或选择「不引用人设」。
 * 选择状态同时决定按钮高亮与本次生成是否注入人设。
 *
 * 产出**两路**内容，语义不同，缺一不可：
 * - `content` = 档案正文，进提示词里的「表达参考人设：«persona»」变量 → 管**语气与视角**；
 * - `background` = 身份 + 定位卡片 + 档案正文，由内核挂在 system 消息上 → 管**身份事实**。
 *
 * 之所以做成统一 hook：三个创作页（视频脚本 / 直播脚本 / 爆款标题）此前各写一套
 * 绑定逻辑，默认行为还不一致；现在只有这一处读取人设。
 */

export type PersonaInjectionState = {
  /** 用户是否希望注入 */
  enabled: boolean
  setEnabled: (next: boolean) => void
  /** 当前选中的档；没保存过任何档时为 null */
  persona: SavedPersona | null
  /** 全部候选档（真实数据，未加工），供菜单渲染 */
  options: SavedPersona[]
  /** 当前选中档的 id；没档时为 null */
  selectedId: string | null
  /** 选择人设；传 null 表示本次不引用 */
  selectPersona: (id: string | null) => void
  /** 首次读取中 */
  loading: boolean
  /** 要写进提示词「表达参考人设」变量的档案正文（关掉开关或没有档时为 undefined） */
  content: string | undefined
  /** 要作为**背景上下文**注入的身份资料（人设 + 定位卡片）；关掉或没有档时为 undefined */
  background: string | undefined
  /** 当前选中档完整记录（含 formData），供表单预填 */
  record: PersonaRecord | null
}

/** 把内部记录投影成界面与 flow 都认的精简形状。 */
function toOption(record: PersonaRecord): SavedPersona {
  return {
    name: record.name,
    summary: record.summary || record.name,
    content: record.content,
    id: record.id,
    hint: personaMenuHint(record),
  }
}

export function usePersonaInjection(): PersonaInjectionState {
  const [enabled, setEnabled] = useState(true)
  const [records, setRecords] = useState<PersonaRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { records: found, activeId } = await listPersonaOptions()
        if (!alive) return
        setRecords(found)
        // 默认选中启用档；没有启用档就选最近更新的一档（仓储已倒序）
        setSelectedId(activeId)
      } catch {
        /* 人设是可选增强：读取失败不影响生成，只是不注入 */
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const options = useMemo(() => records.map(toOption), [records])

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  )

  /**
   * 两路内容都从**同一条记录**产出，所以不可能出现「语气是 A、身份是 B」。
   * 关掉开关时两路都为 undefined → flow 一个字都不注入。
   */
  const parts = useMemo(
    () => (enabled ? personaInjectionParts(selected) : { style: undefined, background: undefined }),
    [enabled, selected],
  )

  const selectPersona = useCallback((id: string | null) => {
    setSelectedId(id)
    setEnabled(Boolean(id))
  }, [])

  return {
    enabled,
    setEnabled,
    persona: selected ? toOption(selected) : null,
    options,
    selectedId,
    selectPersona,
    loading,
    content: parts.style,
    background: parts.background,
    record: selected,
  }
}

export type PersonaInjectionToggleProps = {
  state: PersonaInjectionState
  /** 覆盖默认文案（例如「已注入人设」） */
  className?: string
}

/**
 * 右上角控件：**开关 + 换档菜单**。
 *
 * 开关是真实 checkbox（键盘可达、读屏可读）；换档是一个「切换」按钮，
 * 菜单项用 `role="menuitemradio"`，选中态可被读屏播报。
 */
export function PersonaInjectionToggle({ state, className }: PersonaInjectionToggleProps) {
  const { enabled, setEnabled, persona, options, selectedId, selectPersona, loading } = state
  const hasPersona = options.length > 0
  const on = enabled && hasPersona
  const [open, setOpen] = useState(false)

  // 关掉开关或没有档时收起菜单，避免留下一个指向空列表的浮层
  useEffect(() => {
    if (!on) setOpen(false)
  }, [on])

  const personaName = persona?.name.trim() ?? ''
  const shortPersonaName = personaName.length > 5 ? `${personaName.slice(0, 4)}…` : personaName
  const label = loading
    ? '读取…'
    : !hasPersona
      ? '无人设'
      : on
        ? `人设${shortPersonaName}`
        : '人设关闭'

  const multi = options.length > 1

  return (
    <div
      className={['persona-injection', className].filter(Boolean).join(' ')}
      data-on={on || undefined}
      data-disabled={!hasPersona && !loading ? 'true' : undefined}
      data-menu-open={open || undefined}
    >
      <label
        className="persona-injection__label"
        title={
          hasPersona
            ? '默认注入本机「人设定位」的档位：身份与定位作为背景上下文，表达风格进提示词。关掉后这一页完全不注入。'
            : '还没有生成并保存的人设档案。请先到「人设定位」填写并生成，再回来注入。'
        }
      >
        <UserCheck size={14} aria-hidden="true" />
        <span className="persona-injection__text">{label}</span>
        {hasPersona ? (
          <>
            <input
              type="checkbox"
              className="persona-injection__input"
              checked={on}
              disabled={loading}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="persona-injection__track" aria-hidden="true">
              <span className="persona-injection__thumb" />
            </span>
          </>
        ) : null}
      </label>

      {/*
        换档入口：只在真的有多个档时才出现。
        只有一个档时多一个按钮纯属噪声 —— 那时开关就是全部语义。
      */}
      {multi && on ? (
        <>
          <button
            type="button"
            className="persona-injection__pick"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="更换人设"
            title="更换人设（只影响本次生成）"
            onClick={() => setOpen((v) => !v)}
          >
            更换
          </button>
          {open ? (
            <div className="persona-injection__menu glass-menu-surface" role="menu" data-open="">
              <p className="persona-injection__menu-label">本机已保存的人设</p>
              {options.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={p.id === selectedId}
                  className="persona-injection__item"
                  data-current={p.id === selectedId ? 'true' : undefined}
                  onClick={() => {
                    if (p.id) selectPersona(p.id)
                    setOpen(false)
                  }}
                >
                  <span className="persona-injection__item-name">{p.name}</span>
                  {p.hint ? <span className="persona-injection__item-hint">{p.hint}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default PersonaInjectionToggle
