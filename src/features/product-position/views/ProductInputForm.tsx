import { useRef } from 'react'
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { AttachmentUploader, type AttachmentUploaderItem } from '@no996/ui/attachment-uploader'
import { Button } from '@no996/ui/button'
import { GlassPanel } from '@no996/ui/GlassPanel'
import type { ProductAnswers, ProductAttachment, ProductRecord } from '../../../services/product-position/types'
import { PRODUCT_TYPE_PRESETS, newProductId } from '../../../services/product-position/types'
import { hasFieldErrors, validateProductBasics, type ProductFieldErrors } from '../../../services/product-position'
import { ProductAssistField } from './ProductAssistField'

/**
 * 资料录入：左轨步骤 + 右栏表单（对齐 Demo 布局）。
 * 字段壳 + AI 优化对齐人设问卷；生成入口在 Page top-chrome。
 */

const QUESTIONS: Array<{ key: keyof ProductAnswers; title: string; hint: string }> = [
  {
    key: 'usage',
    title: '怎么用？客户最终得到什么？',
    hint: '简述使用或服务过程；计划中的可注明。',
  },
  {
    key: 'current',
    title: '客户现在怎么解决？最不满什么？',
    hint: '其他产品、工具、人工、外包或自行解决均可。',
  },
  {
    key: 'purchase',
    title: '购买前常犹豫什么？有无退款/停用反馈？',
    hint: '尽量写真实问题或原话；暂无填「暂无」。',
  },
  {
    key: 'delivery',
    title: '交付到什么算完成？使用前需什么条件？',
    hint: '交付标准、客户需准备或配合的事项。',
  },
]

const ATTACHMENT_ACCEPT = '.txt,.md,.markdown,.docx'
const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024

function toUploaderItem(file: ProductAttachment): AttachmentUploaderItem {
  return {
    id: file.id,
    name: file.fileName,
    size: file.size,
    status: file.status === 'parsed' ? 'ready' : file.status === 'uploading' ? 'uploading' : 'error',
    error: file.error,
  }
}

