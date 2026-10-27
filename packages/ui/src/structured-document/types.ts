export type StructuredDocumentLayout =
  | 'summary-grid'
  | 'audience-grid'
  | 'list-stack'
  | 'pill-stack'
  | 'chain-stack'
  | 'objections-grid'
  | 'strategy-hero';

export interface StructuredDocumentItem {
  id: string;
  title: string;
  content: string;
}

export interface StructuredDocumentSection {
  id: string;
  title: string;
  subtitle?: string;
  layout: StructuredDocumentLayout;
  rowGroup?: string;
  items: StructuredDocumentItem[];
}

export type StructuredDocumentMode = 'read' | 'edit';

export interface StructuredDocumentItemChangeHandler {
  (sectionId: string, itemId: string, field: 'title' | 'content', value: string): void;
}

export interface StructuredDocumentProps {
  sections: StructuredDocumentSection[];
  mode: StructuredDocumentMode;
  onItemChange?: StructuredDocumentItemChangeHandler;
  exportRoot?: string;
  className?: string;
  showSectionHint?: boolean;
}

export interface SectionLayoutProps {
  section: StructuredDocumentSection;
  sectionIdx: number;
  mode: StructuredDocumentMode;
  onItemChange?: StructuredDocumentItemChangeHandler;
  showSectionHint?: boolean;
}
