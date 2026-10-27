import type { ReactNode } from 'react'
import { ColumnDivider } from '@no996/ui/column-divider'

export type ScriptLabWizardLayoutProps = {
  rail: ReactNode
  children: ReactNode
  /** 收起左侧预览轨后，右侧白卡片占满宽 */
  railCollapsed?: boolean
}

export function ScriptLabWizardLayout({ rail, children, railCollapsed }: ScriptLabWizardLayoutProps) {
  return (
    <div className={`sl-wiz-app${railCollapsed ? ' sl-wiz-app--rail-collapsed' : ''}`}>
      {!railCollapsed ? (
        <>
          {rail}
          <ColumnDivider
            className="sl-wiz-divider"
            previewSelector=".sl-wiz-rail"
            widthVariable="--sl-wiz-rail-width"
            label="调整脚本预览与表单宽度"
          />
        </>
      ) : null}
      <div className="sl-wiz-main">{children}</div>
    </div>
  )
}

export default ScriptLabWizardLayout
