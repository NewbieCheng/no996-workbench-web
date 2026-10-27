import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Pause, Play, RefreshCw, Send, TriangleAlert } from 'lucide-react'
import { copyText } from '../../../services/browser'
import type { ScriptReviewItem, ScriptNode, ScriptSegment } from '../agent/types'
import EditableText from './EditableText'
import { formatTimecode } from '../agent/finalize'
import i18n from '@/i18n'

/**
 * 直播脚本结果：**导播台三栏**（按参考稿重做）。
 *
 * 左 = 流程时间轴（块高按时长占比伸缩）；
 * 中 = 主播提词面板（当前章可编辑大字口播）；
 * 右 = 控场清单（可勾选，勾后划线变灰）。
 *
 * 与视频页刻意做出差异：这里是深色、小圆角、三栏并排，像真的导播台；
 * 用户一眼就知道这是「直播前要过的流程」，不是视频脚本换了个标题。
 */
export type LiveResultProps = {
  segments: ScriptSegment[]
  review?: ScriptReviewItem[]
  spokenOf: (seg: ScriptSegment) => string
  onEdit: (segmentId: string, next: string) => void
  onAlternate: (seg: ScriptSegment) => Promise<void>
  editedIds: Set<string>
  altIds: Set<string>
  onOpenPrompter: () => void
}

/** 节点类型 → 颜色类，未知类型不着色 */
function nodeClass(type: string): string {
  return type === '互动' || type === '福利' || type === '促单' || type === '演示'
    ? `sl-node sl-node--${type}`
    : 'sl-node'
}

const LIVE_CHECKLIST_PAGE_SIZE = 6
const LIVE_TIMELINE_PAGE_SIZE = 5

