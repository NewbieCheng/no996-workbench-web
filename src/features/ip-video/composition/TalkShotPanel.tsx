import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useEditorDocument, useEditorInstance, usePlayback, type ShotClipElement } from '@no996/video-editor'
import type { Command } from '@no996/video-editor/core/commands/base.ts'
import { FrameProvider } from '@no996/video-editor/demos/runtime/frame-context.tsx'
import { contentShotTextError, findContentShot } from '@no996/video-editor/demos/content-variants.tsx'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { TALK_SHOT_CATALOG, TALK_ASSEMBLY_SUPPORT, talkShotLabel, talkShotUnavailableReasons, type TalkShotAudit } from './talk-shot-catalog'
import { createTalkShotInsertCommand, createTalkShotTimingCommand, createTalkShotTransformCommand, createTalkShotTextCommand, createTalkShotDeleteCommand } from './talk-shot-commands'
import { talkSettings } from './talk-model'
import { useEditorSelection } from './use-editor-selection'
import './talk-shots.css'

export type TalkShotPanelProps = { onError: (message: string) => void; disabled?: boolean; curated?: boolean; allowFullCatalog?: boolean }

/** Only search/selection/form drafts are local; actual edits use the shared EditorInstance and history. */
export function TalkShotPanel({ onError, disabled = false, curated = true, allowFullCatalog = import.meta.env.DEV }: TalkShotPanelProps) {
  const doc = useEditorDocument()
  const editor = useEditorInstance()
  const { playheadUs, seek } = usePlayback()
  const selectedIds = useEditorSelection(editor)
  const [advanced, setAdvanced] = useState(!curated && allowFullCatalog)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState('')
  const [choice, setChoice] = useState('typography/blur-slide')
  const [form, setForm] = useState({ documentId: doc.id, text: '', subline: '' })
  const fields = form.documentId === doc.id ? { text: form.text, subline: form.subline } : { text: '', subline: '' }
  const audited = TALK_SHOT_CATALOG.map(entry => ({ entry, reasons: talkShotUnavailableReasons(entry, doc) }))
  const count = audited.filter(item => !item.reasons.length).length
  const listed = audited.filter(({ entry, reasons }) => (advanced || entry.curated)
    && (filter === 'all' || (filter === 'available' ? !reasons.length : !!reasons.length))
    && `${talkShotLabel(entry)} ${entry.shot.shotId} ${entry.shot.categoryLabel}`.toLowerCase().includes(query.trim().toLowerCase()))
  const chosen = listed.find(item => item.entry.shot.shotId === choice && item.entry.presentation === 'content')
  const inserted = doc.tracks.flatMap(track => track.elements.filter((element): element is ShotClipElement => element.type === 'shot').map(element => ({ element, track })))
  const activeId = selectedIds.find(id => inserted.some(item => item.element.id === id)) ?? selection
  const selected = inserted.find(item => item.element.id === activeId)
  const run = (create: () => Command) => {
    if (disabled) return
    try {
      const command = create()
      editor.executeCommand({
        id: command.id, type: command.type,
        execute(current) {
          const result = command.execute(current)
          return { ...result, document: { ...result.document, ipVideo: { ...talkSettings(result.document), aiProtected: { ...talkSettings(result.document).aiProtected, shots: true } } } }
        },
        undo(current) {
          const result = command.undo(current)
          return { ...result, document: { ...result.document, ipVideo: { ...talkSettings(result.document), aiProtected: talkSettings(doc).aiProtected } } }
        },
      })
    } catch (failure) { onError(failure instanceof Error ? failure.message : String(failure)) }
  }
  const textError = contentShotTextError(fields)
  const setField = (key: 'text' | 'subline', value: string) => setForm({ documentId: doc.id, ...fields, [key]: value })
  return <section className="ipt-panel-body ipt-shots" aria-label="口播视觉镜头">
    <div className="ipt-section-heading"><h3>视觉镜头</h3><span>{count} / {audited.length} 内容版可用</span></div>
    <p className="ipt-help">6 种去演示化内容版只使用你的短标题与副标题。原始 151 项演示不会直接插入；人物原声、文稿和逐句字幕保留。</p>
    {allowFullCatalog && <div className="ipt-shots-tools"><Button variant="toolbar" aria-pressed={!advanced} onClick={() => setAdvanced(false)}>精选推荐</Button><Button variant="toolbar" aria-pressed={advanced} onClick={() => setAdvanced(true)}>完整目录（{audited.length}，开发）</Button></div>}
    <Input type="search" aria-label="搜索镜头" placeholder="按名称、分类或镜头编号搜索" value={query} onChange={event => setQuery(event.target.value)} />
    <Select items={[{ value: 'all', label: '全部状态' }, { value: 'available', label: '内容版可用' }, { value: 'unavailable', label: '暂不可用' }]} value={filter} onValueChange={value => setFilter(String(value ?? 'all'))}><SelectTrigger aria-label="按兼容状态筛选"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="available">内容版可用</SelectItem><SelectItem value="unavailable">暂不可用</SelectItem></SelectContent></Select>
    <p className="ipt-help">{listed.length} 个结果。仅选中的一个内容版运行预览；原始演示不加载、不播放。</p>
    <div className="ipt-shots-catalog">{listed.map(({ entry, reasons }) => <ShotChoice key={entry.shot.shotId} entry={entry} reasons={reasons} selected={choice === entry.shot.shotId} onSelect={() => setChoice(entry.shot.shotId)} />)}</div>
    {!listed.length && <p className="ipt-help">没有符合筛选条件的镜头。</p>}
    {chosen && <div className="ipt-shots-compose">
      <div className="ipt-section-heading"><h3>{talkShotLabel(chosen.entry)}</h3><span>内容版</span></div>
      {chosen.entry.fields.map(field => <label className="ipt-field" key={field.key}>{field.label} · {Array.from(fields[field.key as 'text' | 'subline']).length}/{field.max} 字<Input value={fields[field.key as 'text' | 'subline']} disabled={disabled} onChange={event => setField(field.key as 'text' | 'subline', event.target.value)} /></label>)}
      {textError ? <p className="ipt-help" role="status">{textError} 预览只显示实际填写内容，不使用演示默认文案。</p> : <ContentShotPreview key={`${doc.id}:${choice}`} entry={chosen.entry} fields={fields} onError={onError} />}
      <p className="ipt-help">{chosen.entry.contentEvidence}</p>
      <p className="ipt-help">插入到 {(playheadUs / 1_000_000).toFixed(2)} 秒；整屏不透明画面会暂时遮住人物，保留声音。底部约 30% 留给逐句字幕；自定义居中字幕仍可能覆盖标题。剩余口播不足原镜头时长时自动取可用帧长，至少保留 0.6 秒。</p>
      <Button variant="toolbar" disabled={disabled || !!textError || !!chosen.reasons.length || doc.durationUs - playheadUs < 600_000} onClick={() => run(() => createTalkShotInsertCommand(editor.getDocument(), choice, playheadUs, fields))}>插入当前播放位置</Button>
      {doc.durationUs - playheadUs < 600_000 && <p className="ipt-help">先准备口播资料，或将播放位置移到至少剩余 0.6 秒的区间。</p>}
    </div>}
    <details className="ipt-details"><summary>层序、资源与适配范围</summary><div className="ipt-details-body"><p>内容版是整屏标题卡，不是透明字幕贴纸或自动避让人物的画中画。位置调整保持工程画幅比例，不自动裁切人物、静音原声、改写文稿或覆盖字幕时间。</p><p>预览与导出必须由公共播放器按 presentation=content 解析并保持轨道层序；本面板不另建渲染路径或时间轴。</p><p>6 项内容版复用本项目帧运行时和动效机制，采用新的自适应排版；不加载原演示品牌、截图、纹理、图表假数据。原演示及音频的许可待核实，不据此重新声明其可商用。</p><p>{TALK_ASSEMBLY_SUPPORT.explanation}</p><p>{TALK_ASSEMBLY_SUPPORT.audio}</p></div></details>
    <div className="ipt-section-heading"><h3>本作品已插入镜头</h3><span>{inserted.length} 段</span></div>
    {!inserted.length ? <p className="ipt-help">尚未插入视觉镜头。</p> : <><Select value={selected?.element.id ?? ''} items={inserted.map(({ element }) => ({ value: element.id, label: `${shotName(element.shotId)} · ${(element.startUs / 1_000_000).toFixed(2)} 秒${element.presentation === 'content' ? '' : '（原演示，仅可移除）'}` }))} onValueChange={value => { setSelection(String(value ?? '')); if (value) editor.setSelection([String(value)]) }}><SelectTrigger aria-label="选择要调整的镜头"><SelectValue placeholder="选择一个镜头片段" /></SelectTrigger><SelectContent>{inserted.map(({ element }) => <SelectItem key={element.id} value={element.id}>{shotName(element.shotId)} · {(element.startUs / 1_000_000).toFixed(2)} 秒</SelectItem>)}</SelectContent></Select>{selected && <ShotControls key={`${doc.id}:${selected.element.id}`} element={selected.element} locked={selected.track.locked || disabled} onSeek={() => seek(selected.element.startUs)} run={run} />}</>}
  </section>
}
function shotName(id: string) { const entry = TALK_SHOT_CATALOG.find(item => item.shot.shotId === id); return entry ? talkShotLabel(entry) : id }