export function ProductInputForm({
  product,
  errors,
  disabled,
  onChange,
  onAddFiles,
  onRemoveAttachment,
}: {
  product: ProductRecord
  errors: ProductFieldErrors
  disabled?: boolean
  onChange: (patch: Partial<ProductRecord>) => void
  onAddFiles: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
}) {
  const attachRef = useRef<HTMLDetailsElement>(null)
  const answersRef = useRef<HTMLDetailsElement>(null)

  const attachmentItems = product.attachments.map(toUploaderItem)
  const attachCount = product.attachments.length
  const filledAnswers = QUESTIONS.filter((q) => product.answers[q.key].trim()).length
  const basicsOk = !hasFieldErrors(validateProductBasics(product))
  const attachmentsOk = attachCount > 0
  const answersOk = filledAnswers > 0

  function scrollToSection(id: 'basic' | 'attachments' | 'answers') {
    if (id === 'attachments' && attachRef.current) attachRef.current.open = true
    if (id === 'answers' && answersRef.current) answersRef.current.open = true
    const el = document.getElementById(
      id === 'basic' ? 'pp-sec-basic' : id === 'attachments' ? 'pp-sec-attachments' : 'pp-sec-answers',
    )
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function updateSpec(id: string, patch: { name?: string; price?: string }) {
    onChange({ specs: product.specs.map((spec) => (spec.id === id ? { ...spec, ...patch } : spec)) })
  }

  function addSpec() {
    onChange({ specs: [...product.specs, { id: `spec-${newProductId()}`, name: '', price: '' }] })
  }

  function removeSpec(id: string) {
    const next = product.specs.filter((spec) => spec.id !== id)
    onChange({ specs: next.length > 0 ? next : [{ id: `spec-${newProductId()}`, name: '', price: '' }] })
  }

  return (
    <div className="pp-layout">
      <nav className="pp-rail" aria-label="资料填写步骤">
        <button
          type="button"
          className={`pp-rail__item${basicsOk ? ' is-ok' : ''}`}
          onClick={() => scrollToSection('basic')}
        >
          <span className="pp-rail__dot" aria-hidden="true">
            {basicsOk ? <Check size={11} strokeWidth={2.5} /> : null}
          </span>
          基本信息
        </button>
        <button
          type="button"
          className={`pp-rail__item${attachmentsOk ? ' is-ok' : ''}`}
          onClick={() => scrollToSection('attachments')}
        >
          <span className="pp-rail__dot" aria-hidden="true">
            {attachmentsOk ? <Check size={11} strokeWidth={2.5} /> : null}
          </span>
          产品资料
        </button>
        <button
          type="button"
          className={`pp-rail__item${answersOk ? ' is-ok' : ''}`}
          onClick={() => scrollToSection('answers')}
        >
          <span className="pp-rail__dot" aria-hidden="true">
            {answersOk ? <Check size={11} strokeWidth={2.5} /> : null}
          </span>
          补充说明
        </button>
        <p className="pp-rail__tip">
          {basicsOk ? '基本信息已齐，可以生成。' : '填完基本信息后即可生成。'}
        </p>
      </nav>

      <GlassPanel className="pp-form" glow={false}>
        <section className="pp-form__section" id="pp-sec-basic" aria-labelledby="pp-basic-title">
          <header className="pp-form__section-head">
            <h3 className="pp-form__title" id="pp-basic-title">
              产品基本信息
            </h3>
          </header>

          <label className="pp-field">
            <span className="pp-field__label">
              产品名称 <em aria-hidden="true">*</em>
            </span>
            <ProductAssistField
              field="name"
              fieldLabel="产品名称"
              value={product.name}
              product={product}
              placeholder="请输入产品名称"
              disabled={disabled}
              invalid={Boolean(errors.name)}
              onChange={(name) => onChange({ name })}
            />
            {errors.name ? <span className="pp-field__error">{errors.name}</span> : null}
          </label>

          <div className="pp-field">
            <span className="pp-field__label">
              产品类型 <em aria-hidden="true">*</em>
            </span>
            <ProductAssistField
              field="type"
              fieldLabel="产品类型"
              value={product.type}
              product={product}
              placeholder="请选择或填写产品类型"
              disabled={disabled}
              invalid={Boolean(errors.type)}
              presets={PRODUCT_TYPE_PRESETS}
              onChange={(type) => onChange({ type })}
            />
            <div className="pp-chips" role="group" aria-label="常用产品类型">
              {PRODUCT_TYPE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`pp-chip${product.type === preset ? ' is-active' : ''}`}
                  disabled={disabled}
                  onClick={() => onChange({ type: preset })}
                >
                  {preset}
                </button>
              ))}
            </div>
            {errors.type ? <span className="pp-field__error">{errors.type}</span> : null}
          </div>

          <div className="pp-field">
            <span className="pp-field__label">
              规格 / 价格 <em aria-hidden="true">*</em>
            </span>
            <div className="pp-specs">
              {product.specs.map((spec, index) => (
                <div className="pp-spec-card" key={spec.id}>
                  <span className="pp-spec-card__index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="pp-spec-card__fields">
                    <ProductAssistField
                      field="specName"
                      fieldLabel="规格 / 版本 / 套餐"
                      value={spec.name}
                      product={product}
                      placeholder="如：基础版 / 21 天"
                      disabled={disabled}
                      onChange={(name) => updateSpec(spec.id, { name })}
                    />
                    <ProductAssistField
                      field="specPrice"
                      fieldLabel="价格与收费方式"
                      value={spec.price}
                      product={product}
                      placeholder="如：2980 元 / 期，或「按需报价」"
                      disabled={disabled}
                      onChange={(price) => updateSpec(spec.id, { price })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="pp-spec-card__remove"
                    aria-label={`移除规格 ${index + 1}`}
                    disabled={disabled}
                    onClick={() => removeSpec(spec.id)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="pp-specs__footer">
              <Button type="button" variant="toolbar" size="sm" disabled={disabled} onClick={addSpec}>
                <Plus aria-hidden="true" />
                添加规格／套餐
              </Button>
              <span className="pp-hint">空价格≠0 元；按需报价直接写「按需报价」。</span>
            </div>
            {errors.specs ? <span className="pp-field__error">{errors.specs}</span> : null}
          </div>
        </section>

        <details className="pp-disclose" id="pp-sec-attachments" ref={attachRef}>
          <summary className="pp-disclose__summary">
            <span className="pp-disclose__label">
              <span>可选：上传产品资料</span>
              {attachCount > 0 ? (
                <span className="pp-disclose__meta">{attachCount} 个文件</span>
              ) : (
                <span className="pp-disclose__meta">介绍册 / 说明 / 反馈</span>
              )}
            </span>
            <ChevronDown className="pp-disclose__chevron" aria-hidden="true" />
          </summary>
          <div className="pp-disclose__body">
            <p className="pp-hint">
              已在附件中说明的内容，下面补充题可以留空。支持 TXT / Markdown / Word(.docx)，单个不超过 4MB。
            </p>
            <AttachmentUploader
              kind="doc"
              layout="list"
              accept={ATTACHMENT_ACCEPT}
              multiple
              maxCount={4}
              maxBytes={ATTACHMENT_MAX_BYTES}
              items={attachmentItems}
              onAdd={onAddFiles}
              onRemove={onRemoveAttachment}
              addLabel="添加产品资料"
              emptyTitle="拖入文件，或选择产品资料"
              emptyDescription="支持 TXT / Markdown / Word(.docx)，单个不超过 4MB"
              onReject={(files) =>
                onChange({
                  attachments: [
                    ...product.attachments,
                    ...files.map((file) => ({
                      id: `att-${newProductId()}`,
                      fileName: file.name,
                      size: file.size,
                      kind: 'other' as const,
                      status: 'unsupported' as const,
                      error: '仅支持 TXT、Markdown 或 Word(.docx)，单个不超过 4MB',
                    })),
                  ],
                })
              }
            />
          </div>
        </details>

        <details className="pp-disclose" id="pp-sec-answers" ref={answersRef}>
          <summary className="pp-disclose__summary">
            <span className="pp-disclose__label">
              <span>可选：补充说明（可留空）</span>
              {filledAnswers > 0 ? (
                <span className="pp-disclose__meta">
                  已填 {filledAnswers}/{QUESTIONS.length}
                </span>
              ) : (
                <span className="pp-disclose__meta">人设或附件已说明的不必重复</span>
              )}
            </span>
            <ChevronDown className="pp-disclose__chevron" aria-hidden="true" />
          </summary>
          <div className="pp-disclose__body">
            {QUESTIONS.map((question) => (
              <label className="pp-field" key={question.key}>
                <span className="pp-field__label">{question.title}</span>
                <span className="pp-field__hint">{question.hint}</span>
                <ProductAssistField
                  field={question.key}
                  fieldLabel={question.title}
                  value={product.answers[question.key]}
                  product={product}
                  multiline
                  rows={3}
                  placeholder="可留空"
                  disabled={disabled}
                  onChange={(next) =>
                    onChange({ answers: { ...product.answers, [question.key]: next } })
                  }
                />
              </label>
            ))}
          </div>
        </details>
      </GlassPanel>
    </div>
  )
}
