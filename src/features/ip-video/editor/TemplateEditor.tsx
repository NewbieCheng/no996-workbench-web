import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Moveable from 'react-moveable'
import { Button } from '@no996/ui/button'
import { IpVideoStageShell } from '../components/IpVideoStageShell'
import { TemplateCanvas } from '../components/TemplateCanvas'
import { layerBoxToPixel, percentBoxStyle, pixelToLayerBox } from './moveable-layout'
import { useIpVideoMoveable } from './useIpVideoMoveable'
import { clampBox, OUTPUT_HEIGHT, OUTPUT_WIDTH, TEMPLATE_FONT, type EditableLayerId, type LayerBox, type TemplateProject, type TextLayer } from '../lib/template-project.ts'
import { CaptionsEditor } from './CaptionsEditor'
import { PresetsPanel } from './PresetsPanel'
import { AssemblyControlPanel } from '../components/AssemblyControlPanel'
import { ShotBackdropPanel } from '../components/ShotBackdropPanel'
import { ASSEMBLY_STYLES } from '@no996/video-editor/core'
import { ChoiceField, ColorField, NumberField, TextField } from './fields'
import { commitHistory, createHistory, nudgeLayer, redoHistory, resetLayout, SAFE_INSET, sameProject, undoHistory, type ProjectHistory } from './model.ts'
import './editor.css'

export type TemplateEditorProps = { project: TemplateProject; cover: Blob; time: number; onChange: (project: TemplateProject) => void; owner: number; controls?: ReactNode; disabled?: boolean }
type Gesture = { project: TemplateProject; layer: EditableLayerId; box: LayerBox; scale: number; kind: 'drag' | 'resize' }
const LAYERS: EditableLayerId[] = ['photo', 'title', 'subtitle']

/** The caller lazy-loads this module, including Moveable. Account changes remount all private drafts. */
export function TemplateEditor(props: TemplateEditorProps) { return <EditorSession key={props.owner} {...props} /> }
export default TemplateEditor

