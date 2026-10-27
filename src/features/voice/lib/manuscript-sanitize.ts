/**
 * 口播/TTS 前清理 Markdown 等会被误读或干扰拆段的符号，保留正文可读内容。
 */
export function sanitizeManuscriptForVoice(text: string): string {
  let s = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')

  // ATX 标题：## 引言 → 引言
  s = s.replace(/^[\t ]*#{1,6}[\t ]+/gm, '')
  // 引用块
  s = s.replace(/^[\t ]*>\s?/gm, '')
  // 无序列表
  s = s.replace(/^[\t ]*[-*+][\t ]+/gm, '')
  // 有序列表
  s = s.replace(/^[\t ]*\d+[.)）][\t ]+/gm, '')
  // 分隔线
  s = s.replace(/^[\t ]*[-*_]{3,}[\t ]*$/gm, '')

  // 行内：链接、图片、强调、行内代码
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  s = s.replace(/`([^`]+)`/g, '$1')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/\*([^*\n]+)\*/g, '$1')
  s = s.replace(/_([^_\n]+)_/g, '$1')

  // 残留孤立 #（非数字话题标签场景较少，去掉行首单独 #）
  s = s.replace(/^#+/gm, '')

  return s.trimEnd()
}

/** 是否有可清理的格式符号（用于导入后提示或菜单态） */
export function manuscriptNeedsSanitize(text: string): boolean {
  return sanitizeManuscriptForVoice(text) !== text
}
