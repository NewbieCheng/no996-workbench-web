import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, Clipboard, Download, FileText, Info, TriangleAlert } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@no996/ui/card'
import { ModuleLayout } from '@no996/ui/module-layout'
import { PageShell, PageShellHeader } from '@no996/ui/PageShell'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { Skeleton } from '@no996/ui/skeleton'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@no996/ui/empty'
import { WizardSteps } from '@no996/ui/feedback'
import { copyText, downloadText } from '../services/browser'
import { toastError, toastSuccess } from '../lib/toast'
import { LocalizedPanelCopy, usePanelCopy } from '../i18n/panel-copy'
import {
  CONTENT_WIDTH_EDGE_BUDGET,
  TOOL_CONTENT_DEFAULT_WIDTH,
  TOOL_CONTENT_MIN_WIDTH,
} from '../lib/content-width-policy'
import { cn } from '@no996/ui/utils'
import { WB_MODULE_PAGE_LAYOUT_CLASS } from './WorkbenchPageChrome'

export { CONTENT_WIDTH_EDGE_BUDGET, TOOL_CONTENT_DEFAULT_WIDTH, TOOL_CONTENT_MIN_WIDTH }
export {
  WorkbenchToolPageHeaderTools,
  WorkbenchPageChromeLeading,
  WorkbenchPageChromeActions,
  WB_MODULE_PAGE_LAYOUT_CLASS,
} from './WorkbenchPageChrome'

