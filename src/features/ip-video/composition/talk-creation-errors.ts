/** Map agent/schema jargon to actionable copy for the talking-video UI. */
const INTERNAL_PATTERNS: Array<{ test: RegExp; message: string }> = [
  { test: /包含缺失或未授权字段|必须为纯数据对象|文稿来源无效|导演计划改写了最终文稿/u, message: 'AI 返回格式异常，请重试一次。' },
  { test: /需提供 2–3 个创作方向|方向标题不可重复|方向未通过检查/u, message: '方向整理失败，请换个说法再试「帮我想方向」。' },
  { test: /文稿未通过检查|画面文案未通过检查/u, message: '文稿未通过检查，请改写敏感表述后重试。' },
  { test: /不支持的导演计划版本|内容镜头最多|镜头句序号|无文稿时不得猜测/u, message: '画面安排失败，请重试制作。' },
  { test: /请先输入创作想法或完整文稿|请先输入创作想法/u, message: '请先输入创作想法或完整文稿。' },
]

export function humanizeTalkCreationError(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : String(raw ?? '')
  const trimmed = message.trim()
  if (!trimmed) return '制作失败，请稍后重试。'
  for (const row of INTERNAL_PATTERNS) {
    if (row.test.test(trimmed)) return row.message
  }
  return trimmed
}

export function talkCreationErrorNeedsContent(message: string): boolean {
  return /请先输入创作想法|补充想法|完整文稿/u.test(message)
}
