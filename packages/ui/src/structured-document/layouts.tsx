import type { ComponentType } from 'react';
import { Badge } from '@no996/ui/badge';
import { ItemFields } from './ItemFields';
import { SectionShell } from './SectionShell';
import type { SectionLayoutProps, StructuredDocumentLayout } from './types';
import { extractAgeBadge } from './utils';

export function SummaryGridLayout(props: SectionLayoutProps) {
  return (
    <SectionShell {...props} className="sd-section--summary">
      <div className="sd-summary-grid">
        {props.section.items.map((item) => (
          <article key={item.id} className="sd-summary-card sd-glass">
            <ItemFields
              sectionId={props.section.id}
              item={item}
              mode={props.mode}
              onItemChange={props.onItemChange}
            />
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

export function AudienceGridLayout(props: SectionLayoutProps) {
  return (
    <SectionShell {...props} className="sd-section--audience">
      <div className="sd-audience-grid">
        {props.section.items.map((item) => {
          const ageBadge = props.mode === 'read' ? extractAgeBadge(item.title, item.content) : null;
          return (
            <article key={item.id} className="sd-audience-card sd-glass">
              <div className="sd-audience-card__head">
                {props.mode === 'read' && item.title ? (
                  <h4 className="sd-audience-card__title">{item.title}</h4>
                ) : null}
                {ageBadge ? (
                  <Badge variant="secondary" className="sd-age-badge">{ageBadge}</Badge>
                ) : null}
              </div>
              <ItemFields
                sectionId={props.section.id}
                item={item}
                mode={props.mode}
                onItemChange={props.onItemChange}
                hideTitle={props.mode === 'read' && Boolean(item.title)}
              />
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

export function ListStackLayout(
  props: SectionLayoutProps & { showArrowChain?: boolean; pillList?: boolean },
) {
  return (
    <SectionShell {...props} compact={Boolean(props.section.rowGroup)}>
      <div className="sd-list-stack">
        {props.section.items.map((item) => (
          <article key={item.id} className="sd-list-card sd-glass">
            <ItemFields
              sectionId={props.section.id}
              item={item}
              mode={props.mode}
              onItemChange={props.onItemChange}
              showArrowChain={props.showArrowChain}
              pillList={props.pillList}
            />
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

export function ObjectionsGridLayout(props: SectionLayoutProps) {
  return (
    <SectionShell {...props} className="sd-section--objections">
      <div className="sd-objections-grid">
        {props.section.items.map((item) => (
          <article key={item.id} className="sd-objection-card sd-glass">
            <ItemFields
              sectionId={props.section.id}
              item={item}
              mode={props.mode}
              onItemChange={props.onItemChange}
            />
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

export function StrategyHeroLayout(props: SectionLayoutProps) {
  const [first, ...rest] = props.section.items;
  return (
    <SectionShell {...props} className="sd-section--strategy">
      <div className="sd-strategy">
        {first ? (
          <article className="sd-strategy__hero">
            <ItemFields
              sectionId={props.section.id}
              item={first}
              mode={props.mode}
              onItemChange={props.onItemChange}
              heroQuote={props.mode === 'read'}
            />
          </article>
        ) : null}
        {rest.length > 0 ? (
          <div className="sd-list-stack">
            {rest.map((item) => (
              <article key={item.id} className="sd-list-card sd-glass">
                <ItemFields
                  sectionId={props.section.id}
                  item={item}
                  mode={props.mode}
                  onItemChange={props.onItemChange}
                />
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

const SECTION_LAYOUTS: Record<
  StructuredDocumentLayout,
  ComponentType<SectionLayoutProps & { showArrowChain?: boolean; pillList?: boolean }>
> = {
  'summary-grid': SummaryGridLayout,
  'audience-grid': AudienceGridLayout,
  'list-stack': ListStackLayout,
  'pill-stack': (p) => <ListStackLayout {...p} pillList />,
  'chain-stack': (p) => <ListStackLayout {...p} showArrowChain />,
  'objections-grid': ObjectionsGridLayout,
  'strategy-hero': StrategyHeroLayout,
};

export function renderStructuredDocumentSection(props: SectionLayoutProps) {
  const Layout = SECTION_LAYOUTS[props.section.layout] ?? ListStackLayout;
  return <Layout key={props.section.id} {...props} />;
}
