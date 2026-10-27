import { useRef, useState } from 'react'
import { Paperclip, Plus, Sparkles, Trash2, UserRound } from 'lucide-react'
import { Button } from '@no996/ui/button'
import type { ProductAnswers, ProductAttachment, ProductRecord } from '../../../services/product-position/types'
import { PRODUCT_TYPE_PRESETS, newProductId } from '../../../services/product-position/types'
import type { ProductFieldErrors } from '../../../services/product-position'

/**
 * 资料录入：基本信息 / 规格价格 / 附件 / 四个补充问题。
 * 只做受控展示与校验提示，保存、解析、生成都在页面层。
 */

const QUESTIONS: Array<{ key: keyof ProductAnswers; title: string; hint: string }> = [
  {
    key: 'usage',
    title: '这个产品具体怎么使用，客户最终会获得什么？',
    hint: '简单描述使用或服务过程；计划中的内容请注明。',
  },
  {
    key: 'current',
    title: '客户现在怎样解决这个问题，最不满意的地方是什么？',
    hint: '可以是其他产品、工具、人工、外包或自行解决。',
  },
  {
    key: 'purchase',
    title: '客户购买前通常会犹豫什么？有没有没买、退款或停用的反馈？',
    hint: '尽量填写真实问题或客户原话；暂无反馈可填写「暂无」。',
  },
  {
    key: 'delivery',
    title: '产品交付到什么程度算完成？客户使用前需要满足什么条件？',
    hint: '可说明交付标准、客户需要准备或配合的事项。',
  },
]

