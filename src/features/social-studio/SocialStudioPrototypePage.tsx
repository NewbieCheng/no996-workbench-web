import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import { Page, Field } from '../../components/WorkbenchUI'
import { copyText, downloadText } from '../../services/browser'
import './social-studio-prototype.css'
import i18n from '@/i18n'

type Draft = { id: number; platform: string; mode: string; title: string; body: string; time: string }
type Picture = { id: number; url: string; name: string }

// Keep Markdown text outside the page copy mapper's React children traversal.
function DraftMarkdown({ value }: { value: string }) {
  return <ReactMarkdown>{value}</ReactMarkdown>
}

export default function SocialStudioPrototypePage() {
  const [params, setParams] = useSearchParams()
  const platform = params.get('platform') === 'xhs' ? 'xhs' : 'wechat'
  const [mode, setMode] = useState(platform === 'wechat' ? 'article' : 'image_text')
  const [view, setView] = useState('edit')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<Draft[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('实用分享')
  const [pictures, setPictures] = useState<Picture[]>([])
  const [authorized, setAuthorized] = useState(false)
  const [busy, setBusy] = useState(false)
  const [delivery, setDelivery] = useState(false)
  const [destination, setDestination] = useState('')
  const [layout, setLayout] = useState('wechat')
  const [device, setDevice] = useState('mobile')
  const [color, setColor] = useState('#2e7d32')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const urls = useRef(new Set<string>())
  const target = useRef<HTMLDivElement>(null)
  const run = useRef(0)
  const platformName = platform === 'wechat' ? '公众号工坊' : '小红书工坊'
  const markdown = `# ${title}\n\n${body}`

  function stop() {
    run.current += 1
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setBusy(false)
  }
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current)
    urls.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function generate() {
    if (!topic.trim()) { toast.error('请先填写创作主题。'); return }
    stop()
    const token = run.current
    const submittedPlatform = platform
    const submittedMode = mode
    const nextTitle = topic.trim()
    const result = `## 从一个具体问题开始\n\n围绕「${nextTitle}」，先写下你最想解决的问题${audience.trim() ? `，以及${audience.trim()}在意的细节` : ''}。\n\n## 把建议变成行动\n\n先选择一件今天可以尝试的小事，再记录过程与结果。与其堆砌结论，不如给读者一条可以照着做的路径。\n\n> 这是一份${tone}风格的本机演示稿，不是真实 AI 生成结果。\n\n## 留下你的观察\n\n回顾哪些做法适合自己，哪些条件还需要验证。你会从哪一步开始？`
    setTitle(nextTitle); setBody(''); setView('preview'); setBusy(true)
    let offset = 0
    timer.current = setInterval(() => {
      if (token !== run.current) return
      offset += 12
      setBody(result.slice(0, offset))
      if (offset >= result.length) {
        if (timer.current) clearInterval(timer.current)
        timer.current = null; setBusy(false)
        setHistory((items) => [{ id: Date.now(), platform: submittedPlatform, mode: submittedMode, title: nextTitle, body: result, time: new Date().toLocaleTimeString() }, ...items])
      }
    }, 70)
  }

  async function copyLayout() {
    try {
      if (!target.current || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        await copyText(markdown)
        toast.success('已复制 Markdown 正文；当前环境不支持富文本复制。')
        return
      }
      const clone = target.current.cloneNode(true) as HTMLDivElement
      clone.querySelectorAll<HTMLElement>('h1,h2,h3,p,li,blockquote,strong').forEach((node) => {
        node.style.color = /H[123]|STRONG/.test(node.tagName) ? color : '#334155'
        node.style.fontSize = node.tagName === 'H1' ? '24px' : node.tagName === 'H2' ? '18px' : '15px'
        node.style.lineHeight = '1.85'
        node.style.margin = '16px 0'
      })
      clone.style.cssText = 'background:#ffffff;color:#334155;padding:24px;font-family:sans-serif;'
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([clone.outerHTML], { type: 'text/html' }), 'text/plain': new Blob([markdown], { type: 'text/plain' }) })])
      toast.success('已复制富文本排版；粘贴到平台后的效果需要核对。')
    } catch { toast.error('复制失败，请手动选择正文复制。') }
  }

  function pick(files: FileList | null) {
    if (!files || !authorized) return
    const remaining = Math.max(0, 6 - pictures.length)
    const valid = Array.from(files).filter((file) => ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type))
    if (valid.length !== files.length) toast.error('仅支持 PNG、JPEG、WebP、GIF 图片。')
    if (valid.length > remaining) toast.message('演示编排最多保留 6 张图片。')
    const added = valid.slice(0, remaining).map((file, index) => {
      const url = URL.createObjectURL(file); urls.current.add(url)
      return { id: Date.now() + index, url, name: file.name }
    })
    setPictures((items) => [...items, ...added])
  }

  return <Page moduleId="social-studio-prototype" title={platformName} description={i18n.t("uiCopy:创作工作区 · 交互演示，不调用模型、不发布内容、不写入正式历史", { keySeparator: false })}>
    <div className="ssp">
      <header className="ssp-top">
        <div className="ssp-group">
          <Button variant={platform === 'wechat' ? 'secondary' : 'ghost'} onClick={() => { stop(); setParams({ platform: 'wechat' }) }}>{i18n.t("socialPublish:phoneWechat")}</Button>
          <Button variant={platform === 'xhs' ? 'secondary' : 'ghost'} onClick={() => { stop(); setParams({ platform: 'xhs' }) }}>{i18n.t("extension:platformXiaohongshu")}</Button>
          <span className="ssp-demo">{i18n.t("uiCopy:演示", { keySeparator: false })}</span>
        </div>
        <div className="ssp-group">
          <Button variant="ghost" onClick={() => setHistoryOpen(!historyOpen)}>{i18n.t("uiCopy:历史记录 (", { keySeparator: false })}{history.filter((item) => item.platform === platform).length})</Button>
          <Button variant="outline" disabled={busy} onClick={() => { stop(); setTitle(''); setBody(''); setTopic('') }}>{i18n.t("uiCopy:新建作品", { keySeparator: false })}</Button>
        </div>
      </header>
      <div className="ssp-workspace">
        <section className="ssp-stage" aria-label={i18n.t("uiCopy:编辑与实时预览", { keySeparator: false })}>
          <div className="ssp-toolbar">
            <div className="ssp-group">
              <Button variant={mode === 'image_text' ? 'secondary' : 'ghost'} onClick={() => setMode('image_text')}>{i18n.t("uiCopy:图文模式", { keySeparator: false })}</Button>
              <Button variant={mode === 'article' ? 'secondary' : 'ghost'} onClick={() => setMode('article')}>{i18n.t("uiCopy:纯文章", { keySeparator: false })}</Button>
            </div>
            <div className="ssp-group">
              <Button variant={view === 'edit' ? 'secondary' : 'ghost'} onClick={() => setView('edit')}>{i18n.t("common:edit")}</Button>
              <Button variant={view === 'preview' ? 'secondary' : 'ghost'} onClick={() => setView('preview')}>{i18n.t("uiCopy:实时预览", { keySeparator: false })}</Button>
            </div>
          </div>
          {historyOpen ? <div className="ssp-history">
            <h3>{i18n.t("uiCopy:本次演示历史", { keySeparator: false })}</h3><p>{i18n.t("uiCopy:仅当前页面内存保存，刷新后清空；正式任务历史保持不变。", { keySeparator: false })}</p>
            {history.filter((item) => item.platform === platform).length === 0 ? <p>{i18n.t("uiCopy:还没有作品。填写右侧主题，生成一份演示稿。", { keySeparator: false })}</p> : history.filter((item) => item.platform === platform).map((item) => <div className="ssp-history-row" key={item.id}><span><strong>{item.title}</strong><small>{item.time} · {item.mode === 'article' ? i18n.t("uiCopy:纯文章", { keySeparator: false }) : i18n.t("socialPublish:studioModeImageText")}  {i18n.t("uiCopy:· 不含图片副本", { keySeparator: false })}</small></span><Button variant="outline" onClick={() => { stop(); setTitle(item.title); setBody(item.body); setMode(item.mode); setHistoryOpen(false) }}>{i18n.t("uiCopy:打开", { keySeparator: false })}</Button></div>)}
          </div> : <>
            {view === 'edit' ? <div className={`ssp-editor ${mode === 'article' ? 'ssp-editor--article' : ''}`}>
              {mode === 'image_text' && <div className="ssp-images"><h3>{i18n.t("uiCopy:图片编排", { keySeparator: false })} <small>{pictures.length}/6</small></h3><p>{i18n.t("uiCopy:左侧图片，右侧正文。图片只在本机预览。", { keySeparator: false })}</p><Input aria-label={i18n.t("uiCopy:导入授权图片", { keySeparator: false })} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" disabled={!authorized} onChange={(event) => { pick(event.target.files); event.target.value = '' }} />
                {!pictures.length && <div className="ssp-image-empty">{i18n.t("uiCopy:勾选右侧使用授权后导入图片", { keySeparator: false })}<br />{i18n.t("uiCopy:封面与正文配图在这里管理", { keySeparator: false })}</div>}
                {pictures.map((picture, index) => <figure key={picture.id}><img src={picture.url} alt={picture.name} /><figcaption>{index === 0 ? i18n.t("uiCopy:封面", { keySeparator: false }) : `配图 ${index}`}<Button size="sm" variant="ghost" onClick={() => { URL.revokeObjectURL(picture.url); urls.current.delete(picture.url); setPictures((items) => items.filter((item) => item.id !== picture.id)) }}>{i18n.t("socialPublish:studioRemoveImage")}</Button></figcaption></figure>)}
              </div>}
              <div className="ssp-writing"><Field label={i18n.t("uiCopy:作品标题", { keySeparator: false })}><Input value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder={i18n.t("uiCopy:一个清晰、具体的标题", { keySeparator: false })} /></Field><Field label={i18n.t("uiCopy:正文 · 支持 Markdown", { keySeparator: false })}><Textarea value={body} disabled={busy} onChange={(event) => setBody(event.target.value)} placeholder={i18n.t("uiCopy:直接写作，或在右侧填写主题生成演示稿。切换预览即可查看排版。", { keySeparator: false })} rows={20} /></Field><small>{body.length}  {i18n.t("uiCopy:字符 · 修改后预览同步更新", { keySeparator: false })}</small></div>
            </div> : <div className="ssp-preview-area">
              <div className="ssp-preview-controls"><span>{platform === 'wechat' ? i18n.t("uiCopy:公众号排版预览", { keySeparator: false }) : mode === 'article' ? i18n.t("uiCopy:小红书长文预览", { keySeparator: false }) : i18n.t("uiCopy:小红书笔记预览", { keySeparator: false })}</span>
                {platform === 'wechat' && <><label>{i18n.t("uiCopy:版式", { keySeparator: false })}<select value={layout} onChange={(event) => setLayout(event.target.value)}><option value="wechat">{i18n.t("uiCopy:微信排版", { keySeparator: false })}</option><option value="web">{i18n.t("uiCopy:网页文章", { keySeparator: false })}</option></select></label><label>{i18n.t("uiCopy:文章主题", { keySeparator: false })}<select value={color} onChange={(event) => setColor(event.target.value)}><option value="#2e7d32">{i18n.t("uiCopy:清新绿", { keySeparator: false })}</option><option value="#2455a4">{i18n.t("uiCopy:商务蓝", { keySeparator: false })}</option><option value="#333333">{i18n.t("uiCopy:简洁黑", { keySeparator: false })}</option></select></label></>}
                <label>{i18n.t("uiCopy:尺寸", { keySeparator: false })}<select value={device} onChange={(event) => setDevice(event.target.value)}><option value="mobile">{i18n.t("socialPublish:studioDeviceMobileShort")}</option><option value="pc">{i18n.t("socialPublish:studioDevicePcShort")}</option></select></label>
              </div>
              {!title && !body ? <div className="ssp-empty"><h3>{i18n.t("uiCopy:让你的内容成为一篇作品", { keySeparator: false })}</h3><p>{i18n.t("uiCopy:右侧输入主题，或切换编辑粘贴已有正文。", { keySeparator: false })}</p><Button variant="outline" onClick={() => setTopic(i18n.t("uiCopy:小团队如何整理选题库", { keySeparator: false }))}>{i18n.t("uiCopy:填入示例主题", { keySeparator: false })}</Button></div> : <article className={`ssp-paper ${device === 'pc' ? 'ssp-paper--wide' : ''} ${platform === 'xhs' ? 'ssp-paper--xhs' : ''}`} style={{ ['--article-color' as string]: platform === 'wechat' && layout === 'wechat' ? color : '#252b35' }}>
                <div className="ssp-paper-label">{platformName}  {i18n.t("uiCopy:· 非官方效果模拟", { keySeparator: false })}</div>
                {mode === 'image_text' && pictures.length > 0 && <div className="ssp-preview-gallery">{pictures.map((picture) => <img key={picture.id} src={picture.url} alt={picture.name} />)}</div>}
                <div ref={target}><DraftMarkdown value={markdown} /></div>
                {busy && <span role="status">{i18n.t("uiCopy:演示正文正在写入…", { keySeparator: false })}</span>}
              </article>}
            </div>}
          </>}
          <footer className="ssp-stage-footer"><span>{busy ? i18n.t("uiCopy:正在演示流式写作", { keySeparator: false }) : i18n.t("uiCopy:本机演示草稿", { keySeparator: false })}  {i18n.t("uiCopy:· 图片不自动上传", { keySeparator: false })}</span><div className="ssp-group"><Button variant="ghost" disabled={!body} onClick={() => copyText(markdown).then(() => toast.success(i18n.t("uiCopy:已复制正文", { keySeparator: false }))).catch(() => toast.error(i18n.t("uiCopy:复制失败，请手动复制。", { keySeparator: false })))}>{i18n.t("uiCopy:复制正文", { keySeparator: false })}</Button><Button variant="outline" disabled={!body || view !== 'preview' || historyOpen} onClick={copyLayout}>{i18n.t("socialPublish:copyLayout")}</Button><Button variant="ghost" disabled={!body} onClick={() => downloadText(markdown, i18n.t("uiCopy:演示作品.md", { keySeparator: false }))}>{i18n.t("common:excel.export")}</Button><Button disabled={!body || busy} onClick={() => { setDestination(''); setDelivery(true) }}>{i18n.t("uiCopy:分发演示", { keySeparator: false })}</Button></div></footer>
        </section>
        <aside className="ssp-config" aria-label={i18n.t("uiCopy:AI 创作配置", { keySeparator: false })}>
          <div className="ssp-config-head"><h3>{i18n.t("uiCopy:创作助手", { keySeparator: false })}</h3><p>{i18n.t("uiCopy:写清你想表达什么，其余按需补充。", { keySeparator: false })}</p></div>
          <div className="ssp-config-fields"><Field label={i18n.t("uiCopy:创作主题（必填）", { keySeparator: false })}><Textarea rows={4} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={i18n.t("uiCopy:例如：小团队如何整理选题库", { keySeparator: false })} /></Field><Field label={i18n.t("uiCopy:写给谁", { keySeparator: false })}><Input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder={i18n.t("uiCopy:例如：独立创作者、门店经营者", { keySeparator: false })} /></Field><Field label={i18n.t("uiCopy:表达风格", { keySeparator: false })}><select value={tone} onChange={(event) => setTone(event.target.value)}><option>{i18n.t("uiCopy:实用分享", { keySeparator: false })}</option><option>{i18n.t("uiCopy:经验复盘", { keySeparator: false })}</option><option>{i18n.t("uiCopy:专业解读", { keySeparator: false })}</option></select></Field>
          <details><summary>{i18n.t("uiCopy:参考资料与更多要求", { keySeparator: false })}</summary><Field label={i18n.t("uiCopy:补充资料（预留接线）", { keySeparator: false })}><Textarea rows={4} placeholder={i18n.t("uiCopy:粘贴参考内容、必须包含的信息", { keySeparator: false })} disabled /></Field><p>{i18n.t("uiCopy:演示仅使用主题、受众与风格，不采集外部链接。", { keySeparator: false })}</p></details>
          <details open={mode === 'image_text'}><summary>{i18n.t("uiCopy:配图与授权", { keySeparator: false })}</summary><label className="ssp-consent"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />{i18n.t("uiCopy:我拥有导入图片的使用授权", { keySeparator: false })}</label><p>{i18n.t("uiCopy:可导入图片并查看编排。真实 AI 生图待接口与计费确认。", { keySeparator: false })}</p><Button variant="outline" disabled>{i18n.t("uiCopy:AI 生成配图 · 待接入", { keySeparator: false })}</Button></details>
          <div className="ssp-note">{i18n.t("uiCopy:本页为交互演示：生成、历史和分发均不连接正式服务。切换模式保留文章与图片。", { keySeparator: false })}</div></div>
          <div className="ssp-config-footer">{busy ? <Button variant="outline" onClick={stop}>{i18n.t("uiCopy:停止演示", { keySeparator: false })}</Button> : <Button className="ssp-generate" onClick={generate}>{i18n.t("uiCopy:生成演示稿", { keySeparator: false })}</Button>}<small>{i18n.t("uiCopy:内容实时出现在左侧，可随时停止", { keySeparator: false })}</small></div>
        </aside>
      </div>
    </div>
    <Dialog open={delivery} onOpenChange={setDelivery}><DialogContent><DialogHeader><DialogTitle>{i18n.t("uiCopy:分发到平台（演示）", { keySeparator: false })}</DialogTitle></DialogHeader><p>{i18n.t("uiCopy:仅演示选择目标与确认草稿，不连接扩展，不向平台发送内容。", { keySeparator: false })}</p><Field label={i18n.t("uiCopy:目标页面", { keySeparator: false })}><select value={destination} onChange={(event) => setDestination(event.target.value)}><option value="">{i18n.t("uiCopy:请选择", { keySeparator: false })}</option><option value={i18n.t("uiCopy:公众号后台文章编辑页", { keySeparator: false })}>{i18n.t("uiCopy:公众号后台文章编辑页", { keySeparator: false })}</option><option value={i18n.t("uiCopy:小红书创作中心", { keySeparator: false })}>{i18n.t("uiCopy:小红书创作中心", { keySeparator: false })}</option></select></Field><p>{i18n.t("uiCopy:作品：", { keySeparator: false })}{title || i18n.t("uiCopy:未命名作品", { keySeparator: false })}<br />{i18n.t("uiCopy:方式：打开目标后填入草稿，由用户确认发布。", { keySeparator: false })}</p><Button disabled={!destination} onClick={() => { toast.message(`演示确认完成：目标为${destination}。未执行真实分发。`); setDelivery(false) }}>{i18n.t("uiCopy:确认分发演示", { keySeparator: false })}</Button></DialogContent></Dialog>
  </Page>
}