function ShotChoice({ entry, reasons, selected, onSelect }: { entry: TalkShotAudit; reasons: string[]; selected: boolean; onSelect: () => void }) {
  return <div className="ipt-shot-choice" data-selected={selected && entry.presentation === 'content'}>
    <Button variant="ghost" className="ipt-shot-pick" disabled={!!reasons.length} aria-pressed={selected && entry.presentation === 'content'} onClick={onSelect}><span>{talkShotLabel(entry)}</span><small>{reasons.length ? '暂不可用' : '内容版可用'}</small></Button>
    <details className="ipt-details"><summary>适配说明与原始演示状态</summary><div className="ipt-details-body">
      <small className="ipt-shot-id">{entry.shot.shotId}</small>
      {entry.presentation === 'content' && <><p>{entry.contentEvidence}</p><p>内容版输入：短标题 ≤18 字、副标题 ≤36 字；无素材槽位。竖屏每行最多 6 字、封面 3:4 每行最多 7 字、横屏/方屏每行最多 9 字，字号与画幅联动，不截断原文。</p></>}
      <ul className="ipt-shot-reasons">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      <p>原始演示仍待适配：{entry.demoReasons.join(' ')}</p><small className="ipt-shot-source">原始入口：{entry.source || '未审查'}；内容版：{entry.presentation === 'content' ? 'demos/content-variants.tsx 静态白名单' : '无'}</small>
    </div></details>
  </div>
}