const ATTACHMENT_STATUS_TEXT: Record<ProductAttachment['status'], string> = {
  uploading: '上传中',
  parsed: '可读取',
  unsupported: '不支持解析',
  failed: '解析失败',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ProductInputForm({
  product,
  personaName,
  errors,
  generating,
  isMock,
  onChange,
  onAddFiles,
  onRemoveAttachment,
  onOpenPersona,
  onSaveDraft,
  onGenerate,
}: {
  product: ProductRecord
  personaName?: string
  errors: ProductFieldErrors
  generating: boolean
  isMock: boolean
  onChange: (patch: Partial<ProductRecord>) => void
  onAddFiles: (files: File[]) => void
  onRemoveAttachment: (id: string) => void
  onOpenPersona: () => void
  onSaveDraft: () => void
  onGenerate: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  const canGenerate = !generating && product.name.trim().length > 0

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

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    onAddFiles(Array.from(files))
  }

  return (
    <div className="pp-form">
      <section className="pp-form__section pp-persona-strip">
        <div className="pp-persona-strip__icon" aria-hidden="true">
          <UserRound />
        </div>
        <div className="pp-persona-strip__text">
          <p className="pp-persona-strip__title">
            {personaName ? `已关联人设档案：${personaName}` : '未关联人设档案'}
          </p>
          <p className="pp-persona-strip__hint">
            {personaName
              ? '分析时会结合档案中的客户线索、团队经历、方法和已有案例。'
              : '产品资料足够时也可以直接分析；关联人设后能自动复用客户与方法信息。'}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenPersona}>
          查看
        </Button>
      </section>

      <section className="pp-form__section" aria-labelledby="pp-basic-title">
        <h3 className="pp-form__title" id="pp-basic-title">
          一、产品基本信息
        </h3>

        <label className="pp-field">
          <span className="pp-field__label">
            产品名称 <em aria-hidden="true">*</em>
          </span>
          <input
            className="pp-input"
            value={product.name}
            aria-invalid={Boolean(errors.name)}
            placeholder="请输入产品名称"
            onChange={(event) => onChange({ name: event.target.value })}
          />
          {errors.name ? <span className="pp-field__error">{errors.name}</span> : null}
        </label>

        <div className="pp-field">
          <span className="pp-field__label">
            产品类型 <em aria-hidden="true">*</em>
          </span>
          <input
            className="pp-input"
            value={product.type}
            aria-invalid={Boolean(errors.type)}
            placeholder="请选择或填写产品类型"
            onChange={(event) => onChange({ type: event.target.value })}
          />
          <div className="pp-chips">
            {PRODUCT_TYPE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`pp-chip${product.type === preset ? ' is-active' : ''}`}
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
            <div className="pp-specs__head" aria-hidden="true">
              <span>规格 / 版本 / 套餐</span>
              <span>价格与收费方式</span>
              <span />
            </div>
            {product.specs.map((spec) => (
              <div className="pp-specs__row" key={spec.id}>
                <input
                  className="pp-input"
                  value={spec.name}
                  placeholder="如：基础版 / 21 天"
                  aria-label="规格名称"
                  onChange={(event) => updateSpec(spec.id, { name: event.target.value })}
                />
                <input
                  className="pp-input"
                  value={spec.price}
                  placeholder="如：2980 元 / 期，支持分期"
                  aria-label="价格与收费方式"
                  onChange={(event) => updateSpec(spec.id, { price: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="移除这一行"
                  onClick={() => removeSpec(spec.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
          <div className="pp-specs__footer">
            <Button type="button" variant="ghost" size="sm" onClick={addSpec}>
              <Plus aria-hidden="true" />
              添加规格／套餐
            </Button>
            <span className="pp-hint">不填价格不等于 0 元；按需报价请直接写「按需报价」。</span>
          </div>
          {errors.specs ? <span className="pp-field__error">{errors.specs}</span> : null}
        </div>
      </section>

      <section className="pp-form__section" aria-labelledby="pp-attach-title">
        <h3 className="pp-form__title" id="pp-attach-title">
          二、产品附件
        </h3>
        <p className="pp-hint">
          可上传产品介绍册、产品说明、交付样例、客户反馈等资料。已在附件中说明的内容，下面可以留空。
        </p>

        <div
          className={`pp-drop${dragging ? ' is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            handleFiles(event.dataTransfer.files)
          }}
        >
          <Paperclip aria-hidden="true" />
          <p>拖入文件，或</p>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            选择文件
          </Button>
          <span className="pp-drop__hint">支持 TXT / Markdown / Word(.docx)，单个不超过 4MB</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.docx"
            hidden
            onChange={(event) => {
              handleFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </div>

        {product.attachments.length > 0 ? (
          <ul className="pp-files">
            {product.attachments.map((file) => (
              <li className={`pp-files__row pp-files__row--${file.status}`} key={file.id}>
                <span className="pp-files__name">{file.fileName}</span>
                <span className="pp-files__size">{formatSize(file.size)}</span>
                <span className="pp-files__status">{ATTACHMENT_STATUS_TEXT[file.status]}</span>
                {file.error ? <span className="pp-files__error">{file.error}</span> : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`移除 ${file.fileName}`}
                  onClick={() => onRemoveAttachment(file.id)}
                >
                  移除
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="pp-form__section" aria-labelledby="pp-question-title">
        <h3 className="pp-form__title" id="pp-question-title">
          三、补充产品信息
        </h3>
        <p className="pp-hint">只需补充人设档案和附件中没有说清楚的部分。</p>
        {QUESTIONS.map((question, index) => (
          <label className="pp-field" key={question.key}>
            <span className="pp-field__label">
              {index + 1}. {question.title}
            </span>
            <span className="pp-field__hint">{question.hint}</span>
            <textarea
              className="pp-textarea"
              rows={3}
              value={product.answers[question.key]}
              placeholder="留空也可以：附件或人设档案里已经说明的部分不必重复填写"
              onChange={(event) =>
                onChange({ answers: { ...product.answers, [question.key]: event.target.value } })
              }
            />
          </label>
        ))}
      </section>

      <footer className="pp-form__footer">
        <div className="pp-form__footer-note">
          {isMock ? <span className="pp-badge pp-badge--demo">演示模式</span> : null}
          <span>资料保存在本机浏览器，不随账号同步。</span>
        </div>
        <div className="pp-form__footer-actions">
          <Button type="button" variant="toolbar" size="sm" onClick={onSaveDraft} disabled={generating}>
            保存草稿
          </Button>
          <Button
            type="button"
            variant="generate"
            size="action"
            onClick={onGenerate}
            disabled={!canGenerate || generating}
            aria-busy={generating}
          >
            <Sparkles aria-hidden="true" />
            {generating ? '正在生成…' : '生成产品定位与优势分析'}
          </Button>
        </div>
      </footer>
    </div>
  )
}
