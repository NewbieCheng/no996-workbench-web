/**
 * 监视器性能健康指示器与体验优化气泡 (Performance Health Popover)
 *
 * 核心设计准则：
 * 1. 科学度量：以动效镜头计算负荷为准，长音频流式播放对浏览器零压力；
 * 2. 贴心自愿：提供一键【草稿轻量流畅预览】开关，解决低配设备掉帧，导出依然保持 100% 全画质；
 * 3. 诚实严谨：说明浏览器客观边界，对桌面端原生加速进行合理前瞻，不放虚假入口。
 */

import { useState, useRef, useEffect } from 'react'
import type { EditorDocument } from '../../core/project.ts'
import { evaluateProjectWorkload } from '../../core/quota/shot-workload.ts'
import { formatTimeCode } from '../../core/time.ts'

export type PerformanceHealthPopoverProps = {
  doc: EditorDocument
  draftMode: boolean
  onToggleDraftMode: (enabled: boolean) => void
}

export function PerformanceHealthPopover({
  doc,
  draftMode,
  onToggleDraftMode,
}: PerformanceHealthPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const report = evaluateProjectWorkload(doc)

  // 点击外部自动关闭气泡
  useEffect(() => {
    if (!isOpen) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  // 状态颜色定义
  const levelColors = {
    healthy: { dot: '#10b981', text: '#34d399', bg: 'rgba(16, 185, 129, 0.12)' },
    moderate: { dot: '#f59e0b', text: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
    heavy: { dot: '#f97316', text: '#fb923c', bg: 'rgba(249, 115, 22, 0.12)' },
  }[report.level]

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      {/* 监视器顶栏胶囊指示按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title="查看当前浏览器运行负荷与体验优化建议"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          background: levelColors.bg,
          border: `1px solid ${levelColors.dot}44`,
          color: levelColors.text,
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: levelColors.dot,
            boxShadow: `0 0 6px ${levelColors.dot}`,
          }}
        />
        <span>{report.title}</span>
        {draftMode && (
          <span
            style={{
              fontSize: 9,
              padding: '0 4px',
              borderRadius: 3,
              background: 'var(--primary, #3b82f6)',
              color: '#ffffff',
              marginLeft: 2,
            }}
          >
            草稿中
          </span>
        )}
      </button>

      {/* 弹出的贴心健康中心气泡 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 100,
            width: 290,
            background: 'rgba(15, 20, 32, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 8,
            padding: 12,
            color: '#e2e8f0',
            fontSize: 11,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* 头部标题与关闭 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: levelColors.dot }} />
              <span style={{ fontWeight: 600, fontSize: 12, color: '#ffffff' }}>浏览器性能与健康度</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0 }}
            >
              ×
            </button>
          </div>

          {/* 负荷状态描述 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
              {report.description}
            </span>
            <div style={{ fontSize: 10, color: '#94a3b8', display: 'flex', gap: 10, marginTop: 2 }}>
              <span>动效镜头: <strong style={{ color: '#ffffff' }}>{report.shotCount}</strong> 镜</span>
              <span>高负荷特效: <strong style={{ color: '#ffffff' }}>{report.heavyShotCount}</strong> 镜</span>
            </div>
            {report.audioDurationUs > 60_000_000 && (
              <span style={{ fontSize: 10, color: '#38bdf8', marginTop: 2 }}>
                ✓ 包含 {formatTimeCode(report.audioDurationUs)} 录音（纯音频流式播放零卡顿）
              </span>
            )}
          </div>

          {/* 草稿轻量流畅预览开关卡片 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: 6,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, color: '#ffffff', fontSize: 11 }}>草稿流畅预览模式</span>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>
                去除重阴影与复杂滤镜，30FPS 丝滑走带；成片导出仍为全高清
              </span>
            </div>
            <input
              type="checkbox"
              checked={draftMode}
              onChange={(e) => onToggleDraftMode(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary, #3b82f6)' }}
            />
          </div>

          {/* 诚实的技术前瞻与建议 */}
          <div
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px dashed rgba(59, 130, 246, 0.3)',
              fontSize: 10,
              color: '#93c5fd',
              lineHeight: 1.4,
            }}
          >
            <strong>💡 专业建议与前瞻说明：</strong>
            <br />
            短视频黄金完播率通常在 15~60 秒，更精炼的节奏转化效果更佳。更强大的原生独立多进程与 GPU 硬件加速桌面专业版已在全力研发路标中，敬请期待！
          </div>
        </div>
      )}
    </div>
  )
}
