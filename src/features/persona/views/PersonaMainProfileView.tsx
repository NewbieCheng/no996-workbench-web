import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@no996/ui/badge'
import { Button } from '@no996/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@no996/ui/card'
import { Textarea } from '@no996/ui/textarea'
import { AIEditPopover } from '@no996/ui/ai-edit-popover'
import {
  BookmarkCheckIcon,
  CheckIcon,
  DownloadIcon,
  PencilIcon,
} from 'lucide-react'
import { PersonaProfileChromeActions } from './PersonaProfileChromeActions'
import {
  PACKAGING_LABELS,
  POSITIONING_LABELS,
  fieldValue,
  moduleFields,
  parseMainProfile,
  patchMainProfileModule,
  type AccountCardModuleId,
} from '../lib/account-card'
import type { PackagingId, PositioningId } from '../../../services/persona/types'
import { polishProfileDocField } from '../agent/form-assist'
import type { UserProfileFormData } from '../../../services/persona'

type Props = {
  markdown: string
  isDefault: boolean
  lastSavedAt?: string
  usedMock?: boolean
  saving?: boolean
  personaName?: string
  selectedPositioning?: PositioningId
  selectedPackaging?: PackagingId
  summary?: string
  onSaveModule: (markdown: string) => Promise<void>
  onChangeCombo?: () => void
  onEditQuestionnaire?: () => void
  onSetDefault?: () => void
  legacyContent?: string
  /** 把档案操作挂到页头 chrome；卸载时传 null */
  onChromeActionsChange?: (node: ReactNode | null) => void
}

const MODULES: AccountCardModuleId[] = ['advantages', 'audience', 'positioning', 'packaging', 'redlines']

const MODULE_NUMBERS: Record<AccountCardModuleId, string> = {
  advantages: '01',
  audience: '02',
  positioning: '03',
  packaging: '04',
  redlines: '05',
}

