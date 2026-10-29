/**
 * 将知源插件关键词/链接采集错误映射为工作台可读文案。
 * 避免把「后台页未就绪」误报成「未安装扩展」。
 */
export function mapCaptureErrorMessage(raw: string): string {
  const message = raw.trim()
  if (!message) return '抓取失败，请稍后重试。'

  if (/等待插件响应超时|未安装并启用知源|请确认是否已安装/i.test(message)) {
    return '未检测到知源扩展，请安装并启用「知源 · 工作台版」后刷新本页。'
  }
  if (/升级|过低|outdated|3\.7\./i.test(message) && /扩展|插件|版本/i.test(message)) {
    return message
  }
  if (/未登录|login_required|请先.*登录小红书/i.test(message)) {
    return '请先在小红书网页完成登录后再试。'
  }
  if (/签名|page_sign_unavailable/i.test(message)) {
    return '小红书页面签名不可用，请刷新小红书标签页后重试；若持续失败请升级知源工作台版扩展。'
  }
  if (/已观察响应|可见字段|页面未就绪|后台小红书页尚未就绪|内容脚本尚未就绪|无法连接页面通信/i.test(message)) {
    return '后台小红书页尚未就绪（已自动重试）。请确认已登录小红书，或升级知源工作台版扩展；一般无需手动切换标签。'
  }
  if (/^关键词抓取失败[：:]/.test(message)) {
    return mapCaptureErrorMessage(message.replace(/^关键词抓取失败[：:]\s*/, ''))
  }
  return message
}
