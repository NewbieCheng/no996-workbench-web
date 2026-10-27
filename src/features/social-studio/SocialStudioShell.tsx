import { useCallback, useState, type ReactNode } from 'react'
import { Button } from '@no996/ui/button'
import { GlassPanel } from '@no996/ui'
import { PanelRightCloseIcon } from 'lucide-react'
import { ResizableDivider } from './ResizableDivider'
import i18n from '@/i18n'

type SocialStudioShellProps = {
  variant?: 'split' | 'merged'
  prepCollapsed?: boolean
  onPrepCollapsedChange?: (collapsed: boolean) => void
  prepCollapseLabel?: string
  /** merged：单一舞台列 */
  stageHead?: ReactNode
  stage?: ReactNode
  stageFooter?: ReactNode
  /** split：预览 + 编辑（原型/回退） */
  previewHead?: ReactNode
  preview?: ReactNode
  editorHead?: ReactNode
  editor?: ReactNode
  editorFooter?: ReactNode
  prepHead?: ReactNode
  prepHeadActions?: ReactNode
  prep: ReactNode
}

export function SocialStudioShell({
  variant = 'merged',
  stageHead,
  stage,
  stageFooter,
  previewHead,
  preview,
  editorHead,
  editor,
  editorFooter,
  prepHead,
  prepHeadActions,
  prep,
  prepCollapsed = false,
  onPrepCollapsedChange,
  prepCollapseLabel = '收起输入区',
}: SocialStudioShellProps) {
  const [prepWidth, setPrepWidth] = useState(360)

  const onPrepResize = useCallback((delta: number) => {
    setPrepWidth((w) => Math.min(420, Math.max(280, w + delta)))
  }, [])

  const rootClass =
    variant === 'merged'
      ? `social-studio social-studio--merged${prepCollapsed ? ' social-studio--prep-collapsed' : ''}`
      : 'social-studio'

  const prepHeadRow =
    prepHead || onPrepCollapsedChange ? (
      <div className="social-studio__rail-head social-studio__rail-head--prep">
        {prepHead ? <div className="social-studio__rail-head-title">{prepHead}</div> : <span />}
        {prepHeadActions ? (
          <div className="social-studio__rail-head-actions">{prepHeadActions}</div>
        ) : null}
        {onPrepCollapsedChange && !prepCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="social-studio__prep-collapse"
            aria-label={prepCollapseLabel}
            onClick={() => onPrepCollapsedChange(true)}
          >
            <PanelRightCloseIcon aria-hidden />
          </Button>
        ) : null}
      </div>
    ) : null

  if (variant === 'merged') {
    return (
      <GlassPanel
        glow={false}
        className={rootClass}
        style={{ ['--social-studio-prep-width' as string]: `${prepWidth}px` }}
      >
        <section className="social-studio__rail social-studio__rail--stage" aria-label={i18n.t("uiCopy:创作舞台", { keySeparator: false })}>
          {stageHead ? <div className="social-studio__rail-head">{stageHead}</div> : null}
          <div className="social-studio__rail-body">
            <div className="social-studio-editor-canvas social-studio-editor-canvas--merged">
              {stage}
            </div>
            {prepCollapsed && stageFooter ? (
              <div className="social-studio-footer-actions social-studio-footer-actions--stage">{stageFooter}</div>
            ) : null}
          </div>
        </section>

        {!prepCollapsed ? <ResizableDivider onResize={onPrepResize} currentSize={prepWidth} /> : null}

        {!prepCollapsed ? (
          <section className="social-studio__rail social-studio__rail--prep" aria-label={i18n.t("uiCopy:准备", { keySeparator: false })}>
            {prepHeadRow}
            <div className="social-studio__rail-body social-studio__rail-body--prep">
              <div className="social-studio-prep-panel">{prep}</div>
              {stageFooter ? <div className="social-studio-footer-actions">{stageFooter}</div> : null}
            </div>
          </section>
        ) : null}
      </GlassPanel>
    )
  }

  return (
    <GlassPanel
      glow={false}
      className={rootClass}
      style={{ ['--social-studio-prep-width' as string]: `${prepWidth}px` }}
    >
      <section className="social-studio__rail social-studio__rail--preview" aria-label={i18n.t("persona:preview.viewMode")}>
        {previewHead ? <div className="social-studio__rail-head">{previewHead}</div> : null}
        <div className="social-studio__rail-body">{preview}</div>
      </section>

      <section className="social-studio__rail social-studio__rail--editor" aria-label={i18n.t("common:edit")}>
        {editorHead ? <div className="social-studio__rail-head">{editorHead}</div> : null}
        <div className="social-studio__rail-body">
          <div className="social-studio-editor-canvas">
            {editor}
            {editorFooter ? <div className="social-studio-footer-actions">{editorFooter}</div> : null}
          </div>
        </div>
      </section>

      <ResizableDivider onResize={onPrepResize} currentSize={prepWidth} />

      <section className="social-studio__rail social-studio__rail--prep" aria-label={i18n.t("uiCopy:准备", { keySeparator: false })}>
        {prepHead ? <div className="social-studio__rail-head">{prepHead}</div> : null}
        <div className="social-studio__rail-body">
          <div className="social-studio-prep-panel">{prep}</div>
        </div>
      </section>
    </GlassPanel>
  )
}
