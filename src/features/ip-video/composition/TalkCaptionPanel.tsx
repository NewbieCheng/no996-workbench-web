import { useEffect, useRef, useState } from 'react'
import { useEditorDocument, useEditorInstance, usePlayback, type CaptionCue, type CaptionStyle, type CaptionMotion } from '@no996/video-editor'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@no996/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import { CAPTION_FONTS, loadCaptionFont, captionFontByFamily } from '../editor/caption-fonts'
import { parseSrt, exportSrt } from '../lib/subtitles'
import { downloadText } from '../../../services/browser'
import { TALK_CAPTION_PRESETS, matchingTalkPreset, editTalk, estimateCues, patchGlobalStyle, talkSettings, resolveTalkCaptionImport, secondsLabel, captionTextNeedsReview, syncCaptionText, validateTalkCaptions } from './talk-model'
import { TalkStyleLibrary } from './TalkStyleLibrary'
import { RangeSlider } from './range-slider'

const modes = [{ value: 'clean', label: '单行 / 双行字幕' }, { value: 'kinetic', label: '居中短句' }, { value: 'rolling', label: '三行滚动' }, { value: 'editorial', label: '侧栏观点' }]
const motions = [{ value: 'none', label: '无动效' }, { value: 'fade', label: '原位淡入淡出' }, { value: 'fade-up', label: '轻柔上浮' }, { value: 'slide', label: '斜向滑动' }, { value: 'pop', label: '缩放弹入' }]
const colorPresets = [
  { label: '白字黑底', color: '#ffffff', emphasisColor: '#ffd60a', backgroundColor: '#101820dd' },
  { label: '暖白棕底', color: '#fff8ef', emphasisColor: '#ffc58a', backgroundColor: '#2f1f1bdd' },
  { label: '深字浅底', color: '#28221c', emphasisColor: '#9a351e', backgroundColor: '#f5eee3ee' },
  { label: '蓝白', color: '#e6f3ff', emphasisColor: '#84d5ff', backgroundColor: '#0c263cdd' },
] as const

