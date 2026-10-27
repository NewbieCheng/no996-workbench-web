/** 将上游 API / Agent 英文错误句转为更短的中文操作提示（Toast 用） */
export function normalizeOperationErrorMessage(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  const modelUnavailable =
    /^model\s+["']([^"']+)["']\s+does not exist or is not available\.?$/i.exec(trimmed)
  if (modelUnavailable) {
    const code = modelUnavailable[1]
    return `当前模型「${code}」不可用，请检查管理端文本对话链与模型是否上架、Key 池是否有容量`
  }

  if (/^request failed with status code \d+$/i.test(trimmed)) {
    return '请求失败，请稍后重试或检查网络与登录状态'
  }

  return trimmed
}
