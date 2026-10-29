export type ExportDiagnosticAttempt = {
  strategy: string
  result: 'supported' | 'unsupported' | 'failed'
  error?: string
}

export type ExportDiagnosticContext = {
  module: string
  composition: string
  width?: number
  height?: number
  fps?: number
  videoBitrate?: number
  audioBitrate?: number
  hasAudio?: boolean
  stage?: string
  attempts: ExportDiagnosticAttempt[]
}

export class VideoExportDiagnosticError extends Error {
  readonly diagnostic: ExportDiagnosticContext

  constructor(message: string, diagnostic: ExportDiagnosticContext, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'VideoExportDiagnosticError'
    this.diagnostic = diagnostic
  }
}

/** Deliberately excludes stack traces, URLs, paths, project names and media contents. */
export function exportEnvironmentSummary(): { browser: string; platform: string } {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const browser = /Edg\//.test(ua) ? `Edge ${ua.match(/Edg\/([\d.]+)/)?.[1] ?? 'unknown'}`
    : /Chrome\//.test(ua) ? `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? 'unknown'}`
      : /Firefox\//.test(ua) ? `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? 'unknown'}`
        : /Safari\//.test(ua) ? `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? 'unknown'}` : 'unknown'
  return { browser, platform: typeof navigator === 'undefined' ? 'unknown' : navigator.platform || 'unknown' }
}

function safeDiagnosticText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, '[URL redacted]')
    .replace(/[A-Z]:\\[^\s]+/gi, '[path redacted]')
    .replace(/(?:\/[^\s/:]+){2,}/g, '[path redacted]')
    .slice(0, 500)
}

export function formatExportDiagnostic(context: ExportDiagnosticContext, error: unknown): string {
  const environment = exportEnvironmentSummary()
  const reason = safeDiagnosticText(error instanceof Error ? error.message : String(error))
  return [
    '视频导出诊断信息（本机生成；不含工程名称、素材、路径或凭据）',
    `时间：${new Date().toISOString()}`,
    `浏览器：${environment.browser}`,
    `系统平台：${environment.platform}`,
    `模块：${context.module}`,
    `导出方式：${context.composition}`,
    `输出尺寸：${context.width && context.height ? `${context.width}x${context.height}` : '未知'}`,
    `帧率：${context.fps ?? '未知'}`,
    `视频码率：${context.videoBitrate ?? '未知'}`,
    `音频：${context.hasAudio == null ? '未知' : context.hasAudio ? `有，目标码率 ${context.audioBitrate ?? '未知'}` : '无'}`,
    `失败阶段：${context.stage ?? '未知'}`,
    '编码尝试：',
    ...(context.attempts.length ? context.attempts.map((item) => `- ${safeDiagnosticText(item.strategy)}: ${item.result}${item.error ? ` (${safeDiagnosticText(item.error)})` : ''}`) : ['- 无记录']),
    `错误：${reason}`,
  ].join('\n')
}
