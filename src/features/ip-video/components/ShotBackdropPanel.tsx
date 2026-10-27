/**
 * IP 口播视频 · 动效背景参数微调
 *
 * 镜头**挑选**在「预制组件与动效镜头」面板（那里是完整的 151 镜头库）。
 * 这里只负责已挂镜头的起止、变速、透明度，以及删除。
 *
 * 只写 `project.shots` 这一个字段，不动模板其余结构；清空即回到原行为。
 */

import { useState } from 'react'
import { Button } from '@no996/ui/button'
import { SHOT_CATALOG } from '@no996/video-editor'
import type { TemplateProject, TemplateShot } from '../lib/template-project'

export type ShotBackdropPanelProps = {
  project: TemplateProject
  onChange: (shots: TemplateShot[]) => void
  disabled?: boolean
}

export function ShotBackdropPanel({ project, onChange, disabled = false }: ShotBackdropPanelProps) {
  const shots = project.shots ?? []
  const [editing, setEditing] = useState<number | null>(null)

  const updateShot = (index: number, patch: Partial<TemplateShot>) => {
    onChange(shots.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const removeShot = (index: number) => {
    onChange(shots.filter((_, i) => i !== index))
    setEditing(null)
  }

  return (
    <div className="ipv-editor-section">
      <div className="flex items-center justify-between pb-2">
        <h3 className="font-semibold text-xs">动效背景</h3>
        {shots.length > 0 && (
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onChange([])}>
            清空
          </Button>
        )}
      </div>

      <div className="ipv-editor-section-body space-y-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
          从视频工厂的镜头库挑一个动效铺在背景。不选则沿用模板底色。
        </p>

        {/* 已挂载的镜头 */}
        {shots.length > 0 && (
          <ul className="m-0 p-0 list-none space-y-1">
            {shots.map((shot, index) => {
              const definition = SHOT_CATALOG.find((item) => item.shotId === shot.shotId)
              const isEditing = editing === index
              return (
                <li
                  key={`${shot.shotId}-${index}`}
                  className="rounded border border-input bg-muted/30 p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {definition?.name ?? shot.shotId}
                      <em className="ml-1 not-italic text-muted-foreground">
                        {shot.start.toFixed(1)}–{shot.end.toFixed(1)}s
                      </em>
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="text-[11px] text-primary"
                        onClick={() => setEditing(isEditing ? null : index)}
                      >
                        {isEditing ? '收起' : '调整'}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-destructive"
                        disabled={disabled}
                        onClick={() => removeShot(index)}
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground">开始（秒）</span>
                        <input
                          type="number"
                          min={0}
                          max={project.duration}
                          step={0.1}
                          value={shot.start}
                          disabled={disabled}
                          onChange={(e) =>
                            updateShot(index, {
                              start: Math.max(0, Math.min(Number(e.target.value) || 0, shot.end - 0.1)),
                            })
                          }
                          className="px-1.5 py-1 rounded bg-background border border-input text-[11px]"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground">结束（秒）</span>
                        <input
                          type="number"
                          min={0}
                          max={project.duration}
                          step={0.1}
                          value={shot.end}
                          disabled={disabled}
                          onChange={(e) =>
                            updateShot(index, {
                              end: Math.min(
                                project.duration,
                                Math.max(Number(e.target.value) || 0, shot.start + 0.1),
                              ),
                            })
                          }
                          className="px-1.5 py-1 rounded bg-background border border-input text-[11px]"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          变速 {(shot.rate ?? 1).toFixed(2)}×
                        </span>
                        <input
                          type="range"
                          min={0.25}
                          max={4}
                          step={0.05}
                          value={shot.rate ?? 1}
                          disabled={disabled}
                          onChange={(e) => updateShot(index, { rate: Number(e.target.value) })}
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          不透明度 {Math.round((shot.opacity ?? 1) * 100)}%
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.02}
                          value={shot.opacity ?? 1}
                          disabled={disabled}
                          onChange={(e) => updateShot(index, { opacity: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* 选择器已上移到「预制组件与动效镜头」面板（那里是完整的镜头库）。
            这里只保留已挂镜头的参数微调，避免同一个功能出现两套选法。 */}
        {shots.length === 0 && (
          <p className="m-0 text-[11px] text-muted-foreground">
            还没有挂镜头。在上方「预制组件与动效镜头」里点一下任意镜头即可加入。
          </p>
        )}
      </div>
    </div>
  )
}
