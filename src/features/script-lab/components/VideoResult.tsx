import { useEffect, useState } from 'react'
import { Clapperboard, Copy, Pause, Play, RefreshCw, TriangleAlert } from 'lucide-react'
import { copyText } from '../../../services/browser'
import type { ScriptReviewItem, ScriptSegment } from '../agent/types'
import EditableText from './EditableText'
import { formatTimecode } from '../agent/finalize'
import i18n from '@/i18n'

/**
 * 视频脚本结果：**竖屏手机预览 + 分镜列表**（按参考稿重做）。
 *
 * 与直播页刻意做出差异：这里是亮色、大圆角、有「手机」这个具象载体，
 * 用户一眼就知道自己在改一条短视频，而不是看到一张通用表格。
 *
 * 手机预览只做呈现；编辑在右侧分镜里完成，避免在 264px 宽的屏里改字。
 */
export type VideoResultProps = {
  segments: ScriptSegment[]
  review?: ScriptReviewItem[]
  spokenOf: (seg: ScriptSegment) => string
  onEdit: (segmentId: string, next: string) => void
  onAlternate: (seg: ScriptSegment) => Promise<void>
  editedIds: Set<string>
  altIds: Set<string>
}

export function VideoResult({
  segments,
  review,
  spokenOf,
  onEdit,
  onAlternate,
  editedIds,
  altIds,
}: VideoResultProps) {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const current = segments[Math.min(active, segments.length - 1)]
  const reviewById = new Map((review ?? []).map((r) => [r.segmentId, r]))
  const total = segments.at(-1)?.endSec ?? 0

  // 预演节奏：每 2.3 秒切下一段，让用户直观感受节奏
  useEffect(() => {
    if (!playing || segments.length < 2) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const id = window.setInterval(() => {
      setActive((prev) => {
        const next = prev + 1
        if (next >= segments.length) {
          setPlaying(false)
          return prev
        }
        return next
      })
    }, 2300)
    return () => window.clearInterval(id)
  }, [playing, segments.length])

  return (
    <div className="sl-vid">
      {/* 竖屏预览 */}
      {current ? (
        <div className="sl-phone-wrap">
          <div className="sl-phone" aria-label={i18n.t("uiCopy:竖屏手机预览", { defaultValue: "竖屏手机预览", keySeparator: false })}>
            <div className="sl-phone__meta">
              <span className="sl-phone__seg-tag">{String(active + 1).padStart(2, '0')} · {current.name}</span>
              <span className="sl-phone__timecode">{formatTimecode(current.startSec)} / {formatTimecode(total)}</span>
            </div>

            <div className="sl-phone__body">
              <p
                className={`sl-phone__cap ${
                  spokenOf(current).length > 80
                    ? 'sl-phone__cap--compact'
                    : spokenOf(current).length > 40
                      ? 'sl-phone__cap--medium'
                      : ''
                }`}
              >
                {spokenOf(current)}
              </p>
            </div>

            {current.visual ? (
              <div className="sl-phone__hint">
                <div className="sl-phone__hint-label">
                  <Clapperboard size={11} aria-hidden="true" />
                  <span>{i18n.t("uiCopy:画面：", { defaultValue: "画面：", keySeparator: false })}</span>
                </div>
                <div className="sl-phone__hint-text">{current.visual}</div>
              </div>
            ) : null}

            <div className="sl-phone__bar">
              {segments.map((seg, i) => (
                <button
                  key={seg.id}
                  type="button"
                  style={{ flex: Math.max(0.4, seg.share) }}
                  data-on={i <= active || undefined}
                  aria-label={`跳到第 ${i + 1} 段：${seg.name}`}
                  onClick={() => setActive(i)}
                />
              ))}
            </div>
          </div>
          <div className="sl-phone__play">
            <button
              type="button"
              className={`sl-btn sl-btn--sm sl-phone__play-btn ${playing ? 'sl-phone__play-btn--active' : ''}`}
              aria-pressed={playing}
              onClick={() => {
                if (!playing) setActive(0)
                setPlaying((v) => !v)
              }}
            >
              {playing ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
              <span>
                {playing
                  ? i18n.t("uiCopy:暂停预演", { defaultValue: "暂停预演", keySeparator: false })
                  : i18n.t("uiCopy:预演节奏", { defaultValue: "预演节奏", keySeparator: false })}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {/* 分镜列表 */}
      <div className="sl-story">
        {segments.map((seg, i) => {
          const item = reviewById.get(seg.id)
          const usingAlt = altIds.has(seg.id)
          const isEdited = editedIds.has(seg.id)
          return (
            <div
              key={seg.id}
              className="sl-story__row"
              data-sel={i === active || undefined}
              onClick={() => setActive(i)}
            >
              <div className="sl-story__no">
                <b>{String(i + 1).padStart(2, '0')}</b>
                <span>
                  {formatTimecode(seg.startSec)}–{formatTimecode(seg.endSec)}
                </span>
              </div>
              <div>
                <div>
                  <span className="sl-story__name">{seg.name}</span>
                  {seg.purpose ? <span className="sl-story__purpose">{seg.purpose}</span> : null}
                </div>
                <EditableText
                  value={spokenOf(seg)}
                  onCommit={(next) => onEdit(seg.id, next)}
                  ariaLabel={`第 ${i + 1} 段口播，可直接编辑`}
                  singleLine={false}
                />
                {seg.visual ? <p className="sl-story__visual">{i18n.t("uiCopy:画面：", { keySeparator: false })}{seg.visual}</p> : null}
                {item?.mustFix ? (
                  <p className="sl-note sl-note--flag">
                    <TriangleAlert size={13} aria-hidden="true" />
                    
                    {i18n.t("uiCopy:评审认为这一段会掉线：", { keySeparator: false })}{item.primaryIssue}
                    {item.improvementDirection ? `｜建议：${item.improvementDirection}` : ''}
                  </p>
                ) : null}
                <div className="sl-story__tools">
                  <button
                    type="button"
                    className="sl-btn sl-btn--sm"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await copyText(spokenOf(seg))
                    }}
                  >
                    <Copy size={13} aria-hidden="true" style={{ verticalAlign: -2 }} />  {i18n.t("workbench:titlesCopyBtn")}
                  </button>
                  <button
                    type="button"
                    className="sl-btn sl-btn--sm"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await onAlternate(seg)
                    }}
                  >
                    <RefreshCw size={13} aria-hidden="true" style={{ verticalAlign: -2 }} />  {i18n.t("uiCopy:换一版", { keySeparator: false })}
                  </button>
                  {usingAlt ? <span className="sl-flag">{i18n.t("uiCopy:当前显示的是「换一版」结果", { keySeparator: false })}</span> : null}
                  {isEdited ? <span className="sl-flag">{i18n.t("uiCopy:已手工修改", { keySeparator: false })}</span> : null}
                  {seg.versions.length > 1 ? (
                    <span className="sl-timechip">{i18n.t("uiCopy:已迭代", { keySeparator: false })} {seg.versions.length}  {i18n.t("uiCopy:版", { keySeparator: false })}</span>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VideoResult
