/**
 * 视频封面与品牌样式编辑小节
 * 支持设置长短标题、副标题、按时间戳抽取视频帧与品牌主色设定
 */

import React from 'react'
import type { CoverMetadata, BrandPreset } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'
import { formatTimeCode } from '../../core/time.ts'

export type CoverEditorProps = {
  cover?: CoverMetadata
  brand?: BrandPreset
  playheadUs: TimeUs
  onUpdateCover: (patch: Partial<CoverMetadata>) => void
  onUpdateBrand: (patch: Partial<BrandPreset>) => void
}

export function CoverEditor({
  cover = {},
  brand = { brandColor: '#2563eb' },
  playheadUs,
  onUpdateCover,
  onUpdateBrand,
}: CoverEditorProps) {
  const inputStyle: React.CSSProperties = {
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
  }

  const btnStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: 11,
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--foreground)',
    cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>视频封面与包装</div>

      {/* 封面标题与副标题 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--muted-foreground)' }}>
          封面主标题:
          <input
            type="text"
            placeholder="输入吸睛大标题..."
            value={cover.title || ''}
            onChange={(e) => onUpdateCover({ title: e.target.value })}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--muted-foreground)' }}>
          封面副标题:
          <input
            type="text"
            placeholder="输入补充亮点或标签..."
            value={cover.subtitle || ''}
            onChange={(e) => onUpdateCover({ subtitle: e.target.value })}
            style={inputStyle}
          />
        </label>
      </div>

      {/* 截帧时间戳 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--muted)', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>截帧点时间</span>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
            {formatTimeCode(cover.timestampUs ?? 0)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onUpdateCover({ timestampUs: playheadUs })}
          style={btnStyle}
          title="使用当前播放头所在时刻画面作为封面底图"
        >
          捕获当前帧
        </button>
      </div>

      {/* 品牌样式设置 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #21262d', paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: '#8b949e' }}>企业/个人品牌主色</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={brand.brandColor}
            onChange={(e) => onUpdateBrand({ brandColor: e.target.value })}
            style={{ width: 32, height: 28, border: 'none', background: 'transparent', cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9d1d9' }}>{brand.brandColor}</span>
        </div>
      </div>
    </div>
  )
}
