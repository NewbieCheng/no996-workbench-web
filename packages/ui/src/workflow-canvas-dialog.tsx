import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'
import { WorkflowCanvas, type WorkflowCanvasProps } from './workflow-canvas'

export type WorkflowCanvasDialogProps = WorkflowCanvasProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 弹窗无障碍描述 */
  description?: string
}

export function WorkflowCanvasDialog({
  open,
  onOpenChange,
  title = '生产流程画布',
  description = '按真实执行顺序展示各处理阶段的拓扑关系与产出摘要',
  ...canvasProps
}: WorkflowCanvasDialogProps) {
  const [mountKey, setMountKey] = useState(0)
  useEffect(() => {
    if (open) setMountKey((k) => k + 1)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="awf-dialog-content">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <div className="awf-dialog-body">
          {open ? (
            <WorkflowCanvas
              key={mountKey}
              title={title}
              {...canvasProps}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default WorkflowCanvasDialog