export function Page({
  title,
  headerLeading,
  titleExtra,
  actions,
  headerTrailing,
  children,
  moduleId,
  defaultWidth = TOOL_CONTENT_DEFAULT_WIDTH,
  minWidth = TOOL_CONTENT_MIN_WIDTH,
  edgeBudget = CONTENT_WIDTH_EDGE_BUDGET,
  layoutClassName,
  pinPageHeader,
  chrome,
  enableContentWidthHandles = true,
}: {
  title: string
  description: string
  /** 顶栏最左侧（标题前）。 */
  headerLeading?: ReactNode
  /** Renders inline to the right of the page title (e.g. view tabs). */
  titleExtra?: ReactNode
  /** 右上角控件（如「了解生产流程」入口、人设注入）。 */
  actions?: ReactNode
  /** 顶栏最右侧（actions 之后）。 */
  headerTrailing?: ReactNode
  children: ReactNode
  /** 传入后启用 ModuleLayout 内容宽度把手与本机记忆。 */
  moduleId?: string
  defaultWidth?: number
  minWidth?: number
  edgeBudget?: number
  layoutClassName?: string
  /** 页头全宽固定在滚动区顶栏，不参与内容宽度列收缩。 */
  pinPageHeader?: boolean
  /** 内容创作页：全宽透明顶栏工具条，无大号标题（见 WorkbenchPageChrome）。 */
  chrome?: 'workbench-tool'
  /** 桌面剪辑台等场景可关闭左右宽度把手。 */
  enableContentWidthHandles?: boolean
}) {
  const { t } = useTranslation('workbench')
  const c = usePanelCopy()
  const toolChrome = chrome === 'workbench-tool'
  const pinHeader = toolChrome || Boolean(pinPageHeader)
  const headerTitle = toolChrome || pinHeader ? c(title) : ''
  const localizedActions = actions ? <LocalizedPanelCopy>{actions}</LocalizedPanelCopy> : undefined
  const shell = (
    <PageShell
      title={c(title)}
      titleExtra={titleExtra}
      actions={localizedActions}
      suppressHeader={Boolean(moduleId && pinHeader)}
      noCard
    >
      <LocalizedPanelCopy>{children}</LocalizedPanelCopy>
    </PageShell>
  )

  if (!moduleId) {
    return shell
  }

  const topChrome =
    pinHeader ? (
      <LocalizedPanelCopy>
        <PageShellHeader
          title={headerTitle}
          titleTone={toolChrome ? 'inline' : 'page'}
          headerLeading={headerLeading}
          titleExtra={titleExtra}
          actions={actions}
          headerTrailing={headerTrailing}
        />
      </LocalizedPanelCopy>
    ) : undefined

  const moduleLayoutClassName = cn(toolChrome && WB_MODULE_PAGE_LAYOUT_CLASS, layoutClassName)

  return (
    <ModuleLayout
      moduleId={moduleId}
      defaultWidth={defaultWidth}
      minWidth={minWidth}
      edgeBudget={edgeBudget}
      className={moduleLayoutClassName}
      topChrome={topChrome}
      topChromeClassName={pinHeader ? 'wb-page-top-chrome' : undefined}
      enableHandles={enableContentWidthHandles}
      leftHandleLabel={t('contentWidthHandleLeft')}
      rightHandleLabel={t('contentWidthHandleRight')}
    >
      {shell}
    </ModuleLayout>
  )
}
export function Panel({ title, description, actions, children, className = '' }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <Card className={`wb-panel ${className}`}><CardHeader className="wb-panel-header"><div className="panel-heading"><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</div>{actions && <div className="toolbar">{actions}</div>}</CardHeader><CardContent className="wb-panel-content">{children}</CardContent></Card>
}
export function Field({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: ReactNode }) {
  const id = useId()
  return <div className="wb-field"><label className="wb-field-label" id={`${id}-label`} htmlFor={id}>{label}{required && <span aria-hidden="true" className="required-mark">*</span>}</label><div className="wb-field-control" aria-labelledby={`${id}-label`}>{isValidElement(children) && (typeof children.type !== 'string' || ['input', 'textarea', 'select'].includes(children.type)) ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, 'aria-labelledby': `${id}-label`, 'aria-describedby': hint || error ? `${id}-hint` : undefined, 'aria-invalid': !!error }) : children}</div>{error ? <p id={`${id}-hint`} className="field-error" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="field-hint">{hint}</p> : null}</div>
}
export function SelectField({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (value: string) => void; options: readonly { value: string; label: string }[]; hint?: string }) {
  const id = useId()
  return <div className="wb-field"><label className="wb-field-label" id={`${id}-label`} htmlFor={id}>{label}</label><Select items={[...options]} value={value} onValueChange={next => { if (next !== null) onChange(String(next)) }}><SelectTrigger id={id} aria-labelledby={`${id}-label`} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>{hint && <p className="field-hint">{hint}</p>}</div>
}
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'error' }) {
  const Icon = tone === 'success' ? Check : tone === 'error' ? AlertCircle : tone === 'warning' ? TriangleAlert : Info
  return <div className={`wb-notice wb-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon size={16} aria-hidden="true" /><div>{children}</div></div>
}
export function EmptyResult({ title, description }: { title?: string; description?: string }) {
  const c = usePanelCopy()
  return <Empty className="wb-empty"><EmptyHeader><EmptyMedia className="wb-empty-icon"><FileText size={28} strokeWidth={1.4} /></EmptyMedia><EmptyTitle>{title ?? c('你的创作，将在这里呈现')}</EmptyTitle><EmptyDescription>{description ?? c('填写左侧信息，点击生成演示，即可预览并编辑结果。')}</EmptyDescription></EmptyHeader></Empty>
}
export function ResultActions({
  text,
  filename,
  children,
  embedded,
  leading,
}: {
  text: string
  filename: string
  children?: ReactNode
  /** 复制/下载之前的操作（如提词器、专用导出） */
  leading?: ReactNode
  /** 与页签等同排展示时去掉底部分隔区样式 */
  embedded?: boolean
}) {
  const c = usePanelCopy()
  async function copy() {
    try {
      await copyText(text)
      toastSuccess(c('已复制到剪贴板'))
    } catch {
      toastError(c('复制失败，请选择文本后手动复制。'))
    }
  }
  return (
    <div className={embedded ? 'result-action-wrap result-action-wrap--embedded' : 'result-action-wrap'}>
      <div className="toolbar">
        {leading}
        <Button type="button" variant="secondary" onClick={copy}>
          <Clipboard />
          {c('复制全部')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            downloadText(text, filename)
            toastSuccess(c('已提交浏览器下载，请检查下载列表。'))
          }}
        >
          <Download />
          {c('下载文本')}
        </Button>
        {children}
      </div>
    </div>
  )
}
export function CreationSteps({ hasResult }: { hasResult: boolean }) { const c = usePanelCopy(); return <WizardSteps variant="line" activeIndex={hasResult ? 2 : 0} ariaLabel={c('本地创作步骤')} steps={[{ id: 'input', label: c('准备资料') }, { id: 'demo', label: c('生成演示') }, { id: 'edit', label: c('编辑与导出') }]} /> }
export function LoadingResult({ remote = false }: { remote?: boolean }) {
  const c = usePanelCopy()
  return (
    <div className="loading-result" role="status" aria-label={remote ? '正在生成' : c('正在准备演示结果')}>
      <Skeleton className="h-6 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-5/6" />
      <p>{remote ? '正在调用模型生成，将按平台规则扣除积分。' : c('正在准备演示内容，不调用模型、不扣积分。')}</p>
    </div>
  )
}
export type GenerationStatus = 'idle' | 'loading' | 'success' | 'error' | 'cancelled'
export function useAsyncJob<T>() {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  function cancel() {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus((s) => (s === 'loading' ? 'cancelled' : s))
  }

  function reset() {
    abortRef.current?.abort()
    abortRef.current = null
    setResult(null)
    setError('')
    setStatus('idle')
  }

  async function runAsync(producer: (signal: AbortSignal) => Promise<T>) {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setStatus('loading')
    setError('')
    try {
      const value = await producer(ac.signal)
      if (ac.signal.aborted) {
        setStatus('cancelled')
        return
      }
      setResult(value)
      setStatus('success')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setStatus('cancelled')
        return
      }
      setError(e instanceof Error ? e.message : '生成失败，请稍后重试。')
      setStatus('error')
    } finally {
      if (abortRef.current === ac) abortRef.current = null
    }
  }

  return { status, result, error, runAsync, cancel, reset }
}
export function useDemoGeneration<T>() {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState('')
  const pending = useRef<{ timer: number; resolve: () => void } | null>(null)
  function clear() { const active = pending.current; if (active) { window.clearTimeout(active.timer); pending.current = null; active.resolve() } }
  useEffect(() => () => { clear() }, [])
  function run(producer: () => T): Promise<void> {
    clear(); setStatus('loading'); setError('')
    return new Promise(resolve => {
      const timer = window.setTimeout(() => { pending.current = null; try { setResult(producer()); setStatus('success') } catch (e) { setError(e instanceof Error ? e.message : '演示内容生成失败，请检查输入后重试。'); setStatus('error') } resolve() }, 650)
      pending.current = { timer, resolve }
    })
  }
  function cancel() { clear(); setStatus('cancelled') }
  function reset() { clear(); setResult(null); setError(''); setStatus('idle') }
  return { status, result, error, run, cancel, reset }
}
