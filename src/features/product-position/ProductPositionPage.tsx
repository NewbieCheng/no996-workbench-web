import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Plus, Sparkles, X } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@no996/ui/tooltip'
import { Page } from '../../components/WorkbenchUI'
import {
  WorkbenchPageChromeActions,
  WorkbenchPageChromeLeading,
} from '../../components/WorkbenchUI'
import { AgentFlowExplain } from '../../components/agent/AgentFlowExplain'
import { AgentProgress } from '../../components/agent/AgentProgress'
import { resolveAgentMode } from '../../agent'
import type { AgentRunSnapshot } from '../../agent'
import { toastError } from '../../lib/toast'
import {
  createEmptyProduct,
  deleteProduct as deleteProductRecord,
  getProductPositionOwner,
  getLatestAttempt,
  getLatestReport,
  getReport,
  hasFieldErrors,
  listProducts,
  saveProduct,
  validateProductBasics,
  type ProductAttachment,
  type ProductFieldErrors,
  type ProductListItem,
  type ProductRecord,
  type ProductReportSnapshot,
  type ReportInputSnapshot,
} from '../../services/product-position'
import { normalizeQuestionnaire } from '../../services/persona'
import { usePersonaInjection } from '../../components/agent/PersonaInjection'
import { PersonaBinding } from '../../components/agent/PersonaBinding'
import {
  useWorkbenchTaskActions,
  useWorkbenchTasks,
  type ProductPositioningPayload,
} from '../../services/workbench-tasks'
import { extractDocumentText, resolveDocumentKind } from '../../lib/chat-attachments/parse-document'
import { PRODUCT_POSITIONING_STAGES } from './agent/product-position-flow'
import { checkAdequacy } from './lib/adequacy'
import { ProductSwitcher } from './views/ProductSwitcher'
import { ProductInputForm } from './views/ProductInputForm'
import { ProductReport } from './views/ProductReport'
import './product-position.css'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY = 700
const RUN_POLL_INTERVAL = 1200