function SidePanelPager({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number
  pageCount: number
  onPageChange: (next: number) => void
  className?: string
}) {
  if (pageCount <= 1) return null
  return (
    <div className={className ? `sl-side-pager ${className}` : 'sl-side-pager'}>
      <button
        type="button"
        className="sl-btn sl-btn--sm sl-side-pager__btn"
        disabled={page === 0}
        onClick={() => onPageChange(Math.max(0, page - 1))}
        aria-label={i18n.t('common:prevPage')}
      >
        <ChevronLeft size={14} aria-hidden="true" />
        {i18n.t('common:prevPage')}
      </button>
      <span className="sl-side-pager__meta" aria-live="polite">
        {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        className="sl-btn sl-btn--sm sl-side-pager__btn"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        aria-label={i18n.t('common:nextPage')}
      >
        {i18n.t('common:nextPage')}
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function LiveResult({
  segments,
  review,
  spokenOf,
  onEdit,
  onAlternate,
  editedIds,
  altIds,
  onOpenPrompter,
}: LiveResultProps) {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [checklistPage, setChecklistPage] = useState(0)
  const [timelinePage, setTimelinePage] = useState(0)
  const reviewById = new Map((review ?? []).map((r) => [r.segmentId, r]))
  const current = segments[Math.min(active, segments.length - 1)]

  // 预演：按各章时长比例推进进度条（1 秒 ≈ 1 章占比的 1/3，避免 2 小时的直播要等到天亮）
  useEffect(() => {
    if (!playing || !current) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = window.setTimeout(() => {
      setActive((prev) => {
        const next = prev + 1
        if (next >= segments.length) {
          setPlaying(false)
          return prev
        }
        return next
      })
    }, 3200)
    return () => window.clearTimeout(id)
  }, [playing, active, current, segments.length])

  useEffect(() => {
    setTimelinePage(Math.floor(active / LIVE_TIMELINE_PAGE_SIZE))
  }, [active])

  /** 控场清单：开播前固定项 + 逐章节点 */
  const checklist: Array<{ key: string; time: string; type: string; text: string }> = [
    { key: 'pre', time: '开播前', type: '', text: '检查灯光、产品、福利链接与网络。' },
  ]
  segments.forEach((seg) => {
    if (seg.nodes?.length) {
      seg.nodes.forEach((node: ScriptNode, k: number) => {
        checklist.push({
          key: `${seg.id}-${k}`,
          time: formatTimecode(seg.startSec),
          type: node.type,
          text: node.action,
        })
      })
    }
    if (seg.action) {
      checklist.push({
        key: `${seg.id}-a`,
        time: formatTimecode(seg.startSec),
        type: '',
        text: seg.action,
      })
    }
  })

  const done = checklist.filter((c) => checked[c.key]).length
  const checklistPageCount = Math.max(1, Math.ceil(checklist.length / LIVE_CHECKLIST_PAGE_SIZE))
  const safeChecklistPage = Math.min(checklistPage, checklistPageCount - 1)
  const checklistSlice = checklist.slice(
    safeChecklistPage * LIVE_CHECKLIST_PAGE_SIZE,
    safeChecklistPage * LIVE_CHECKLIST_PAGE_SIZE + LIVE_CHECKLIST_PAGE_SIZE,
  )

  const timelinePageCount = Math.max(1, Math.ceil(segments.length / LIVE_TIMELINE_PAGE_SIZE))
  const safeTimelinePage = Math.min(timelinePage, timelinePageCount - 1)
  const timelineSlice = segments.slice(
    safeTimelinePage * LIVE_TIMELINE_PAGE_SIZE,
    safeTimelinePage * LIVE_TIMELINE_PAGE_SIZE + LIVE_TIMELINE_PAGE_SIZE,
  )

  return (
    <div className="sl-liv">
      {/* 左：流程时间轴 */}
      <nav className="sl-tl" aria-label={i18n.t("uiCopy:流程时间轴", { keySeparator: false })}>
        <div className="sl-tl__list">
          {timelineSlice.map((seg, localIndex) => {
            const i = safeTimelinePage * LIVE_TIMELINE_PAGE_SIZE + localIndex
            return (
              <button
                key={seg.id}
                type="button"
                className="sl-tl__block"
                data-sel={i === active || undefined}
                style={{ flex: `${seg.share} 1 0`, minHeight: '74px' }}
                onClick={() => setActive(i)}
              >
                <small>{formatTimecode(seg.startSec)}</small>
                <b>{seg.name}</b>
                {seg.nodes?.length ? (
                  <span className="sl-tl__nodes">
                    {seg.nodes.map((node, k) => (
                      <span key={`${node.type}-${k}`} className={nodeClass(node.type)}>
                        {node.type}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <SidePanelPager
          page={safeTimelinePage}
          pageCount={timelinePageCount}
          onPageChange={setTimelinePage}
          className="sl-tl__pager"
        />
      </nav>

      {/* 中：主播提词面板 */}
      {current ? (
        <section className="sl-pm" aria-label={i18n.t("uiCopy:主播提词面板", { keySeparator: false })}>
          <div className="sl-pm__head">
            <span>
              
              {i18n.t("uiCopy:第", { keySeparator: false })} {active + 1}  {i18n.t("uiCopy:章，", { keySeparator: false })}{formatTimecode(current.startSec)}  {i18n.t("uiCopy:开始", { keySeparator: false })}
            </span>
            <b>{current.name}</b>
          </div>
          <div className="sl-pm__scroll">
            <EditableText
              value={spokenOf(current)}
              onCommit={(next) => onEdit(current.id, next)}
              ariaLabel={`第 ${active + 1} 章口播，可直接编辑`}
              className="sl-pm__body"
            />
            <div className="sl-pm__note">
              {current.purpose ? (
                <p style={{ margin: '12px 0 0' }}>
                  
                  {i18n.t("uiCopy:本章目的：", { keySeparator: false })}<b>{current.purpose}</b>
                </p>
              ) : null}
              {current.action ? (
                <p style={{ margin: '6px 0 0' }}>
                  
                  {i18n.t("uiCopy:互动与动作：", { keySeparator: false })}<b>{current.action}</b>
                </p>
              ) : null}
              {reviewById.get(current.id)?.mustFix ? (
                <p className="sl-note sl-note--flag" style={{ marginTop: 12 }}>
                  <TriangleAlert size={13} aria-hidden="true" />
                  
                  {i18n.t("uiCopy:评审认为这一章会冷场：", { keySeparator: false })}{reviewById.get(current.id)?.primaryIssue}
                </p>
              ) : null}
            </div>
          </div>
          <div className="sl-pm__foot">
            <button
              type="button"
              className="sl-btn sl-btn--sm"
              disabled={active === 0}
              onClick={() => setActive((v) => Math.max(0, v - 1))}
            >
              
              {i18n.t("uiCopy:上一章", { keySeparator: false })}
            </button>
            <button
              type="button"
              className="sl-btn sl-btn--sm"
              disabled={active >= segments.length - 1}
              onClick={() => setActive((v) => Math.min(segments.length - 1, v + 1))}
            >
              
              {i18n.t("uiCopy:下一章", { keySeparator: false })}
            </button>
            <button
              type="button"
              className="sl-btn sl-btn--sm"
              onClick={() => void onAlternate(current)}
            >
              <RefreshCw size={13} aria-hidden="true" style={{ verticalAlign: -2 }} />  {i18n.t("uiCopy:换一版", { keySeparator: false })}
            </button>
            <button
              type="button"
              className="sl-btn sl-btn--sm"
              aria-pressed={playing}
              onClick={() => {
                if (!playing) setActive(0)
                setPlaying((v) => !v)
              }}
            >
              {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
              {playing ? i18n.t("uiCopy:暂停预演", { keySeparator: false }) : i18n.t("uiCopy:预演流程", { keySeparator: false })}
            </button>
            <button type="button" className="sl-btn sl-btn--sm" onClick={onOpenPrompter}>
              <Send size={13} aria-hidden="true" style={{ verticalAlign: -2 }} />  {i18n.t("uiCopy:全屏提词器", { keySeparator: false })}
            </button>
            <button
              type="button"
              className="sl-btn sl-btn--sm"
              onClick={() => void copyText(spokenOf(current))}
            >
              <Copy size={13} aria-hidden="true" style={{ verticalAlign: -2 }} />  {i18n.t("uiCopy:复制本章", { keySeparator: false })}
            </button>
          </div>
          {altIds.has(current.id) ? <p className="sl-flag">{i18n.t("uiCopy:当前显示的是「换一版」结果", { keySeparator: false })}</p> : null}
          {editedIds.has(current.id) ? <p className="sl-flag">{i18n.t("uiCopy:已手工修改", { keySeparator: false })}</p> : null}
        </section>
      ) : null}

      {/* 右：控场清单 */}
      <aside className="sl-liv__aside">
        <div className="sl-ck">
          <h5>
            
            {i18n.t("uiCopy:控场清单（", { keySeparator: false })}{done}/{checklist.length}）
          </h5>
          <div className="sl-ck__list">
            {checklistSlice.map((c) => (
              <label key={c.key}>
                <input
                  type="checkbox"
                  checked={Boolean(checked[c.key])}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                />
                <span>
                  {c.type ? <span className={nodeClass(c.type)}>{c.type}</span> : null} {c.text}
                  <small>{c.time}</small>
                </span>
              </label>
            ))}
          </div>
          <SidePanelPager
            page={safeChecklistPage}
            pageCount={checklistPageCount}
            onPageChange={setChecklistPage}
            className="sl-ck__pager"
          />
        </div>
      </aside>
    </div>
  )
}

export default LiveResult
