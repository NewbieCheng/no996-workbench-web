import type { CSSProperties, ReactNode, Ref } from 'react'
import '../stage-shell.css'

export type IpVideoStageShellProps = {
  stageRef?: Ref<HTMLDivElement>
  aspectRatio?: string
  variant?: 'compact' | 'fluid'
  maxHeight?: number
  surroundClassName?: string
  stageClassName?: string
  style?: CSSProperties
  children: ReactNode
  /** 渲染在舞台容器内、画布区域下方（如编排预览 transport） */
  footer?: ReactNode
}

export function IpVideoStageShell({
  stageRef,
  aspectRatio = '9 / 16',
  variant = 'fluid',
  maxHeight,
  surroundClassName = '',
  stageClassName = '',
  style,
  children,
  footer
}: IpVideoStageShellProps) {
  const stageStyle: CSSProperties = {
    ...style,
    ['--ipv-stage-aspect' as string]: aspectRatio,
    ...(maxHeight != null ? { ['--ipv-stage-max-height' as string]: `${maxHeight}px` } : {})
  }
  const stacked = Boolean(footer)
  return (
    <div
      className={`ipv-stage-surround${stacked ? ' ipv-stage-surround--stacked' : ''} ${surroundClassName}`.trim()}
    >
      <div className="ipv-stage-surround__monitor">
        <div
          ref={stageRef}
          className={`ipv-stage ipv-stage--${variant} ${stageClassName}`.trim()}
          style={stageStyle}
        >
          {children}
        </div>
      </div>
      {footer ? <div className="ipv-stage-surround__footer">{footer}</div> : null}
    </div>
  )
}