function attachmentId(): string {
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function hasDraftContent(product: ProductRecord): boolean {
  if (product.name.trim() || product.type.trim()) return true
  if (product.answers.usage.trim() || product.answers.current.trim()) return true
  return product.specs.some((spec) => spec.name.trim() || spec.price.trim())
}

/** 任务入队后，页面只观察真实状态；不伪造进度百分比。 */
export default function ProductPositionPage() {
  const owner = useMemo(() => getProductPositionOwner(), [])
  const isMock = useMemo(() => resolveAgentMode() === 'demo', [])
  const tasks = useWorkbenchTasks({ kind: 'product_positioning' })
  const { enqueueProductPositioning, getPayload } = useWorkbenchTaskActions()
  // 与爆款标题等创作页同一套人设绑定：右上角选择本次引用哪一档。
  const personaInject = usePersonaInjection()

  const [items, setItems] = useState<ProductListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProductRecord | null>(null)
  const [report, setReport] = useState<ProductReportSnapshot | null>(null)
  const [failedAttempt, setFailedAttempt] = useState<ProductReportSnapshot | null>(null)
  const [mode, setMode] = useState<'input' | 'report'>('input')
  const [formErrors, setFormErrors] = useState<ProductFieldErrors>({})
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [runSnapshot, setRunSnapshot] = useState<AgentRunSnapshot | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const saveTimer = useRef<number | null>(null)
  const draftRef = useRef<ProductRecord | null>(null)
  const handledTaskRef = useRef<string | null>(null)
  draftRef.current = draft

  const refresh = useCallback(async (): Promise<ProductListItem[]> => {
    const products = await listProducts(owner)
    const rows = await Promise.all(
      products.map(async (product): Promise<ProductListItem> => {
        const [latest, attempt] = await Promise.all([getLatestReport(product.id), getLatestAttempt(product.id)])
        const runningTask = attempt?.status === 'running'
        return {
          product,
          latestReport: latest,
          status: runningTask ? 'running' : latest ? 'ready' : attempt?.status === 'failed' ? 'failed' : 'empty',
          updatedAt: latest?.updatedAt ?? attempt?.updatedAt ?? product.updatedAt,
        }
      }),
    )
    setItems(rows)
    return rows
  }, [owner])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await refresh()
        if (cancelled) return
        if (rows.length > 0) {
          const first = rows[0]
          setSelectedId(first.product.id)
          setDraft(first.product)
          setReport(first.latestReport ?? null)
          setFailedAttempt(first.latestReport ? null : (await getLatestAttempt(first.product.id)) ?? null)
          setMode(first.latestReport ? 'report' : 'input')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const persistDraft = useCallback(
    async (product: ProductRecord) => {
      setSaveState('saving')
      try {
        const saved = await saveProduct(product)
        await refresh()
        setSaveState('saved')
        return saved
      } catch (error) {
        setSaveState('error')
        throw error
      }
    },
    [refresh],
  )

  const scheduleSave = useCallback(
    (next: ProductRecord) => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
      if (!hasDraftContent(next)) return
      setSaveState('saving')
      saveTimer.current = window.setTimeout(() => {
        void persistDraft(next).catch(() => {
          /* 状态已在 persistDraft 里标记 */
        })
      }, AUTOSAVE_DELAY)
    },
    [persistDraft],
  )

  useEffect(
    () => () => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
    },
    [],
  )

  const updateDraft = useCallback(
    (patch: Partial<ProductRecord>) => {
      const current = draftRef.current
      if (!current) return
      const next = { ...current, ...patch }
      draftRef.current = next
      setDraft(next)
      scheduleSave(next)
    },
    [scheduleSave],
  )

  const selectProduct = useCallback(
    async (productId: string) => {
      const found = items.find((item) => item.product.id === productId)
      const product = found?.product ?? (await listProducts(owner)).find((row) => row.id === productId)
      if (!product) return
      if (draftRef.current && draftRef.current.id !== productId) {
        if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
        await persistDraft(draftRef.current)
      }
      setSelectedId(product.id)
      setDraft(product)
      setAnalysisError(null)
      setFormErrors({})
      const latest = await getLatestReport(product.id)
      const attempt = latest ? null : ((await getLatestAttempt(product.id)) ?? null)
      setReport(latest ?? null)
      setFailedAttempt(attempt)
      setMode(latest ? 'report' : 'input')
    },
    [items, owner, persistDraft],
  )

  const createProduct = useCallback(async () => {
    const product = createEmptyProduct(owner)
    const saved = await saveProduct(product)
    await refresh()
    setSelectedId(saved.id)
    setDraft(saved)
    setReport(null)
    setFailedAttempt(null)
    setMode('input')
    setAnalysisError(null)
    setFormErrors({})
    setSaveState('saved')
  }, [owner, refresh])

  const removeProduct = useCallback(
    async (productId: string) => {
      const target = items.find((item) => item.product.id === productId)
      const label = target?.product.name.trim() || '未命名产品'
      if (!window.confirm(`删除「${label}」及其分析报告？此操作不可恢复。`)) return
      await deleteProductRecord(productId)
      const rows = await refresh()
      if (selectedId === productId) {
        const next = rows[0]
        setSelectedId(next?.product.id ?? null)
        setDraft(next?.product ?? null)
        setReport(next?.latestReport ?? null)
        setFailedAttempt(null)
        setMode(next?.latestReport ? 'report' : 'input')
      }
    },
    [items, refresh, selectedId],
  )

  const addFiles = useCallback(
    async (files: File[]) => {
      const current = draftRef.current
      if (!current) return
      const created: ProductAttachment[] = files.map((file) => {
        const kind = resolveDocumentKind(file)
        return {
          id: attachmentId(),
          fileName: file.name,
          size: file.size,
          kind: kind ?? 'other',
          status: kind ? 'uploading' : 'unsupported',
          error: kind ? undefined : '仅支持 TXT、Markdown 或 Word(.docx)',
        }
      })
      const withAttachments: ProductRecord = {
        ...current,
        attachments: [...current.attachments, ...created],
      }
      draftRef.current = withAttachments
      setDraft(withAttachments)
      scheduleSave(withAttachments)

      await Promise.all(
        files.map(async (file, index) => {
          const attachment = created[index]
          if (attachment.status === 'unsupported') return
          let patch: Partial<ProductAttachment>
          try {
            const text = await extractDocumentText(file)
            patch = { status: 'parsed', text }
          } catch (error) {
            patch = { status: 'failed', error: error instanceof Error ? error.message : '解析失败' }
          }
          const latest = draftRef.current
          if (!latest) return
          const next: ProductRecord = {
            ...latest,
            attachments: latest.attachments.map((row) =>
              row.id === attachment.id ? { ...row, ...patch } : row,
            ),
          }
          draftRef.current = next
          setDraft(next)
          scheduleSave(next)
        }),
      )
    },
    [scheduleSave],
  )

  const removeAttachment = useCallback(
    (id: string) => {
      const current = draftRef.current
      if (!current) return
      updateDraft({ attachments: current.attachments.filter((file) => file.id !== id) })
    },
    [updateDraft],
  )

  const buildSnapshot = useCallback(async (product: ProductRecord): Promise<ReportInputSnapshot> => {
    const record = personaInject.enabled ? personaInject.record : null
    const persona = record
      ? {
          id: record.id,
          name: record.name,
          updatedAt: record.updatedAt,
          questionnaire: normalizeQuestionnaire(record.formData) as unknown as Record<string, string | string[]>,
          content: record.content,
        }
      : undefined
    return {
      product,
      persona,
      attachments: product.attachments.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        status: file.status,
        text: file.text,
      })),
    }
  }, [personaInject.enabled, personaInject.record])

  const analyze = useCallback(async () => {
    const current = draftRef.current
    if (!current || activeTaskId) return
    const errors = validateProductBasics(current)
    setFormErrors(errors)
    if (hasFieldErrors(errors)) {
      setMode('input')
      toastError('还差必填信息', '请补齐产品名称、类型与规格价格')
      return
    }

    if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
    const saved = await saveProduct(current)
    draftRef.current = saved
    setDraft(saved)

    const snapshot = await buildSnapshot(saved)
    const adequacy = checkAdequacy(snapshot)
    if (adequacy.status === 'insufficient') {
      setAnalysisError(adequacy.reason)
      setMode('input')
      return
    }

    setAnalysisError(null)
    setRunSnapshot(null)
    handledTaskRef.current = null
    try {
      const taskId = await enqueueProductPositioning({
        productId: saved.id,
        productName: saved.name.trim() || '未命名产品',
        snapshot,
      })
      setActiveTaskId(taskId)
      await refresh()
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : '排队失败，请重试')
    }
  }, [activeTaskId, buildSnapshot, enqueueProductPositioning, refresh])

  const activeTask = tasks.find((task) => task.id === activeTaskId)
  const generating = Boolean(activeTask && (activeTask.status === 'queued' || activeTask.status === 'running'))

  // 生成中读取任务快照，用于真实阶段进度与流式正文。
  useEffect(() => {
    if (!generating || !activeTask) return
    let cancelled = false
    const poll = async () => {
      const payload = (await getPayload(activeTask.payloadId)) as ProductPositioningPayload | null
      if (!cancelled) setRunSnapshot(payload?.run ?? null)
    }
    void poll()
    const timer = window.setInterval(() => void poll(), RUN_POLL_INTERVAL)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeTask, generating, getPayload])

  // 任务终态：成功回填报告，失败保留输入并说明原因。
  useEffect(() => {
    if (!activeTaskId || !activeTask) return
    if (activeTask.status !== 'succeeded' && activeTask.status !== 'failed') return
    if (handledTaskRef.current === activeTask.id) return
    handledTaskRef.current = activeTask.id

    void (async () => {
      if (activeTask.status === 'succeeded') {
        const payload = (await getPayload(activeTask.payloadId)) as ProductPositioningPayload | null
        const savedReport = payload?.reportId ? await getReport(payload.reportId) : null
        if (savedReport) {
          setReport(savedReport)
          setFailedAttempt(null)
          setMode('report')
        } else {
          setAnalysisError('任务已完成，但没有找到对应报告，请重新分析。')
        }
      } else {
        const payload = (await getPayload(activeTask.payloadId)) as ProductPositioningPayload | null
        const failed = payload?.reportId ? await getReport(payload.reportId) : null
        setFailedAttempt(failed)
        setAnalysisError(activeTask.errorMessage ?? failed?.error ?? '分析失败，请重试。')
        setMode('input')
        toastError('分析失败', activeTask.errorMessage ?? undefined)
      }
      setActiveTaskId(null)
      setRunSnapshot(null)
      await refresh()
    })()
  }, [activeTask, activeTaskId, getPayload, refresh])

  // 进入页面或切换产品时，绑定仍在进行中的任务（例如刷新后回到该产品）。
  useEffect(() => {
    if (activeTaskId) return
    const running = tasks.find(
      (task) => (task.status === 'queued' || task.status === 'running') && task.meta?.productId === selectedId,
    )
    if (running) setActiveTaskId(running.id)
  }, [activeTaskId, selectedId, tasks])

  const selected = draft
  const originalMarkdown = report?.markdown || failedAttempt?.markdown || ''
  const stages = runSnapshot?.stages ?? []
  const streamingText = runSnapshot?.stages.find((stage) => stage.id === 'compose-report')?.streamingContent ?? ''

  return (
    <Page
      moduleId="product-position"
      title="产品定位"
      description="建产品档案，生成定位、优势与营销表达底稿"
      chrome="workbench-tool"
      titleExtra={
        <WorkbenchPageChromeLeading className="pp-chrome-leading">
          {selected ? (
            <>
              <div className="pp-main__views" role="tablist" aria-label="产品视图">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'input'}
                  className={`pp-view-tab${mode === 'input' ? ' is-active' : ''}`}
                  onClick={() => setMode('input')}
                >
                  资料
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'report'}
                  className={`pp-view-tab${mode === 'report' ? ' is-active' : ''}`}
                  disabled={!report}
                  onClick={() => report && setMode('report')}
                >
                  报告
                  {report ? <span className="pp-view-tab__dot" aria-hidden="true" /> : null}
                </button>
              </div>
              <PersonaBinding
                options={personaInject.options}
                value={personaInject.persona}
                onChange={(persona) => personaInject.selectPersona(persona?.id ?? null)}
              />
              {isMock ? <span className="pp-badge pp-badge--demo">演示</span> : null}
            </>
          ) : null}
          <AgentFlowExplain defs={PRODUCT_POSITIONING_STAGES} lang="zh" />
        </WorkbenchPageChromeLeading>
      }
      actions={
        <WorkbenchPageChromeActions>
          {selected && (saveState === 'saving' || saveState === 'saved' || saveState === 'error') ? (
            <span className="pp-save-status" role="status">
              {saveState === 'saving' ? (
                '保存中…'
              ) : saveState === 'saved' ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" aria-hidden="true" />
                  已保存
                </>
              ) : (
                '保存失败'
              )}
            </span>
          ) : null}
          {selected ? (
            <ProductSwitcher
              items={items}
              selectedId={selectedId ?? undefined}
              loading={loading}
              currentName={selected.name}
              onSelect={(id) => void selectProduct(id)}
              onCreate={() => void createProduct()}
              onDelete={(id) => void removeProduct(id)}
            />
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="toolbar"
                  size="icon-sm"
                  aria-label="新建产品"
                  onClick={() => void createProduct()}
                />
              }
            >
              <Plus size={15} aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="bottom">新建产品</TooltipContent>
          </Tooltip>
          {selected && mode === 'input' ? (
            <Button
              type="button"
              variant="generate"
              size="sm"
              onClick={() => void analyze()}
              disabled={generating || !selected.name.trim()}
              aria-busy={generating}
              aria-label="生成产品定位与优势分析"
            >
              <Sparkles aria-hidden="true" />
              {generating ? '正在生成…' : '生成定位分析'}
            </Button>
          ) : null}
        </WorkbenchPageChromeActions>
      }
      defaultWidth={1120}
      layoutClassName="pp-module-layout"
    >
      <div className="pp-page">
        <div className="pp-main">
          {!selected ? (
            <div className="pp-empty">
              <div className="pp-empty__mark" aria-hidden="true">
                <FileText />
              </div>
              <h2>从一个产品开始</h2>
              <p>填产品名称、类型与规格价格，关联人设后即可生成定位与优势分析报告。</p>
              <Button type="button" onClick={() => void createProduct()}>
                <Plus aria-hidden="true" />
                新建产品
              </Button>
            </div>
          ) : (
            <>
              {analysisError ? (
                <div className="pp-alert" role="alert">
                  <AlertTriangle aria-hidden="true" />
                  <span>{analysisError}</span>
                  <button
                    type="button"
                    className="pp-alert__close"
                    aria-label="关闭提示"
                    onClick={() => setAnalysisError(null)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              {generating ? (
                <section className="pp-run" aria-live="polite">
                  <AgentProgress
                    stages={stages}
                    defs={PRODUCT_POSITIONING_STAGES}
                    mock={isMock}
                    variant="compact"
                    showProgress={false}
                    streamingText={streamingText}
                  />
                </section>
              ) : null}

              {mode === 'report' && report ? (
                <ProductReport
                  product={selected}
                  report={report}
                  isMock={isMock}
                  regenerating={generating}
                  onRegenerate={() => void analyze()}
                  onBackToInput={() => setMode('input')}
                />
              ) : (
                <ProductInputForm
                  product={selected}
                  errors={formErrors}
                  disabled={generating}
                  onChange={updateDraft}
                  onAddFiles={(files) => void addFiles(files)}
                  onRemoveAttachment={removeAttachment}
                />
              )}

              {mode === 'input' && failedAttempt && !generating ? (
                <div className="pp-fail">
                  <p>{failedAttempt.error ?? '上一次分析没有成功。'}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowOriginal(true)}>
                    查看上一次的原文
                  </Button>
                </div>
              ) : null}

              {report ? (
                <div className="pp-footnote">
                  <button type="button" className="pp-link" onClick={() => setShowOriginal(true)}>
                    查看报告原文 Markdown
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Dialog open={showOriginal} onOpenChange={setShowOriginal}>
        <DialogContent className="pp-original">
          <DialogHeader>
            <DialogTitle>报告原文</DialogTitle>
          </DialogHeader>
          <pre className="pp-original__body">{originalMarkdown || '还没有可查看的原文。'}</pre>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
