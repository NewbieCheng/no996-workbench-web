/**
 * @file SourceInput.tsx
 * 通用参考输入组件：一键链接输入 或 引用本机已采集素材
 */

import { useEffect, useState } from 'react'
import { Link2, FolderHeart, Sparkles, CheckCircle2 } from 'lucide-react'
import { Input } from '@no996/ui/input'
import { Button } from '@no996/ui/button'
import { useAuth } from '../auth/AuthContext'
import { materialRepository, type SavedMaterial } from '../services/materials/material-repository'

export interface SourceInputProps {
  onSourceSelect?: (source: { url?: string; materialId?: string; content?: string }) => void
  onDirectCollectAndGenerate?: (url: string) => void
  disabled?: boolean
}

export function SourceInput({ onSourceSelect, onDirectCollectAndGenerate, disabled }: SourceInputProps) {
  const { userId } = useAuth()
  const [url, setUrl] = useState('')
  const [materials, setMaterials] = useState<SavedMaterial[]>([])
  const [selectedMatId, setSelectedMatId] = useState<string>('')
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    if (userId != null) {
      void materialRepository.listMaterials(userId).then(setMaterials)
    }
  }, [userId])

  const handleUrlChange = (val: string) => {
    setUrl(val)
    if (val.trim()) {
      setSelectedMatId('')
      onSourceSelect?.({ url: val.trim() })
    }
  }

  const handlePickMaterial = (mat: SavedMaterial) => {
    setSelectedMatId(mat.id)
    setUrl('')
    setShowPicker(false)
    onSourceSelect?.({
      materialId: mat.id,
      content: mat.content || mat.title,
    })
  }

  const selectedMaterial = materials.find((m) => m.id === selectedMatId)

  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Link2 size={16} />
          </div>
          <span className="text-sm font-semibold tracking-tight">导入参考来源</span>
          <span className="text-xs text-muted-foreground">（支持抖音、小红书、B站单作品链接）</span>
        </div>
        {materials.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowPicker(!showPicker)}
          >
            <FolderHeart size={14} />
            {showPicker ? '收起素材库' : `选已存素材 (${materials.length})`}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="粘贴抖音/小红书/B站链接，一键自动采集并创作…"
          value={url}
          disabled={disabled}
          onChange={(e) => handleUrlChange(e.target.value)}
          className="flex-1 bg-background/80"
        />
        {onDirectCollectAndGenerate && (
          <Button
            size="sm"
            disabled={!url.trim() || disabled}
            onClick={() => onDirectCollectAndGenerate(url.trim())}
            className="gap-1.5 shrink-0"
          >
            <Sparkles size={14} />
            一键创作
          </Button>
        )}
      </div>

      {selectedMaterial && (
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary border border-primary/20">
          <div className="flex items-center gap-2 overflow-hidden">
            <CheckCircle2 size={14} className="shrink-0" />
            <span className="truncate font-medium">已选用本地素材：{selectedMaterial.title || selectedMaterial.url}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelectedMatId('')
              onSourceSelect?.({})
            }}
          >
            取消引用
          </Button>
        </div>
      )}

      {showPicker && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-background/95 p-2 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground px-1 pb-1">点击选择作为二次创作素材：</div>
          {materials.map((m) => (
            <div
              key={m.id}
              onClick={() => handlePickMaterial(m)}
              className={`flex items-center justify-between rounded-md p-2 text-xs transition-colors cursor-pointer hover:bg-muted ${
                selectedMatId === m.id ? 'bg-primary/10 font-medium text-primary' : 'text-foreground'
              }`}
            >
              <div className="truncate max-w-[80%]">
                <span className="font-semibold text-muted-foreground mr-1.5">[{m.platformId}]</span>
                {m.title || m.url}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(m.collectedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