function EditorSession({ project, cover, time, onChange, owner, controls, disabled = false }: TemplateEditorProps) {
  const { t } = useTranslation('ipVideo')
  const [history, setHistory] = useState(() => createHistory(project))
  const historyRef = useRef(history)
  const [projection, setProjection] = useState<TemplateProject | null>(null)
  const projectionRef = useRef<TemplateProject | null>(null)
  const [selected, setSelected] = useState<EditableLayerId>('subtitle')
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const proxies = useRef<Partial<Record<EditableLayerId, HTMLDivElement | null>>>({})
  const stage = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const current = useRef({ disabled, onChange })
  current.current = { disabled, onChange }
  const [overflow, setOverflow] = useState(false)
  const [snapping, setSnapping] = useState(true)
  const [showGuides, setShowGuides] = useState(true)
  const keyGesture = useRef(false)
  const keyProjection = useRef<TemplateProject | null>(null)
  const [draftEpoch, setDraftEpoch] = useState(0)
  const display = projection ?? history.present
  const layer = display[selected]
  const textLayer = selected === 'photo' ? null : display[selected]

  const clearProjection = () => { gesture.current = null; keyGesture.current = false; keyProjection.current = null; projectionRef.current = null; setProjection(null) }
  const publishHistory = (next: ProjectHistory) => {
    if (next === historyRef.current || current.current.disabled) return
    historyRef.current = next; setHistory(next); clearProjection()
    current.current.onChange(next.present)
  }
  const commit = (next: TemplateProject) => publishHistory(commitHistory(historyRef.current, next))
  // A parent's acknowledgement preserves undo. A genuinely external project clears old history and drafts.
  useLayoutEffect(() => {
    if (sameProject(project, historyRef.current.present)) return
    const next = createHistory(project)
    historyRef.current = next; setHistory(next); clearProjection(); setDraftEpoch(value => value + 1)
  }, [project])
  useLayoutEffect(() => { if (disabled) clearProjection() }, [disabled])
  const {
    moveableRef: sharedMoveableRef,
    scale,
    beginGesture: beginMoveableGesture,
    clearGesture: clearMoveableGesture,
    verticalGuidelines,
    horizontalGuidelines,
    moveableHandlers
  } = useIpVideoMoveable({
    stageRef: stage,
    outputWidth: OUTPUT_WIDTH,
    outputHeight: OUTPUT_HEIGHT,
    disabled,
    snapping,
    safeInset: SAFE_INSET
  })
  useLayoutEffect(() => {
    setTarget(proxies.current[selected] ?? null)
    if (!gesture.current) sharedMoveableRef.current?.updateRect()
  }, [selected, display, scale, disabled, sharedMoveableRef])

  const selectForDrag = (id: EditableLayerId, inputEvent: MouseEvent | TouchEvent) => {
    if (current.current.disabled || selected === id) return
    const changed = sharedMoveableRef.current?.waitToChangeTarget()
    setSelected(id)
    if (changed) void changed.then(() => { if (!current.current.disabled) sharedMoveableRef.current?.dragStart(inputEvent) })
  }
  const beginGesture = (kind: Gesture['kind']) => {
    if (current.current.disabled || !stage.current) return null
    const base = historyRef.current.present
    const box = layerBoxToPixel(base[selected])
    const moveableGesture = beginMoveableGesture(kind, box)
    if (!moveableGesture) return null
    const start: Gesture = { project: base, layer: selected, box: { ...base[selected] }, scale: moveableGesture.scale, kind }
    gesture.current = start
    return start
  }
  const projectBox = (box: LayerBox) => {
    const active = gesture.current
    if (!active || current.current.disabled) return
    const next = { ...active.project, [active.layer]: { ...active.project[active.layer], ...clampBox(box) } }
    projectionRef.current = next; setProjection(next)
  }
  const endGesture = () => {
    if (!gesture.current) return
    const next = projectionRef.current
    clearProjection()
    clearMoveableGesture()
    if (next && !current.current.disabled) commit(next)
  }
  const patchBox = (key: keyof LayerBox, value: number) => {
    const base = historyRef.current.present
    commit({ ...base, [selected]: { ...base[selected], ...clampBox({ ...base[selected], [key]: value }) } })
  }
  const patchText = (patch: Partial<TextLayer>) => {
    if (selected === 'photo') return
    const base = historyRef.current.present
    commit({ ...base, [selected]: { ...base[selected], ...patch } })
  }
  const finishKeys = () => {
    const next = keyProjection.current
    if (!keyGesture.current) return
    clearProjection()
    if (next && !current.current.disabled) commit(next)
  }
  const handleKey = (event: KeyboardEvent<HTMLDivElement>, id: EditableLayerId) => {
    if (disabled || event.target !== event.currentTarget) return
    const modifier = event.ctrlKey || event.metaKey
    if (modifier && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); finishKeys()
      publishHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? redoHistory(historyRef.current) : undoHistory(historyRef.current)); return
    }
    if (event.key === 'Escape') { clearProjection(); return }
    const offset: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const delta = offset[event.key]
    if (!delta || modifier || event.altKey) return
    event.preventDefault()
    keyGesture.current = true
    const distance = event.shiftKey ? 10 : 1
    const next = nudgeLayer(keyProjection.current ?? historyRef.current.present, id, delta[0] * distance, delta[1] * distance)
    keyProjection.current = next; projectionRef.current = next; setProjection(next)
  }
  const boxLimits = { x: OUTPUT_WIDTH - layer.width, y: OUTPUT_HEIGHT - layer.height, width: OUTPUT_WIDTH - layer.x, height: OUTPUT_HEIGHT - layer.y }
  return <section className="ipv-editor" aria-label={t('editor.label')} data-disabled={disabled}>
    <div className="ipv-editor-workspace">
      <div className="ipv-editor-stage-column">
        <div className="ipv-editor-toolbar">
          <Button type="button" variant="toolbar" disabled={disabled || !history.past.length} onClick={() => publishHistory(undoHistory(historyRef.current))}>{t('editor.undo')}</Button>
          <Button type="button" variant="toolbar" disabled={disabled || !history.future.length} onClick={() => publishHistory(redoHistory(historyRef.current))}>{t('editor.redo')}</Button>
          <Button type="button" variant="toolbar" disabled={disabled} onClick={() => commit(resetLayout(historyRef.current.present))}>{t('editor.reset')}</Button>
        </div>
        <IpVideoStageShell stageRef={stage} variant="compact" surroundClassName="ipv-stage-surround--dark-studio">
            <TemplateCanvas project={display} cover={cover} time={time} className="ipv-editor-canvas" onOverflow={setOverflow} />
            {showGuides && <div className="ipv-editor-safe" aria-hidden="true" style={{ inset: `${SAFE_INSET / OUTPUT_HEIGHT * 100}% ${SAFE_INSET / OUTPUT_WIDTH * 100}%` }} />}
            {LAYERS.map(id => {
              const box = display[id]
              return <div key={id} ref={node => { proxies.current[id] = node }} className="ipv-editor-proxy" role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={t('editor.selectLayer', { layer: t(`editor.layers.${id}`) })} aria-pressed={selected === id} data-selected={selected === id} data-layer={id}
                style={percentBoxStyle(layerBoxToPixel(box), OUTPUT_WIDTH, OUTPUT_HEIGHT)}
                onMouseDown={event => selectForDrag(id, event.nativeEvent)} onTouchStart={event => selectForDrag(id, event.nativeEvent)} onFocus={() => { if (!disabled) setSelected(id) }} onClick={() => { if (!disabled) setSelected(id) }}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(id) } else handleKey(event, id) }} onKeyUp={event => { if (event.key.startsWith('Arrow')) finishKeys() }} onBlur={finishKeys} />
            })}
            {!disabled && target && <Moveable ref={sharedMoveableRef} target={target} container={stage.current} draggable resizable origin={false} keepRatio={false} throttleDrag={0} throttleResize={0} renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
              snappable={snapping} snapThreshold={6} snapDirections={{ left: true, right: true, top: true, bottom: true, center: true, middle: true }} elementSnapDirections={{ left: true, right: true, top: true, bottom: true, center: true, middle: true }}
              verticalGuidelines={verticalGuidelines} horizontalGuidelines={horizontalGuidelines} isDisplaySnapDigit={false}
              onDragStart={event => { if (!beginGesture('drag')) { event.stopDrag(); return } event.set([0, 0]) }}
              onDrag={event => {
                moveableHandlers.onDrag(event, box => {
                  const active = gesture.current
                  if (!active || active.kind !== 'drag') return
                  projectBox({ ...active.box, ...pixelToLayerBox(box) })
                })
              }} onDragEnd={endGesture}
              onResizeStart={event => {
                const active = beginGesture('resize')
                if (!active) { event.stopDrag(); return }
                event.set([active.box.width * active.scale, active.box.height * active.scale])
                event.setMin([80 * active.scale, 60 * active.scale])
                event.setMax([OUTPUT_WIDTH * active.scale, OUTPUT_HEIGHT * active.scale])
                if (event.dragStart) event.dragStart.set([0, 0])
              }} onResize={event => {
                moveableHandlers.onResize(event, box => {
                  const active = gesture.current
                  if (!active || active.kind !== 'resize') return
                  projectBox({ ...active.box, ...pixelToLayerBox(box) })
                })
              }} onResizeEnd={endGesture} />}
        </IpVideoStageShell>
        <div className="ipv-editor-controls">{controls}</div>
        <p className="ipv-editor-hint">{t('editor.canvasHelp')}</p>
        {overflow && <p className="ipv-editor-warning" role="status">{t('editor.overflow')}</p>}
      </div>
      <aside className="ipv-editor-properties" aria-label={t('editor.properties')}>
        <div className="ipc-inspector-tabs" role="tablist" aria-label={t('editor.selectLayers')}>
          {(['title', 'subtitle', 'photo'] as const).map(id => (
            <button
              type="button"
              key={id}
              role="tab"
              className="ipc-inspector-tab"
              data-active={selected === id}
              disabled={disabled}
              onClick={() => {
                finishKeys()
                setSelected(id)
              }}
            >
              <span>{t(`editor.layers.${id}`)}</span>
            </button>
          ))}
        </div>
        <div className="ipv-editor-actions ipv-editor-view-options">
          <Button type="button" variant="toolbar" aria-pressed={snapping} disabled={disabled} onClick={() => setSnapping(value => !value)}>{t('editor.snapping')}</Button>
          <Button type="button" variant="toolbar" aria-pressed={showGuides} onClick={() => setShowGuides(value => !value)}>{t('editor.safeArea')}</Button>
        </div>
        <section className="ipv-editor-section"><h3>{t('editor.layout')}</h3><div className="ipv-editor-section-body" key={`${selected}-${draftEpoch}`}>
          <p className="ipv-editor-hint">{t('editor.coordinateHelp')}</p>
          <div className="ipv-editor-grid">{(['x', 'y', 'width', 'height'] as const).map(key => <NumberField key={key} label={t(`editor.box.${key}`)} value={layer[key]} min={key === 'width' ? 80 : key === 'height' ? 60 : 0} max={boxLimits[key]} onCommit={value => patchBox(key, value)} disabled={disabled} />)}</div>
          <div className="ipv-editor-actions">
            <Button type="button" variant="toolbar" disabled={disabled} onClick={() => patchBox('x', (OUTPUT_WIDTH - layer.width) / 2)}>{t('editor.centerHorizontal')}</Button>
            <Button type="button" variant="toolbar" disabled={disabled} onClick={() => patchBox('y', (OUTPUT_HEIGHT - layer.height) / 2)}>{t('editor.centerVertical')}</Button>
          </div>
          {selected === 'photo' ? <div className="ipv-editor-grid">
            <NumberField label={t('editor.focalX')} value={display.photo.focalX} min={0} max={1} step={0.01} disabled={disabled} onCommit={value => commit({ ...historyRef.current.present, photo: { ...historyRef.current.present.photo, focalX: value } })} />
            <NumberField label={t('editor.focalY')} value={display.photo.focalY} min={0} max={1} step={0.01} disabled={disabled} onCommit={value => commit({ ...historyRef.current.present, photo: { ...historyRef.current.present.photo, focalY: value } })} />
          </div> : textLayer && <>
            {selected === 'title' && <TextField label={t('editor.titleText')} value={textLayer.text} disabled={disabled} onCommit={text => patchText({ text, enabled: Boolean(text.trim()) })} />}
            <Button type="button" variant="toolbar" aria-pressed={textLayer.enabled} disabled={disabled} onClick={() => patchText({ enabled: !textLayer.enabled })}>{t('editor.layerVisible')}</Button>
            <ChoiceField label={t('editor.font')} value={textLayer.font} disabled={disabled} options={[
              { value: TEMPLATE_FONT, label: t('editor.fonts.sans') }, { value: 'serif', label: t('editor.fonts.serif') }, { value: 'KaiTi, STKaiti, serif', label: t('editor.fonts.kai') },
              ...([TEMPLATE_FONT, 'serif', 'KaiTi, STKaiti, serif'].includes(textLayer.font) ? [] : [{ value: textLayer.font, label: t('editor.fonts.current') }])
            ]} onChange={font => patchText({ font })} />
            <div className="ipv-editor-grid">
              <NumberField label={t('editor.fontSize')} value={textLayer.size} min={16} max={180} disabled={disabled} onCommit={size => patchText({ size })} />
              <NumberField label={t('editor.fontWeight')} value={textLayer.weight} min={100} max={900} step={100} disabled={disabled} onCommit={weight => patchText({ weight })} />
              <NumberField label={t('editor.lineHeight')} value={textLayer.lineHeight} min={1} max={2.5} step={0.05} disabled={disabled} onCommit={lineHeight => patchText({ lineHeight })} />
              <NumberField label={t('editor.letterSpacing')} value={textLayer.letterSpacing} min={-20} max={20} step={0.5} disabled={disabled} onCommit={letterSpacing => patchText({ letterSpacing })} />
              <ColorField label={t('editor.color')} value={textLayer.color} disabled={disabled} onCommit={color => patchText({ color })} />
              <NumberField label={t('editor.outline')} value={textLayer.outline} min={0} max={16} disabled={disabled} onCommit={outline => patchText({ outline })} />
              <ColorField label={t('editor.background')} value={textLayer.background} disabled={disabled} onCommit={background => patchText({ background })} />
              <div className="ipv-editor-field"><span className="ipv-editor-label">{t('editor.backgroundMode')}</span><Button type="button" variant="toolbar" aria-pressed={Boolean(textLayer.background)} disabled={disabled} onClick={() => patchText({ background: textLayer.background ? '' : '#000000' })}>{t(textLayer.background ? 'editor.transparent' : 'editor.enableBackground')}</Button></div>
            </div>
            <ChoiceField label={t('editor.align')} value={textLayer.align} disabled={disabled} options={(['left', 'center', 'right'] as const).map(value => ({ value, label: t(`editor.alignment.${value}`) }))} onChange={align => patchText({ align: align as TextLayer['align'] })} />
          </>}
        </div></section>
        <CaptionsEditor key={`captions-${draftEpoch}`} project={history.present} onChange={commit} disabled={disabled} />
        <AssemblyControlPanel
          currentStyleId="style.knowledge-editorial"
          currentLayoutId="layout.type-led"
          onStyleChange={(styleId) => {
            const style = ASSEMBLY_STYLES[styleId]
            if (style) {
              const base = historyRef.current.present
              commit({
                ...base,
                title: { ...base.title, color: style.accentColor, font: style.fontFamily },
                subtitle: { ...base.subtitle, color: style.primaryColor, font: style.fontFamily },
              })
            }
          }}
          onLayoutChange={(layoutId) => {
            if (layoutId === 'layout.speaker-full') {
              const base = historyRef.current.present
              commit({
                ...base,
                title: { ...base.title, y: OUTPUT_HEIGHT * 0.15 },
                subtitle: { ...base.subtitle, y: OUTPUT_HEIGHT * 0.85 },
              })
            } else if (layoutId === 'layout.type-led') {
              commit(resetLayout(historyRef.current.present))
            }
          }}
          onApplyAssembly={() => {
            commit(resetLayout(historyRef.current.present))
          }}
          shotCount={history.present.shots?.length ?? 0}
          onPickShot={(shot) => {
            // 从镜头库点一个镜头 → 直接追加到背景层
            const base = historyRef.current.present
            const existing = base.shots ?? []
            const lastEnd = existing.reduce((max, item) => Math.max(max, item.end), 0)
            const durationSeconds = shot.durationInFrames / 30
            // 已有镜头就接在后面；没有就铺满整片
            const appendAfter = lastEnd > 0 && lastEnd < base.duration
            const start = appendAfter ? lastEnd : 0
            const end = appendAfter
              ? Math.min(base.duration, lastEnd + durationSeconds)
              : Math.max(1, base.duration)
            commit({
              ...base,
              shots: [...existing, { shotId: shot.shotId, start, end, rate: 1, opacity: 1 }],
            })
          }}
          disabled={disabled}
        />
        {/* 动效背景：直接挂视频工厂的镜头库，写回 project.shots */}
        <ShotBackdropPanel
          project={history.present}
          disabled={disabled}
          onChange={(shots) => commit({ ...historyRef.current.present, shots })}
        />
        <PresetsPanel owner={owner} project={history.present} onChange={commit} disabled={disabled} />
      </aside>
    </div>
  </section>
}
