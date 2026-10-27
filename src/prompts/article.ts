export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!) }
export type ArticleTemplate = 'clean' | 'editorial' | 'warm'
export const articleTemplates = [{ value: 'clean', label: '简洁留白' }, { value: 'editorial', label: '杂志阅读' }, { value: 'warm', label: '温暖笔记' }] as const
export function articleHtml(title: string, content: string, template: ArticleTemplate) {
  const palette = { clean: ['#051d43', '#ffffff'], editorial: ['#26332b', '#f7f7f2'], warm: ['#9a4314', '#fffaf4'] }[template]
  const paragraphs = content.split(/\n+/).filter(Boolean).map(p => `<p style="font-size:15px;line-height:1.9;margin:0 0 18px;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(p)}</p>`).join('')
  return `<section style="max-width:680px;margin:0 auto;padding:28px;color:#20252d;background:${palette[1]};font-family:system-ui,sans-serif;"><h1 style="font-size:25px;line-height:1.4;margin:0 0 26px;color:${palette[0]};overflow-wrap:anywhere;">${escapeHtml(title)}</h1>${paragraphs}<p style="font-size:12px;color:#626b76;border-top:1px solid #d9dce1;padding-top:16px;">本地演示排版 · 正式发布前请核实内容与版权</p></section>`
}