function downloadMarkdown(markdown: string, name: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name || 'persona-profile'}.md`
  link.click()
  URL.revokeObjectURL(url)
}

/** 超过限制高度的内容展示微渐变折叠与展开收起 */
function ExpandableFieldValue({ value, waitingText }: { value: string; waitingText: string }) {
  const { t } = useTranslation('persona')
  const valueRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  useLayoutEffect(() => {
    const element = valueRef.current
    if (!element || expanded) return
    const measure = () => setHasMore(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded, value])

  const isEmpty = !value || value.trim() === '待补充'

  return (
    <div className="persona-field-item__value-wrap">
      <div
        ref={valueRef}
        className={`persona-field-item__value${expanded ? ' is-expanded' : ' is-clamped'}`}
      >
        {isEmpty ? (
          <span className="persona-field-item__waiting">{waitingText}</span>
        ) : (
          value
        )}
      </div>
      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="persona-field-item__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((curr) => !curr)}
        >
          {expanded ? t('preview.showLess', { defaultValue: '收起' }) : t('preview.showMore', { defaultValue: '展开全部' })}
        </Button>
      ) : null}
    </div>
  )
}

export function PersonaMainProfileView({
  markdown,
  isDefault,
  usedMock,
  saving = false,
  personaName,
  selectedPositioning,
  selectedPackaging,
  summary,
  onSaveModule,
  onChangeCombo,
  onEditQuestionnaire,
  onSetDefault,
  legacyContent,
  onChromeActionsChange,
}: Props) {
  const { t } = useTranslation('persona')
  const parsed = useMemo(() => parseMainProfile(markdown), [markdown])

  // 双模式：全局浏览 vs 全局编辑
  const [isGlobalEditing, setIsGlobalEditing] = useState(false)
  // 单模块编辑：当前正在编辑的模块 id
  const [activeEditingModule, setActiveEditingModule] = useState<AccountCardModuleId | null>(null)
  // 正在编辑的草稿字段
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, Record<string, string>>>({})
  // 复制反馈
  const [copied, setCopied] = useState(false)
  // 历史遗留文本模式编辑
  const [editingLegacy, setEditingLegacy] = useState(false)
  const [legacyDraft, setLegacyDraft] = useState('')
  const chromeActionsRef = useRef(onChromeActionsChange)
  chromeActionsRef.current = onChromeActionsChange
  const actionApiRef = useRef({
    copyAll: async () => {},
    toggleGlobalEdit: () => {},
    setEditingLegacy,
    setLegacyDraft,
    onChangeCombo,
    onEditQuestionnaire,
    onSetDefault,
    markdown: '',
    exportName: '',
    hasParsed: false,
    editingLegacy: false,
  })

  // AI 智能优化 Popover 相关状态
  const [polishingField, setPolishingField] = useState<string | null>(null)
  const [revisions, setRevisions] = useState<Record<string, string>>({})
  const [polishErrors, setPolishErrors] = useState<Record<string, string>>({})
  const [streamingByField, setStreamingByField] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  // 基础人设上下文供 AI 润色字段时使用
  const profileContext = useMemo<UserProfileFormData>(() => {
    return {
      industry: fieldValue(parsed?.positioning, '细分赛道') || '专业服务',
      role: fieldValue(parsed?.positioning, '基础身份') || personaName || '行业专家',
      primaryBusiness: fieldValue(parsed?.positioning, '核心优势') || '',
      targetClients: fieldValue(parsed?.audience, '核心客户') || '',
      clientPainPoints: fieldValue(parsed?.audience, '三大痛点') || '',
      desiredImage: fieldValue(parsed?.positioning, '三个人格标签') || '',
      additionalInfo: '',
    }
  }, [parsed, personaName])

  const positioningId = parsed?.positioningId || selectedPositioning
  const packagingId = parsed?.packagingId || selectedPackaging

  // 标题
  const displayTitle =
    personaName ||
    fieldValue(parsed?.positioning, '基础身份') ||
    t('profile.title', { defaultValue: '人设定位 Profile' })

  // 标签描述
  const positioningLabel = positioningId
    ? `方案 ${positioningId}｜${POSITIONING_LABELS[positioningId as PositioningId]}`
    : summary || '待定'
  const packagingLabel = packagingId ? PACKAGING_LABELS[packagingId as PackagingId] : '待定'

  // AI 优化预设
  const quickPrompts = useMemo(
    () => [
      { label: t('form.tuneConcise', { defaultValue: '更简练' }), instruction: '表达更简练清晰，去除套话' },
      { label: t('form.tuneSpecific', { defaultValue: '更具体' }), instruction: '增加专业细节与具象化场景，体现竞争力' },
      { label: t('form.tuneWarm', { defaultValue: '更温和' }), instruction: '语气更具亲和力，拉近与客户距离' },
    ],
    [t],
  )

  const popoverLabels = useMemo(
    () => ({
      trigger: t('form.optimizeField', { defaultValue: 'AI 优化' }),
      context: t('form.aiPopoverContext', { defaultValue: '当前字段参考上下文' }),
      promptPlaceholder: t('form.aiPopoverPromptPlaceholder', { defaultValue: '输入微调要求，如：更接地气一点...' }),
      apply: t('form.adoptSuggestion', { defaultValue: '采纳建议' }),
      dismiss: t('form.dismissRevision', { defaultValue: '放弃' }),
      loading: t('form.aiPopoverLoading', { defaultValue: '正在生成优化建议...' }),
      send: t('form.aiPopoverSend', { defaultValue: '发送' }),
      focusHint: t('form.aiPopoverFocusHint', { defaultValue: '回车发送' }),
      result: t('form.aiPopoverResult', { defaultValue: 'AI 优化建议' }),
    }),
    [t],
  )

  // 复制完整档案
  async function copyAll() {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 启动某个模块编辑
  function startEditModule(id: AccountCardModuleId) {
    const block = parsed?.[id]
    const current: Record<string, string> = {}
    for (const label of moduleFields(id)) {
      current[label] = fieldValue(block, label)
    }
    setModuleDrafts((prev) => ({ ...prev, [id]: current }))
    setActiveEditingModule(id)
  }

  // 保存单模块修改
  async function saveModuleEdit(id: AccountCardModuleId) {
    const draft = moduleDrafts[id] || {}
    const fields = moduleFields(id).map((label) => ({
      label,
      value: (draft[label] ?? '').trim() || '待补充',
    }))
    const nextMarkdown = patchMainProfileModule(markdown, id, fields)
    try {
      await onSaveModule(nextMarkdown)
      setActiveEditingModule(null)
      // 如果处于全局编辑态且只剩这一个，退出编辑态
      if (!isGlobalEditing) {
        setModuleDrafts((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    } catch {
      // 页面显示错误，草稿保留便于重试
    }
  }

  // 切换全局编辑模式
  function toggleGlobalEdit() {
    if (isGlobalEditing) {
      // 退出全局编辑
      setIsGlobalEditing(false)
      setActiveEditingModule(null)
    } else {
      // 进入全局编辑，初始化所有模块草稿
      if (parsed) {
        const drafts: Record<string, Record<string, string>> = {}
        for (const id of MODULES) {
          const block = parsed[id]
          const cur: Record<string, string> = {}
          for (const label of moduleFields(id)) {
            cur[label] = fieldValue(block, label)
          }
          drafts[id] = cur
        }
        setModuleDrafts(drafts)
      }
      setIsGlobalEditing(true)
    }
  }

  // 运行 AI 润色字段
  async function runPolish(moduleId: string, fieldLabel: string, currentValue: string, instruction?: string) {
    const fieldKey = `${moduleId}::${fieldLabel}`
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPolishingField(fieldKey)
    setPolishErrors((prev) => ({ ...prev, [fieldKey]: '' }))
    setStreamingByField((prev) => ({ ...prev, [fieldKey]: '' }))

    try {
      const suggestion = await polishProfileDocField({
        fieldLabel,
        value: currentValue,
        form: profileContext,
        instruction,
        signal: controller.signal,
        onPartial: (text) => setStreamingByField((prev) => ({ ...prev, [fieldKey]: text })),
      })
      setRevisions((prev) => ({ ...prev, [fieldKey]: suggestion }))
    } catch (e) {
      if (controller.signal.aborted) return
      setPolishErrors((prev) => ({
        ...prev,
        [fieldKey]: e instanceof Error ? e.message : 'AI 优化失败，请重试',
      }))
    } finally {
      setPolishingField(null)
    }
  }

  // 采纳 AI 优化建议
  function applyPolishSuggestion(moduleId: AccountCardModuleId, fieldLabel: string) {
    const fieldKey = `${moduleId}::${fieldLabel}`
    const suggestion = revisions[fieldKey]
    if (!suggestion) return

    setModuleDrafts((prev) => ({
      ...prev,
      [moduleId]: {
        ...(prev[moduleId] || {}),
        [fieldLabel]: suggestion,
      },
    }))
    setRevisions((prev) => {
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }

  // 放弃 AI 建议
  function dismissPolish(moduleId: string, fieldLabel: string) {
    const fieldKey = `${moduleId}::${fieldLabel}`
    setRevisions((prev) => {
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }

  const exportName =
    personaName ||
    fieldValue(parsed?.positioning, '基础身份') ||
    t('profile.exportName', { defaultValue: '人设档案' })
  const chromeEditing = parsed ? isGlobalEditing : editingLegacy
  const chromeBusy = saving || (parsed ? activeEditingModule !== null && !isGlobalEditing : false)
  const canChangeCombo = Boolean(parsed && onChangeCombo)
  const canEditQuestionnaire = Boolean(onEditQuestionnaire)
  const canSetDefault = Boolean(onSetDefault && !isDefault)

  actionApiRef.current = {
    copyAll,
    toggleGlobalEdit,
    setEditingLegacy,
    setLegacyDraft,
    onChangeCombo,
    onEditQuestionnaire,
    onSetDefault,
    markdown,
    exportName,
    hasParsed: Boolean(parsed),
    editingLegacy,
  }

  // 只把「会变的 UI 态」放进 deps；父级回调走 ref，避免 inline 函数导致无限 setState
  useLayoutEffect(() => {
    const publish = chromeActionsRef.current
    if (!publish) return
    if (!markdown.trim()) {
      publish(null)
      return
    }
    publish(
      <PersonaProfileChromeActions
        copied={copied}
        editing={chromeEditing}
        busy={chromeBusy}
        canChangeCombo={canChangeCombo}
        canEditQuestionnaire={canEditQuestionnaire}
        canSetDefault={canSetDefault}
        onCopy={() => void actionApiRef.current.copyAll()}
        onExport={() => {
          const api = actionApiRef.current
          downloadMarkdown(api.markdown, `${api.exportName}-人设文档`)
        }}
        onToggleEdit={() => {
          const api = actionApiRef.current
          if (api.hasParsed) {
            api.toggleGlobalEdit()
            return
          }
          if (api.editingLegacy) {
            api.setEditingLegacy(false)
            return
          }
          api.setLegacyDraft(api.markdown)
          api.setEditingLegacy(true)
        }}
        onChangeCombo={
          canChangeCombo ? () => actionApiRef.current.onChangeCombo?.() : undefined
        }
        onEditQuestionnaire={
          canEditQuestionnaire ? () => actionApiRef.current.onEditQuestionnaire?.() : undefined
        }
        onSetDefault={canSetDefault ? () => actionApiRef.current.onSetDefault?.() : undefined}
      />,
    )
  }, [
    canChangeCombo,
    canEditQuestionnaire,
    canSetDefault,
    chromeBusy,
    chromeEditing,
    copied,
    markdown,
  ])

  useEffect(() => {
    return () => {
      chromeActionsRef.current?.(null)
    }
  }, [])

  // 针对旧格式未解析成功的兜底呈现
  if (!parsed && markdown.trim()) {
    return (
      <article className="persona-main-profile">
        <header className="persona-main-hero">
          <div className="persona-main-hero__meta">
            <h2 className="persona-main-hero__title">{t('legacyProfileTitle', { defaultValue: '人设定位档案' })}</h2>
            <p className="persona-main-hero__subtitle">{t('legacyProfileDescription', { defaultValue: '当前为旧版或文本格式档案' })}</p>
          </div>
          <div className="persona-main-hero__status">
            <Badge variant="secondary" className="persona-badge--saved">
              <CheckIcon className="w-3 h-3 mr-1" />
              {t('profile.saved', { defaultValue: '已保存' })}
            </Badge>
            {isDefault ? (
              <Badge className="persona-badge--default">
                <BookmarkCheckIcon className="w-3 h-3 mr-1" />
                {t('preview.defaultBadge', { defaultValue: '默认人设' })}
              </Badge>
            ) : null}
          </div>
        </header>

        {editingLegacy ? (
          <Card className="persona-main-module">
            <CardHeader className="persona-main-module__head">
              <CardTitle>{t('preview.editProfile', { defaultValue: '编辑档案' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={18}
                className="font-mono text-sm leading-relaxed"
                value={legacyDraft}
                onChange={(event) => setLegacyDraft(event.target.value)}
                aria-label={t('preview.generated')}
              />
              <div className="persona-main-module__edit-actions mt-4">
                <Button type="button" variant="outline" onClick={() => setEditingLegacy(false)}>
                  {t('cancel', { defaultValue: '取消' })}
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void onSaveModule(legacyDraft).then(() => setEditingLegacy(false))}
                >
                  {saving ? t('profile.saving', { defaultValue: '保存中...' }) : t('profile.saveModule', { defaultValue: '保存档案' })}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="persona-main-module">
            <CardContent className="pt-6">
              <pre className="prompt-preview brain-profile-doc" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {markdown}
              </pre>
            </CardContent>
          </Card>
        )}
      </article>
    )
  }

  if (!parsed) {
    return (
      <div className="persona-empty-container">
        <p className="persona-profile-empty">{t('recordsNoContent', { defaultValue: '暂无人设内容' })}</p>
      </div>
    )
  }

  return (
    <article className="persona-main-profile">
      {/* 顶部 Hero 区域 */}
      <header className="persona-main-hero">
        <div className="persona-main-hero__meta">
          <div className="persona-main-hero__title-row">
            <h2 className="persona-main-hero__title">{displayTitle}</h2>
            <div className="persona-main-hero__status">
              <Badge variant="secondary" className="persona-badge--saved">
                <CheckIcon className="w-3 h-3 mr-1" />
                {t('profile.saved', { defaultValue: '已保存' })}
              </Badge>
              {isDefault ? (
                <Badge className="persona-badge--default">
                  <BookmarkCheckIcon className="w-3 h-3 mr-1" />
                  {t('preview.defaultBadge', { defaultValue: '默认人设' })}
                </Badge>
              ) : null}
              {usedMock ? (
                <Badge variant="outline" className="persona-badge--demo">
                  {t('profile.demo', { defaultValue: '演示数据' })}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="persona-main-hero__tags">
            <span className="persona-pill-tag persona-pill-tag--positioning">
              <span className="persona-pill-tag__label">主定位</span>
              <strong className="persona-pill-tag__value">{positioningLabel}</strong>
            </span>
            <span className="persona-pill-tag persona-pill-tag--packaging">
              <span className="persona-pill-tag__label">包装风格</span>
              <strong className="persona-pill-tag__value">{packagingLabel}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* 5 大核心模块卡片；复制/导出/编辑等已并入页头 chrome */}
      <div className="persona-modules-stack">
        {MODULES.map((id) => {
          const block = parsed[id]
          const isSectionEditing = isGlobalEditing || activeEditingModule === id
          const currentDraft = moduleDrafts[id] || {}

          // 模块标题处理
          const title =
            id === 'advantages'
              ? t('select.advantages', { defaultValue: '人物优势' })
              : id === 'audience'
                ? t('select.audience', { defaultValue: '目标人群与需求' })
                : id === 'positioning'
                  ? block.title || t('select.positioningTitle', { defaultValue: '人设定位方案' })
                  : id === 'packaging'
                    ? block.title || t('select.packagingTitle', { defaultValue: '账号包装建议' })
                    : t('select.redlines', { defaultValue: '禁止事项与表达红线' })

          return (
            <Card
              key={id}
              id={`persona-module-${id}`}
              className={`persona-main-module${isSectionEditing ? ' is-editing' : ''}`}
            >
              <CardHeader className="persona-main-module__head">
                <div className="persona-main-module__title-wrap">
                  <span className="persona-main-module__badge">{MODULE_NUMBERS[id]}</span>
                  <CardTitle className="persona-main-module__title">{title}</CardTitle>
                </div>

                <div className="persona-main-module__controls">
                  {isSectionEditing ? (
                    <Badge variant="outline" className="persona-editing-indicator">
                      <span className="persona-editing-indicator__dot" />
                      {t('profile.editing', { defaultValue: '编辑中' })}
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="persona-btn-edit-module"
                      disabled={saving || (activeEditingModule !== null && activeEditingModule !== id)}
                      onClick={() => startEditModule(id)}
                    >
                      <PencilIcon className="w-3.5 h-3.5 mr-1" />
                      {t('profile.editModule', { defaultValue: '编辑本模块' })}
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="persona-main-module__content">
                {isSectionEditing ? (
                  /* 编辑模式（支持 AI 智能润色） */
                  <div className="persona-module-editor">
                    <div className="persona-module-editor__fields">
                      {moduleFields(id).map((label) => {
                        const fieldKey = `${id}::${label}`
                        const currentValue = currentDraft[label] ?? fieldValue(block, label)
                        const revision = revisions[fieldKey]
                        const isBusy = polishingField === fieldKey

                        return (
                          <div key={label} className="persona-editor-field">
                            <label className="persona-editor-field__label" htmlFor={`persona-edit-${id}-${label}`}>
                              {label}
                            </label>
                            <div className="persona-q-field-input-control persona-q-field-input-control--multiline persona-editor-field__control">
                              <Textarea
                                id={`persona-edit-${id}-${label}`}
                                rows={Math.min(6, Math.max(3, Math.ceil((currentValue || '').length / 45)))}
                                value={currentValue}
                                placeholder={t('profile.placeholderField', { defaultValue: '请输入内容...' })}
                                disabled={isBusy}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setModuleDrafts((prev) => ({
                                    ...prev,
                                    [id]: {
                                      ...(prev[id] || {}),
                                      [label]: val,
                                    },
                                  }))
                                }}
                              />
                              <div className="persona-q-field-input-control__actions">
                                <AIEditPopover
                                  className="ai-edit-popover--profile"
                                  popoverClassName="ai-edit-popover--profile-field"
                                  popoverSide="top"
                                  popoverAlign="end"
                                  fieldLabel={label}
                                  value={currentValue}
                                  result={revision}
                                  streamingResult={isBusy ? streamingByField[fieldKey] : undefined}
                                  busy={isBusy}
                                  error={polishErrors[fieldKey]}
                                  quickPrompts={quickPrompts}
                                  labels={popoverLabels}
                                  onGenerate={(instruction) => void runPolish(id, label, currentValue, instruction || undefined)}
                                  onApply={() => applyPolishSuggestion(id, label)}
                                  onDismiss={() => dismissPolish(id, label)}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="persona-module-editor__footer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => {
                          if (isGlobalEditing) {
                            setIsGlobalEditing(false)
                          }
                          setActiveEditingModule(null)
                        }}
                      >
                        {t('cancel', { defaultValue: '取消' })}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving}
                        onClick={() => void saveModuleEdit(id)}
                      >
                        {saving ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-1.5" />
                            {t('profile.saving', { defaultValue: '保存中...' })}
                          </>
                        ) : (
                          t('profile.saveModule', { defaultValue: '保存本模块' })
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* 浏览模式：档案式字段列表，不再套内层边框卡 */
                  <dl className="persona-fields-list">
                    {moduleFields(id).map((label) => {
                      const value = fieldValue(block, label)
                      return (
                        <div key={label} className="persona-field-item">
                          <dt className="persona-field-item__label">{label}</dt>
                          <dd className="persona-field-item__body">
                            <ExpandableFieldValue
                              value={value}
                              waitingText={t('profile.pending', { defaultValue: '待补充' })}
                            />
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {legacyContent && (
        <div className="persona-main-module persona-main-module--legacy mt-6">
          <p className="text-xs text-muted-foreground mb-2">{t('legacyMigrationNotice', { defaultValue: '包含旧版人设档案记录' })}</p>
          <details className="persona-legacy-details">
            <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
              {t('legacyOriginal', { defaultValue: '查看历史完整原文' })}
            </summary>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mb-2"
                onClick={() => downloadMarkdown(legacyContent, 'original-persona-profile')}
              >
                <DownloadIcon className="w-3.5 h-3.5 mr-1" />
                {t('profile.export', { defaultValue: '导出历史原文' })}
              </Button>
              <pre className="prompt-preview brain-profile-doc p-3 rounded-lg border text-xs" style={{ whiteSpace: 'pre-wrap' }}>
                {legacyContent}
              </pre>
            </div>
          </details>
        </div>
      )}
    </article>
  )
}