function ContentShotPreview({ entry, fields, onError }: { entry: TalkShotAudit; fields: Record<string, string>; onError: (message: string) => void }) {
  const doc = useEditorDocument()
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 320, height: Math.round(320 * doc.canvas.height / doc.canvas.width) })
  const [Shot, setShot] = useState<ComponentType<Record<string, unknown>> | null>(null)
  const [loadError, setLoadError] = useState('')
  const [frame, setFrame] = useState(0)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  const duration = entry.shot.durationInFrames
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReduced(media.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  useEffect(() => {
    let active = true
    setShot(null); setLoadError('')
    const definition = findContentShot(entry.shot.shotId)
    if (!definition) return
    void definition.load().then(Component => { if (active) setShot(() => Component) }).catch(error => {
      if (active) { const message = error instanceof Error ? error.message : String(error); setLoadError(message); onError(message) }
    })
    return () => { active = false }
  }, [entry.shot.shotId, onError])
  useEffect(() => {
    const element = host.current
    if (!element) return
    const measure = () => { const box = element.getBoundingClientRect(); if (box.width > 0 && box.height > 0) setSize({ width: box.width, height: box.height }) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (reduced || !Shot) { setFrame(Math.floor(duration * 0.8)); return }
    let request = 0
    let started = performance.now()
    let last = -1
    const paint = (now: number) => {
      if (document.hidden) { started = now; request = requestAnimationFrame(paint); return }
      const next = Math.floor((now - started) / 1000 * fps) % duration
      if (next !== last) { setFrame(next); last = next }
      request = requestAnimationFrame(paint)
    }
    request = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(request)
  }, [Shot, duration, fps, reduced])
  return <figure className="ipt-shot-preview">
    <div ref={host} className="ipt-shot-preview-stage" role="img" aria-label={`${talkShotLabel(entry)}，使用当前填写的标题与副标题预览`} style={{ aspectRatio: `${doc.canvas.width}/${doc.canvas.height}`, maxWidth: Math.min(420, 280 * doc.canvas.width / doc.canvas.height) }}>
      {Shot && <FrameProvider frame={frame} durationInFrames={duration} fps={fps} width={size.width} height={size.height} props={fields}><Shot {...fields} /></FrameProvider>}
      {loadError && <span role="alert">内容预览加载失败：{loadError}</span>}
    </div><figcaption>{reduced ? '减少动态效果：显示稳定关键帧' : '当前文字动态预览 · 仅此一项运行'} · 无声</figcaption>
  </figure>
}

function ShotControls({ element, locked, onSeek, run }: { element: ShotClipElement; locked: boolean; onSeek: () => void; run: (create: () => Command) => void }) {
  const doc = useEditorDocument()
  const editor = useEditorInstance()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rate, setRate] = useState('1')
  const [box, setBox] = useState(element.transform)
  const [fields, setFields] = useState<Record<string, string>>(element.overrides ?? {})
  useEffect(() => {
    setStart(String(element.startUs / 1_000_000)); setEnd(String((element.startUs + element.durationUs) / 1_000_000)); setRate(String(element.rate)); setBox(element.transform); setFields(element.overrides ?? {})
  }, [element])
  const entry = TALK_SHOT_CATALOG.find(item => item.shot.shotId === element.shotId)
  const content = element.presentation === 'content' && !!findContentShot(element.shotId)
  const textReady = content && !!entry && !talkShotUnavailableReasons(entry, doc).length
  const scale = box.width / doc.canvas.width
  return <div>
    {!content && <p className="ipt-help">原始演示不运行内容编辑；可删除，保留人物原声。</p>}
    <fieldset className="ipt-shot-controls" disabled={locked || !content}>
      <legend>镜头参数{locked ? ' · 只读' : ' · 修改可撤销'}</legend>
      <Button variant="ghost" size="sm" onClick={onSeek}>跳到镜头开始</Button>
      <div className="ipt-field-row"><label className="ipt-field">开始（秒）<Input type="number" min={0} step={0.01} value={start} onChange={event => setStart(event.target.value)} /></label><label className="ipt-field">结束（秒）<Input type="number" min={0} step={0.01} value={end} onChange={event => setEnd(event.target.value)} /></label></div>
      <label className="ipt-field">速率（0.25–4 倍）<Input type="number" min={0.25} max={4} step={0.05} value={rate} onChange={event => setRate(event.target.value)} /></label>
      <p className="ipt-help">最少 0.6 秒。超出源帧数、口播时长或与其他内容镜头重叠会拒绝，不挪动音轨。</p>
      <Button variant="toolbar" disabled={!start.trim() || !end.trim() || !rate.trim()} onClick={() => run(() => createTalkShotTimingCommand(editor.getDocument(), element.id, Number(start) * 1_000_000, Number(end) * 1_000_000, Number(rate)))}>保存起止与速率</Button>
      <label className="ipt-field">等比缩放 · {Math.round(scale * 100)}%<Input type="range" min={0.34} max={1} step={0.01} value={scale} onChange={event => { const value = Number(event.target.value); const width = doc.canvas.width * value; const height = doc.canvas.height * value; setBox(previous => ({ ...previous, width, height, x: Math.max(0, Math.min(previous.x, doc.canvas.width - width)), y: Math.max(0, Math.min(previous.y, doc.canvas.height - height)) })) }} /></label>
      <div className="ipt-field-row">{(['x', 'y'] as const).map(key => <label className="ipt-field" key={key}>{key === 'x' ? '横坐标' : '纵坐标'}（像素）<Input type="number" min={0} value={Number.isFinite(box[key]) ? box[key] : ''} onChange={event => setBox(value => ({ ...value, [key]: event.target.value === '' ? Number.NaN : Number(event.target.value) }))} /></label>)}</div>
      <label className="ipt-field">透明度 · {Math.round(box.opacity * 100)}%<Input type="range" min={0} max={1} step={0.05} value={box.opacity} onChange={event => setBox(value => ({ ...value, opacity: Number(event.target.value) }))} /></label>
      <Button variant="toolbar" onClick={() => run(() => createTalkShotTransformCommand(editor.getDocument(), element.id, box))}>保存位置与透明度</Button>
      {textReady && entry.fields.map(field => <label className="ipt-field" key={field.key}>{field.label}（最多 {field.max} 字）<Input value={fields[field.key] ?? ''} onChange={event => setFields(value => ({ ...value, [field.key]: event.target.value }))} /></label>)}
      {textReady && <Button variant="toolbar" disabled={!!contentShotTextError(fields)} onClick={() => run(() => createTalkShotTextCommand(editor.getDocument(), element.id, fields))}>保存镜头文字</Button>}
    </fieldset>
    <Button variant="ghost" disabled={locked} onClick={() => run(() => createTalkShotDeleteCommand(editor.getDocument(), element.id))}>删除此镜头（保留文稿与声音）</Button>
  </div>
}
