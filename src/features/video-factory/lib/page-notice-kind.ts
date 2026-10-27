export type VideoFactoryToastKind = 'success' | 'error' | 'warning' | 'info'

export function resolveVideoFactoryToastKind(message: string): VideoFactoryToastKind | null {
  const text = message.trim()
  if (!text) return null

  if (text.startsWith('正在') || text.endsWith('…') || text.endsWith('...')) return 'info'
  if (
    text.includes('失败') ||
    text.includes('取不到') ||
    text.includes('听不出') ||
    text.includes('均已锁定') ||
    text.startsWith('导入失败')
  ) {
    return 'error'
  }
  if (text.includes('先在时间轴') || text.includes('未找到可导入') || text.includes('演示内容')) {
    return 'warning'
  }
  if (
    text.startsWith('已添加') ||
    text.startsWith('已从') ||
    text.startsWith('已检测') ||
    text.startsWith('已生成') ||
    text.startsWith('已载入') ||
    text.startsWith('已导入素材') ||
    text === '工程已导入'
  ) {
    return 'success'
  }
  return 'info'
}
