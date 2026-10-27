import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, FolderArchive, Loader2 } from 'lucide-react'
import { useAuth } from '../../../auth/AuthContext'
import {
  materialRepository,
  type SavedMaterial,
} from '../../../services/materials/material-repository'
import {
  materialCoverUrl,
  materialDisplayTitle,
} from '../../extension/materials/material-media'

type WizardLocalMaterialPickerProps = {
  platform: 'xhs' | 'wechat'
  onPick: (material: SavedMaterial) => void
}

export function WizardLocalMaterialPicker({ platform, onPick }: WizardLocalMaterialPickerProps) {
  const { userId } = useAuth()
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [materials, setMaterials] = useState<SavedMaterial[]>([])

  const platformId = platform === 'xhs' ? 'xiaohongshu' : 'weixin'

  useEffect(() => {
    if (userId == null) {
      setMaterials([])
      return
    }
    let mounted = true
    setLoading(true)
    void materialRepository
      .listMaterials(userId, platformId)
      .then((list) => {
        if (mounted) setMaterials(list)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [userId, platformId])

  return (
    <div className="ssw-material-import">
      <div className="ssw-material-import__head">
        <button
          type="button"
          className="ssw-material-import__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <FolderArchive size={13} aria-hidden />
          <span>本机素材库</span>
          <span className="ssw-material-import__count">{materials.length}</span>
          {open ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
        </button>
        <Link to="/workbench/extension" className="ssw-material-import__link">
          去采集
        </Link>
      </div>

      {open ? (
        <div className="ssw-material-import__body">
          {userId == null ? (
            <p className="ssw-material-import__empty">登录后可导入扩展页「素材库」里已采集的内容。</p>
          ) : loading ? (
            <p className="ssw-material-import__empty">
              <Loader2 size={12} className="inline animate-spin mr-1" aria-hidden />
              正在读取本机素材…
            </p>
          ) : materials.length === 0 ? (
            <p className="ssw-material-import__empty">
              暂无素材。请先在
              <Link to="/workbench/extension">扩展 · 爆款采集</Link>
              抓取，保存后会出现在素材库。
            </p>
          ) : (
            <ul className="ssw-material-import__list">
              {materials.slice(0, 12).map((mat) => {
                const cover = materialCoverUrl(mat)
                const title = materialDisplayTitle(mat)
                return (
                  <li key={mat.id}>
                    <button type="button" className="ssw-material-import__item" onClick={() => onPick(mat)}>
                      {cover ? (
                        <img src={cover} alt="" className="ssw-material-import__thumb" loading="lazy" />
                      ) : (
                        <span className="ssw-material-import__thumb ssw-material-import__thumb--placeholder" />
                      )}
                      <span className="ssw-material-import__item-title">{title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {materials.length > 12 ? (
            <p className="ssw-material-import__more">
              还有 {materials.length - 12} 条，
              <Link to="/workbench/extension">在素材库查看全部</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
