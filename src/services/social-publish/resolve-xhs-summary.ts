const DEFAULT_MAX = 120

/** 小红书长文发布摘要：优先 brief，否则从正文截取纯文本。 */
export function resolveXhsPublishSummary(
  briefSummary: string | undefined,
  contentMarkdown: string,
  title: string,
  maxLen = DEFAULT_MAX,
): string {
  const fromBrief = briefSummary?.trim()
  if (fromBrief) return fromBrief.slice(0, maxLen)
  const plain = contentMarkdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain) return plain.slice(0, maxLen)
  return title.trim().slice(0, maxLen)
}
