const AGE_PATTERN = /(\d{1,2})\s*[–—-]\s*(\d{1,2})\s*岁|(\d{1,2})\s*岁\s*\+|(\d{1,2})\s*岁以上/;

/** 从标题或正文首行提取年龄段标签。 */
export function extractAgeBadge(title: string, content: string): string | null {
  for (const source of [title, content.split('\n')[0] ?? '']) {
    const match = source.match(AGE_PATTERN);
    if (!match) continue;
    if (match[1] && match[2]) return `${match[1]}–${match[2]}岁`;
    if (match[3]) return `${match[3]}岁+`;
    if (match[4]) return `${match[4]}岁以上`;
  }
  return null;
}

export function hasArrowChain(content: string): boolean {
  return content.includes('→');
}

export function splitArrowChain(content: string): string[] {
  return content
    .split(/\s*→\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function sectionNavLabel(title: string): string {
  return title.replace(/^\d+\.\s*/, '').trim();
}