export function TalkCaptionPanel({ onError, section = 'all', inlineLibrary = false }: { onError: (message: string) => void; section?: 'all' | 'appearance' | 'timing'; inlineLibrary?: boolean }) {
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  const { seek, playheadUs } = usePlayback()
  const [looksOpen, setLooksOpen] = useState(false)
  const [fontBusy, setFontBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  const patch = (value: Partial<CaptionStyle>) => editTalk(editor, 'caption-style', current => patchGlobalStyle(current, value))
  const font = captionFontByFamily(doc.captionStyle.font)
  const selectedPreset = matchingTalkPreset(doc.captionStyle)
  const basePreset = TALK_CAPTION_PRESETS.find(item => item.id === talkSettings(doc).captionPresetId) ?? TALK_CAPTION_PRESETS[0]
  const changeFont = async (id: string) => {
    const next = CAPTION_FONTS.find(item => item.id === id)
    if (!next || fontBusy) return
    const epoch = ++generation.current
    const documentId = doc.id
    setFontBusy(true)
    try { await loadCaptionFont(id); if (epoch === generation.current && editor.getDocument().id === documentId) patch({ font: next.family, weight: next.weight }) }
    catch (failure) { if (epoch === generation.current) onError(failure instanceof Error ? failure.message : String(failure)) }
    finally { if (epoch === generation.current) setFontBusy(false) }
  }
  const applyPreset = async (id: string) => {
    const preset = TALK_CAPTION_PRESETS.find(item => item.id === id)
    if (!preset || fontBusy) return
    const epoch = ++generation.current
    const documentId = doc.id
    setFontBusy(true)
    try {
      const entry = captionFontByFamily(preset.style.font)
      if (!entry) throw new Error('风格字体未登记，无法应用。')
      await loadCaptionFont(entry.id)
      if (epoch !== generation.current || editor.getDocument().id !== documentId) return
      editTalk(editor, 'caption-preset', current => ({ ...patchGlobalStyle(current, preset.style), ipVideo: { ...talkSettings(current), captionPresetId: preset.id } }))
      setLooksOpen(false)
    } catch (failure) { if (epoch === generation.current) onError(failure instanceof Error ? failure.message : String(failure)) }
    finally { if (epoch === generation.current) setFontBusy(false) }
  }
  const importSrt = async (file: File) => {
    const id = doc.id
    try {
      if (file.size > 1_000_000) throw new Error('字幕文件需小于 1 MB。')
      const cues = parseSrt(await file.text()).map(line => ({ id: crypto.randomUUID(), text: line.text, startUs: Math.round(line.start * 1_000_000), durationUs: Math.round((line.end - line.start) * 1_000_000), timingSource: 'srt' as const }))
      if (!cues.length) throw new Error('字幕文件中没有有效内容。')
      if (editor.getDocument().id !== id) return
      const imported = resolveTalkCaptionImport(cues, editor.getDocument().durationUs)
      editTalk(editor, 'import-srt', current => ({ ...current, durationUs: imported.durationUs, captions: imported.captions, ipVideo: { ...talkSettings(current), script: imported.script, captionReviewScript: undefined } }))
    } catch (failure) { onError(failure instanceof Error ? failure.message : String(failure)) }
  }
  return <div className="ipt-panel-body ipt-ve-panel">
    {section !== 'timing' && <>
      <div className="ipt-ve-panel__head">
        <div className="ipt-ve-panel__title">
          <span>文字外观</span>
          <span className="ipt-ve-tag">caption</span>
        </div>
        {!inlineLibrary && <Button type="button" variant="toolbar" size="sm" onClick={() => setLooksOpen(true)}>选择风格</Button>}
      </div>

      <div className="ipt-ve-meta" role="status">
        当前：{selectedPreset?.name ?? '自定义组合'}。全片设置不移动人物；逐句自定义仍保留。
      </div>

      {inlineLibrary && <TalkStyleLibrary busy={fontBusy} onApply={id => void applyPreset(id)} />}

      <div className="ipt-ve-section">
        <div className="ipt-ve-section__label-row">
          <span className="ipt-ve-section__label">字体（{CAPTION_FONTS.length} 款本地字体）</span>
          {fontBusy ? <span className="ipt-ve-section__value" role="status">加载中…</span> : null}
        </div>
        <Select items={CAPTION_FONTS.map(item => ({ value: item.id, label: item.label }))} value={font?.id ?? ''} disabled={fontBusy} onValueChange={value => { if (value) void changeFont(String(value)) }}>
          <SelectTrigger><SelectValue placeholder="请选择可用字体" /></SelectTrigger>
          <SelectContent>{CAPTION_FONTS.map(item => <SelectItem key={item.id} value={item.id}>{item.label} · {item.description}</SelectItem>)}</SelectContent>
        </Select>
        {!font && <span className="ipt-ve-note">当前字体不在本地目录：{doc.captionStyle.font}</span>}
        <span className="ipt-font-specimen ipt-ve-specimen" style={{ fontFamily: doc.captionStyle.font, fontWeight: doc.captionStyle.weight }}>让每句话，都被认真看见。</span>
      </div>

      <div className="ipt-ve-section">
        <span className="ipt-ve-section__label">版式与对齐</span>
        <div className="ipt-ve-grid-2">
          <label className="ipt-ve-field">
            <span>字幕版式</span>
            <Select items={modes} value={doc.captionStyle.mode ?? 'clean'} onValueChange={value => patch({ mode: value as CaptionStyle['mode'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{modes.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="ipt-ve-field">
            <span>对齐方式</span>
            <Select items={[{ value: 'left', label: '左对齐' }, { value: 'center', label: '居中' }, { value: 'right', label: '右对齐' }]} value={doc.captionStyle.align ?? 'center'} onValueChange={value => patch({ align: value as CaptionStyle['align'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">左对齐</SelectItem>
                <SelectItem value="center">居中</SelectItem>
                <SelectItem value="right">右对齐</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        {doc.captionStyle.mode === 'clean' && (
          <div className="ipt-ve-capsules" role="group" aria-label="每页字幕行数">
            {([1, 2] as const).map(lines => (
              <button
                key={lines}
                type="button"
                className="ipt-ve-capsule"
                aria-pressed={(doc.captionStyle.pageLines ?? 2) === lines}
                onClick={() => patch({ pageLines: lines })}
              >
                {lines === 1 ? '单行' : '双行'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ipt-ve-section">
        <div className="ipt-ve-section__label-row">
          <span className="ipt-ve-section__label">文字大小</span>
          <span className="ipt-ve-section__value">{doc.captionStyle.size} px</span>
        </div>
        <RangeSlider min={32} max={140} step={2} value={doc.captionStyle.size} labelKey="captionSize" onValueChange={size => patch({ size })} />
      </div>

      <div className="ipt-ve-section">
        <span className="ipt-ve-section__label">颜色</span>
        <div className="ipt-ve-grid-2">
          <label className="ipt-ve-field">
            <span>文字颜色</span>
            <Input type="color" value={doc.captionStyle.color} onChange={e => patch({ color: e.target.value })} />
          </label>
          <label className="ipt-ve-field">
            <span>强调颜色</span>
            <Input type="color" value={doc.captionStyle.emphasisColor ?? '#ffd60a'} onChange={e => patch({ emphasisColor: e.target.value })} />
          </label>
        </div>
        <div className="ipt-ve-capsules" role="group" aria-label="字幕配色">
          {colorPresets.map(({ label, ...colors }) => (
            <button key={label} type="button" className="ipt-ve-capsule" onClick={() => patch(colors)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="ipt-ve-section">
        <div className="ipt-ve-section__label-row">
          <span className="ipt-ve-section__label">字幕位置</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => patch({ xRatio: .5, yRatio: .8 })}>居中复位</Button>
        </div>
        <label className="ipt-ve-field">
          <span>水平</span>
          <RangeSlider min={.1} max={.9} step={.01} value={doc.captionStyle.xRatio ?? .5} labelKey="captionHorizontalPosition" onValueChange={xRatio => patch({ xRatio })} />
        </label>
        <label className="ipt-ve-field">
          <span>上下</span>
          <RangeSlider min={.12} max={.86} step={.01} value={doc.captionStyle.yRatio} labelKey="captionVerticalPosition" onValueChange={yRatio => patch({ yRatio })} />
        </label>
      </div>

      <div className="ipt-ve-section">
        <span className="ipt-ve-section__label">句子动效</span>
        <div className="ipt-ve-grid-2">
          {(['entrance', 'exit'] as const).map(key => (
            <label className="ipt-ve-field" key={key}>
              <span>{key === 'entrance' ? '入场' : '退场'}</span>
              <Select items={motions} value={doc.captionStyle[key] ?? 'none'} onValueChange={value => patch({ [key]: value as CaptionMotion })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{motions.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          ))}
        </div>
        <label className="ipt-ve-field">
          <span>动效强度</span>
          <RangeSlider min={0} max={1} step={.1} value={doc.captionStyle.motion ?? .5} labelKey="motionStrength" onValueChange={motion => patch({ motion })} />
        </label>
      </div>

      <div className="ipt-ve-hint">按句子时间运行。短句分页与滚动节奏为估时，不是逐词识别。</div>

      <details className="ipt-details ipt-ve-details"><summary>更多排版与复原</summary><div className="ipt-details-body">
        <label className="ipt-ve-field">行距<RangeSlider min={1.1} max={2} step={.05} value={doc.captionStyle.lineHeight ?? 1.4} labelKey="lineHeight" onValueChange={lineHeight => patch({ lineHeight })} /></label>
        <label className="ipt-ve-field">字间距<RangeSlider min={0} max={12} step={1} value={doc.captionStyle.letterSpacing ?? 0} labelKey="letterSpacing" onValueChange={letterSpacing => patch({ letterSpacing })} /></label>
        <label className="ipt-ve-field">文字宽度<RangeSlider min={.2} max={.9} step={.02} value={doc.captionStyle.widthRatio ?? .82} labelKey="textWidth" onValueChange={widthRatio => patch({ widthRatio })} /></label>
        <label className="ipt-ve-field">描边厚度<RangeSlider min={0} max={6} step={.5} value={doc.captionStyle.outlineWidth} labelKey="outlineThickness" onValueChange={outlineWidth => patch({ outlineWidth })} /></label>
        <Button variant="toolbar" onClick={() => patch({ backgroundColor: doc.captionStyle.backgroundColor ? '' : '#101820cc' })}>{doc.captionStyle.backgroundColor ? '关闭字幕底色' : '增加字幕底色'}</Button>
        <Button variant="toolbar" onClick={() => void applyPreset(basePreset.id)}>恢复「{basePreset.name}」默认</Button>
        <Button variant="ghost" disabled={!doc.captions.some(c => c.styleOverride)} onClick={() => editTalk(editor, 'reset-caption-overrides', current => ({ ...current, captions: current.captions.map(cue => ({ ...cue, styleOverride: undefined })) }))}>清除逐句外观，全部跟随全片</Button>
      </div></details>
    </>}
    {section !== 'appearance' && <>
      <TalkCaptionReview onError={onError} />
      <div className="ipt-ve-panel__head">
        <div className="ipt-ve-panel__title">
          <span>逐句字幕</span>
          <span className="ipt-ve-tag">{doc.captions.length} 句</span>
        </div>
      </div>
      <p className="ipt-help">{doc.captions.some(c => c.timingSource === 'estimated') ? '依据文稿与时长粗排，可逐句校时；不是语音识别。' : '保留 SRT 或人工调整的字幕时间。'}</p>
      <div className="ipt-ve-capsules"><Button variant="toolbar" size="sm" onClick={() => fileRef.current?.click()}>导入 SRT</Button><Button variant="toolbar" size="sm" disabled={!doc.captions.length} onClick={() => downloadText(exportSrt(doc.captions.map(c => ({ text: c.text, start: c.startUs / 1_000_000, end: (c.startUs + c.durationUs) / 1_000_000 }))), 'captions.srt', 'application/x-subrip;charset=utf-8')}>导出字幕</Button></div>
      <input type="file" ref={fileRef} accept=".srt" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importSrt(file) }} />
      {!doc.captions.length && <p className="ipt-help">填入文稿并排好字幕，或导入已有 SRT。</p>}
      <div className="ipt-caption-list">{doc.captions.map((cue, i) => <CaptionRow key={cue.id} cue={cue} index={i} active={playheadUs >= cue.startUs && playheadUs < cue.startUs + cue.durationUs} onSeek={() => seek(cue.startUs)} onError={onError} />)}</div>
      <details className="ipt-details"><summary>重新按文稿估时</summary><div className="ipt-details-body"><p className="ipt-help">覆盖全部人工校时和 SRT 时间，可撤销；不重新生成配音。</p><Button variant="toolbar" disabled={!doc.durationUs || !talkSettings(doc).script.trim()} onClick={() => editTalk(editor, 'retime-captions', current => ({ ...current, captions: estimateCues(talkSettings(current).script, voiceDurationForCues(current)), ipVideo: { ...talkSettings(current), captionReviewScript: undefined } }))}>覆盖并重新估时</Button></div></details>
    </>}
    <Dialog open={looksOpen} onOpenChange={setLooksOpen}><DialogContent className="ipt-look-dialog"><DialogHeader><DialogTitle>选择字幕风格</DialogTitle></DialogHeader><TalkStyleLibrary busy={fontBusy} onApply={id => void applyPreset(id)} /></DialogContent></Dialog>
  </div>
}

// Do not stretch narration across additional outro shots.
function voiceDurationForCues(doc: ReturnType<typeof useEditorDocument>): number {
  const media = doc.tracks.flatMap(t => t.elements).filter(e => e.type === 'audio' || e.type === 'video')
  return media.length ? Math.max(...media.map(e => e.startUs + e.durationUs)) : doc.durationUs
}

export function TalkCaptionReview({ onError }: { onError: (message: string) => void }) {
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  if (!captionTextNeedsReview(doc)) return null
  return <section className="ipt-review-notice" aria-label="确认文稿与已校时字幕">
    <strong>文稿已改，已校时字幕尚未同步</strong><p>现有文字与时间均已保留。请选择处理方式后再导出。</p>
    <div className="ipt-inline-actions"><Button variant="toolbar" onClick={() => { try { editTalk(editor, 'sync-caption-text', syncCaptionText) } catch (failure) { onError(failure instanceof Error ? failure.message : String(failure)) } }}>同步文字，保留时间</Button><Button variant="ghost" onClick={() => editTalk(editor, 'accept-caption-text', current => ({ ...current, ipVideo: { ...talkSettings(current), captionReviewScript: talkSettings(current).script } }))}>明确保留现有字幕</Button></div>
  </section>
}

function CaptionRow({ cue, index, active, onSeek, onError }: { cue: CaptionCue; index: number; active: boolean; onSeek: () => void; onError: (message: string) => void }) {
  const editor = useEditorInstance()
  const [text, setText] = useState(cue.text)
  const [start, setStart] = useState(String(cue.startUs / 1_000_000))
  const [end, setEnd] = useState(String((cue.startUs + cue.durationUs) / 1_000_000))
  useEffect(() => { setText(cue.text); setStart(String(cue.startUs / 1_000_000)); setEnd(String((cue.startUs + cue.durationUs) / 1_000_000)) }, [cue])
  const apply = () => {
    try {
      const next = { ...cue, text, startUs: Math.round(Number(start) * 1_000_000), durationUs: Math.round((Number(end) - Number(start)) * 1_000_000), timingSource: 'manual' as const }
      if (!start.trim() || !end.trim()) throw new Error('请填写开始和结束时间。')
      editTalk(editor, 'caption-edit', doc => {
        const captions = doc.captions.map(c => c.id === cue.id ? next : c)
        validateTalkCaptions(captions, doc.durationUs)
        return { ...doc, captions, ipVideo: { ...talkSettings(doc), script: captions.map(c => c.text).join('\n'), captionReviewScript: undefined } }
      })
    } catch (failure) { onError(failure instanceof Error ? failure.message : String(failure)) }
  }
  const override = (patch?: Partial<CaptionStyle>) => editTalk(editor, 'caption-override', doc => ({ ...doc, captions: doc.captions.map(c => c.id === cue.id ? { ...c, styleOverride: patch ? { ...c.styleOverride, ...patch } : undefined } : c) }))
  return <details className="ipt-caption-row" data-active={active}>
    <summary><Button variant="ghost" size="sm" onClick={event => { event.preventDefault(); onSeek() }}>{index + 1} · {secondsLabel(cue.startUs)}</Button><span>{cue.text}</span></summary>
    <div className="ipt-details-body"><label className="ipt-field">字幕正文<Textarea value={text} onChange={e => setText(e.target.value)} /></label><div className="ipt-field-row"><label className="ipt-field">开始（秒）<Input type="number" min={0} step={.01} value={start} onChange={e => setStart(e.target.value)} /></label><label className="ipt-field">结束（秒）<Input type="number" min={0} step={.01} value={end} onChange={e => setEnd(e.target.value)} /></label></div><Button variant="toolbar" onClick={apply}>保存本句文字与时间</Button>
      <details className="ipt-details"><summary>仅本句的外观{cue.styleOverride ? ' · 已自定义' : ''}</summary><div className="ipt-details-body"><label className="ipt-field">本句颜色<Input type="color" value={cue.styleOverride?.color ?? editor.getDocument().captionStyle.color} onChange={e => override({ color: e.target.value })} /></label><label className="ipt-field">本句大小<RangeSlider min={32} max={140} step={2} value={cue.styleOverride?.size ?? editor.getDocument().captionStyle.size} labelKey="captionSize" onValueChange={size => override({ size })} /></label><Button variant="ghost" size="sm" disabled={!cue.styleOverride} onClick={() => override()}>恢复全片设置</Button></div></details>
    </div>
  </details>
}
