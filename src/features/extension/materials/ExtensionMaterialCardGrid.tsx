import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import type { SavedMaterial } from '../../../services/materials/material-repository'
import {
  materialBodyImages,
  materialCoverUrl,
  materialDisplayTitle,
  materialVideoUrls,
} from './material-media'
import { materialBodyFallbackAt, materialCoverFallback } from './material-media-helpers'
import { WorkbenchMediaImage } from './WorkbenchMediaImage'

type Props = {
  materials: SavedMaterial[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onOpen: (material: SavedMaterial) => void
  platformLabel: (platformId: SavedMaterial['platformId']) => string
}

/**
 * 平台角标配置
 * 小红书：红底白字“红”
 * 抖音：黑底白字“抖”
 * B站：青蓝底白字“B”
 * 微信：绿底白字“微”
 */
function renderPlatformBadge(platformId: SavedMaterial['platformId']) {
  switch (platformId) {
    case 'xiaohongshu':
      return (
        <span
          className="w-5 h-5 rounded-md bg-[#ff2442] text-white font-bold text-[11px] flex items-center justify-center shadow-sm select-none"
          title="小红书"
        >
          红
        </span>
      )
    case 'douyin':
      return (
        <span
          className="w-5 h-5 rounded-md bg-[#161823] text-white font-bold text-[11px] flex items-center justify-center shadow-sm select-none border border-white/10"
          title="抖音"
        >
          抖
        </span>
      )
    case 'bilibili':
      return (
        <span
          className="w-5 h-5 rounded-md bg-[#00aeec] text-white font-extrabold text-[11px] flex items-center justify-center shadow-sm select-none"
          title="哔哩哔哩"
        >
          B
        </span>
      )
    case 'weixin':
      return (
        <span
          className="w-5 h-5 rounded-md bg-[#07c160] text-white font-bold text-[11px] flex items-center justify-center shadow-sm select-none"
          title="微信"
        >
          微
        </span>
      )
    default:
      return null
  }
}

/**
 * 格式化媒体资源摘要：如 “8 图” 或 “视频”
 */
function getMediaCountSummary(m: SavedMaterial): string {
  const isVideo = Boolean(m.playUrl || materialVideoUrls(m).length > 0)
  if (isVideo) {
    return '视频'
  }
  const images = materialBodyImages(m)
  const count = images.length > 0 ? images.length : 1
  return `${count} 图`
}

/**
 * 格式化精选默认渐变底色，防止图裂或空封面时难看
 */
function getCardGradientBg(index: number) {
  const gradients = [
    'from-[#4338ca] via-[#3730a3] to-[#1e1b4b]', // 深紫
    'from-[#991b1b] via-[#831843] to-[#450a0a]', // 赭红
    'from-[#0f766e] via-[#115e59] to-[#042f2e]', // 墨绿青
    'from-[#1e293b] via-[#0f172a] to-[#020617]', // 曜黑
    'from-[#854d0e] via-[#713f12] to-[#422006]', // 琥珀焦糖
  ]
  return gradients[index % gradients.length]
}

export function ExtensionMaterialCardGrid({
  materials,
  selectedIds,
  onToggleSelect,
  onOpen,
  platformLabel,
}: Props) {
  const { t } = useTranslation('extension')

  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 list-none p-0 m-0">
      {materials.map((m, idx) => {
        const cover = materialCoverUrl(m)
        const isVideo = Boolean(m.playUrl || m.mediaLayout?.videoUrls?.length)
        const selected = selectedIds.has(m.id)
        const title = materialDisplayTitle(m)
        const mediaCount = getMediaCountSummary(m)
        const gradientClass = getCardGradientBg(idx)

        return (
          <li key={m.id} className="group relative flex flex-col">
            {/* 卡片主体容器 */}
            <div
              className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer ${
                selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
              }`}
            >
              {/* 竖版封面容器 (4:5 自媒体高保真比例) */}
              <div
                className={`relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-gradient-to-br ${gradientClass} flex items-end p-3.5 shadow-sm group-hover:shadow-md transition-shadow`}
                onClick={() => onOpen(m)}
              >
                {/* 真实媒体图片（如果有） */}
                {cover ? (
                  <div className="absolute inset-0 w-full h-full z-0">
                    <WorkbenchMediaImage
                      url={cover}
                      fallbackDataUrl={materialBodyFallbackAt(m, 0) ?? materialCoverFallback(m)}
                      alt={title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* 半透明渐变遮罩，衬托封面文本 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                  </div>
                ) : null}

                {/* 左上角玻璃质感复选框 */}
                <div
                  className="absolute top-2.5 left-2.5 z-20"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <label className="relative flex items-center justify-center w-6 h-6 rounded-md bg-black/40 backdrop-blur-md border border-white/30 cursor-pointer hover:bg-black/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelect(m.id)}
                      className="w-4 h-4 rounded text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer accent-primary"
                      aria-label={t('materialSelectItem', { title })}
                    />
                  </label>
                </div>

                {/* 右上角平台徽标 */}
                <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none">
                  {renderPlatformBadge(m.platformId)}
                </div>

                {/* 视频专属中央播放徽章 */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <span className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play size={20} fill="currentColor" className="ml-0.5" />
                    </span>
                  </div>
                )}

                {/* 封面内嵌底衬文字（模拟图文爆款大字排版效果） */}
                <div className="relative z-10 w-full pointer-events-none">
                  <p className="text-white font-extrabold text-sm sm:text-base leading-snug drop-shadow-md line-clamp-3">
                    {title}
                  </p>
                </div>
              </div>

              {/* 卡片下方详细信息区 */}
              <div className="pt-2 px-1 flex flex-col gap-0.5 text-left" onClick={() => onOpen(m)}>
                <h4 className="text-xs font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                  {title}
                </h4>
                <div className="flex items-center text-[11px] text-muted-foreground mt-0.5">
                  <span>
                    {platformLabel(m.platformId)} · {mediaCount}
                  </span>
                  {m.author && (
                    <span className="truncate max-w-[90px] ml-1">· {m.author}</span>
                  )}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
