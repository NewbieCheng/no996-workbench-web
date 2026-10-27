import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { useEditorDocument, useEditorInstance } from '@no996/video-editor'
import { editTalk, retimePhotos, talkSettings, applyTalkComposition, type TalkComposition } from './talk-model'
import { useEditorSelection } from './use-editor-selection'

export function TalkMediaPanel({ onAdd, onDigital }: { onAdd: () => void; onDigital: () => void }) {
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  const selectedIds = useEditorSelection(editor)
  const visuals = doc.tracks.flatMap(t => t.elements).filter(e => e.type === 'image' || e.type === 'video')
  const photoMotion = talkSettings(doc).photoMotion !== false
  const selected = visuals.find(e => selectedIds.includes(e.id)) ?? visuals[0]
  const updateTransform = (patch: Partial<NonNullable<typeof selected>['transform']>) => {
    if (!selected) return
    editTalk(editor, 'visual-transform', current => retimePhotos({ ...current, tracks: current.tracks.map(t => ({ ...t, elements: t.elements.map(e => e.id === selected.id && 'transform' in e ? { ...e, transform: { ...e.transform, ...patch } } : e) })) }))
  }
  return <div className="ipt-panel-body">
    <div className="ipt-section-heading"><h3>人物与画面</h3><Button variant="toolbar" onClick={onAdd}>添加素材</Button></div>
    <p className="ipt-help">照片轻轻运动，人物视频保留真实动作。没有素材也能做纯文字口播。</p>
    {!!visuals.length && <><div className="ipt-inline-actions" role="group" aria-label="整体人物构图">{([{ id: 'full', label: '人物全屏' }, { id: 'side', label: '人物在左' }, { id: 'top', label: '人物在上' }, { id: 'pip', label: '人物小窗' }] as Array<{ id: TalkComposition; label: string }>).map(layout => <Button key={layout.id} variant="toolbar" onClick={() => editTalk(editor, 'composition', current => applyTalkComposition(current, layout.id))}>{layout.label}</Button>)}</div><p className="ipt-help">以上按钮会替换全部人物/照片构图，可撤销。字幕风格不会自动改变这里的构图。</p></>}
    <Button variant="toolbar" onClick={onDigital}>使用已有数字人成片</Button>
    {!visuals.length && <p className="ipt-help">当前为纯文字画面，添加照片或人物视频即可替换。</p>}
    {visuals.map((element, i) => <div className="ipt-media-row" key={element.id}>
      <Button variant="ghost" className="ipt-media-name" aria-pressed={selected?.id === element.id} onClick={() => editor.setSelection([element.id])}>{i + 1}. {doc.assets[element.assetId]?.name ?? '素材'}</Button>
      {element.type === 'image' && <><Button variant="ghost" size="sm" aria-label="照片前移" disabled={!i} onClick={() => editTalk(editor, 'reorder-photo', current => retimePhotos({ ...current, tracks: current.tracks.map(t => { const elements = [...t.elements]; const p = elements.findIndex(e => e.id === element.id); if (p > 0) [elements[p - 1], elements[p]] = [elements[p], elements[p - 1]]; return { ...t, elements } }) }))}>前移</Button><Button variant="ghost" size="sm" aria-label="照片后移" disabled={i === visuals.length - 1} onClick={() => editTalk(editor, 'reorder-photo', current => retimePhotos({ ...current, tracks: current.tracks.map(t => { const elements = [...t.elements]; const p = elements.findIndex(e => e.id === element.id); if (p >= 0 && p < elements.length - 1) [elements[p], elements[p + 1]] = [elements[p + 1], elements[p]]; return { ...t, elements } }) }))}>后移</Button></>}
      <Button variant="ghost" size="sm" aria-label="移除画面素材" onClick={() => editTalk(editor, 'remove-visual', current => retimePhotos({ ...current, tracks: current.tracks.map(t => ({ ...t, elements: t.elements.filter(e => e.id !== element.id) })) }))}>移除</Button>
    </div>)}
    {visuals.some(e => e.type === 'image') && <Button variant="toolbar" aria-pressed={photoMotion} onClick={() => editTalk(editor, 'photo-motion', current => retimePhotos({ ...current, ipVideo: { ...talkSettings(current), photoMotion: !photoMotion } }))}>照片轻运动：{photoMotion ? '开启' : '关闭'}</Button>}
    {selected && <>
      <label className="ipt-field">画面大小<Input type="range" min={0.35} max={1.8} step={0.02} value={selected.transform.width / doc.canvas.width} onChange={e => { const width = doc.canvas.width * Number(e.target.value); const ratio = selected.transform.height / selected.transform.width; updateTransform({ width, height: width * ratio }) }} /></label>
      <div className="ipt-inline-actions"><Button variant="toolbar" onClick={() => updateTransform({ x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height, cropMode: 'cover' })}>铺满画面</Button><Button variant="toolbar" onClick={() => updateTransform({ x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height, cropMode: 'contain' })}>完整显示</Button></div>
      <p className="ipt-help">暂停播放后，直接拖动画面调整位置。</p>
    </>}
    <details className="ipt-details"><summary>更多画面设置</summary><div className="ipt-details-body"><label className="ipt-field">背景颜色<Input type="color" value={doc.canvas.backgroundColor} onChange={e => editTalk(editor, 'background', current => ({ ...current, canvas: { ...current.canvas, backgroundColor: e.target.value } }))} /></label>{selected && <><label className="ipt-field">水平裁切焦点<Input type="range" min={0} max={1} step={0.02} value={selected.transform.contentFocusX ?? 0.5} onChange={e => updateTransform({ contentFocusX: Number(e.target.value) })} /></label><label className="ipt-field">垂直裁切焦点<Input type="range" min={0} max={1} step={0.02} value={selected.transform.contentFocusY ?? 0.5} onChange={e => updateTransform({ contentFocusY: Number(e.target.value) })} /></label></>}</div></details>
  </div>
}
