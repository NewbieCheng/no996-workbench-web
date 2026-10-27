import type { MockResponder } from '../../../agent'
import { DEMO_REPORT_MARKDOWN } from './demo-report.ts'

/**
 * 演示应答器：演示模式不调用正式模型，但返回的正文与正式输出同构，
 * 结构校验、解析与页面渲染仍走同一条真实路径（界面必须同时显示「演示」）。
 */
export function createProductMockResponder(): MockResponder {
  return () => DEMO_REPORT_MARKDOWN
}
