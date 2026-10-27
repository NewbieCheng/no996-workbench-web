import type { StructuredDocumentSection } from './types';

export type StructuredDocumentBlock =
  | { type: 'section'; section: StructuredDocumentSection; sectionIdx: number }
  | { type: 'row-group'; rowGroup: string; sections: Array<{ section: StructuredDocumentSection; sectionIdx: number }> };

/** 将连续相同 rowGroup 的章节合并为宽屏三列行组。 */
export function groupStructuredDocumentSections(sections: StructuredDocumentSection[]): StructuredDocumentBlock[] {
  const visible = sections
    .map((section, sectionIdx) => ({ section, sectionIdx }))
    .filter(({ section }) => section.items && section.items.length > 0);

  const blocks: StructuredDocumentBlock[] = [];
  let index = 0;

  while (index < visible.length) {
    const current = visible[index]!;
    const rowGroup = current.section.rowGroup;

    if (!rowGroup) {
      blocks.push({ type: 'section', section: current.section, sectionIdx: current.sectionIdx });
      index += 1;
      continue;
    }

    const grouped: Array<{ section: StructuredDocumentSection; sectionIdx: number }> = [];
    while (index < visible.length && visible[index]!.section.rowGroup === rowGroup) {
      grouped.push(visible[index]!);
      index += 1;
    }

    blocks.push({ type: 'row-group', rowGroup, sections: grouped });
  }

  return blocks;
}
