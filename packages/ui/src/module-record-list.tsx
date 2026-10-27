import './module-record-list.css';
import * as React from 'react';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from 'lucide-react';
import { cn } from './utils';
import { Button } from './button';
import { StatusBadge, type StatusBadgeTone } from './StatusBadge';

export type ModuleRecordBadgeTone = StatusBadgeTone;

export interface ModuleRecordBadge {
  label: string;
  tone?: ModuleRecordBadgeTone;
}

export interface ModuleRecordListItem {
  id: string;
  title: string;
  thumbnail?: React.ReactNode;
  thumbnailSrc?: string;
  thumbnailAlt?: string;
  badges?: ModuleRecordBadge[];
  metaParts?: string[];
  metaHighlight?: string;
  footnote?: string;
}

export interface ModuleRecordListLabels {
  sectionTitle?: string;
  open?: string;
  delete?: string;
  pagePrev?: string;
  pageNext?: string;
}

const DEFAULT_LABELS: Required<ModuleRecordListLabels> = {
  sectionTitle: '最近记录',
  open: '继续处理',
  delete: '删除',
  pagePrev: '上一页',
  pageNext: '下一页',
};

function resolveLabels(labels?: ModuleRecordListLabels): Required<ModuleRecordListLabels> {
  return { ...DEFAULT_LABELS, ...labels };
}

function RecordThumbnail({ item }: { item: ModuleRecordListItem }) {
  if (item.thumbnail) return <div className="module-record-list__thumb">{item.thumbnail}</div>;
  if (item.thumbnailSrc) {
    return (
      <div className="module-record-list__thumb">
        <img src={item.thumbnailSrc} alt={item.thumbnailAlt ?? item.title} />
      </div>
    );
  }
  return null;
}

/** 模块任务/文章列表：横向卡片 + 分页，无外层大边框容器。 */
export function ModuleRecordList({
  items,
  pageSize = 8,
  labels,
  onOpen,
  onDelete,
  className,
  getOpenAgentId,
}: {
  items: ModuleRecordListItem[];
  pageSize?: number;
  labels?: ModuleRecordListLabels;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
  getOpenAgentId?: (item: ModuleRecordListItem) => string | undefined;
}) {
  const L = resolveLabels(labels);
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / Math.max(pageSize, 1)));

  React.useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [items.length, totalPages]);

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showPager = items.length > pageSize;

  return (
    <section className={cn('module-record-list', className)}>
      {L.sectionTitle ? <h3 className="module-record-list__section-title">{L.sectionTitle}</h3> : null}

      <div className="module-record-list__rows">
        {pageItems.map((item) => (
          <article key={item.id} className="module-record-list__row">
            <RecordThumbnail item={item} />

            <div className="module-record-list__content">
              <h4 className="module-record-list__title">{item.title}</h4>
              {(item.badges?.length || item.metaParts?.length || item.metaHighlight) && (
                <div className="module-record-list__meta">
                  {item.badges?.length ? (
                    <span className="module-record-list__badges">
                      {item.badges.map((badge) => (
                        <StatusBadge key={`${item.id}-${badge.label}`} tone={badge.tone ?? 'neutral'} label={badge.label} />
                      ))}
                    </span>
                  ) : null}
                  {item.metaParts?.map((part, index) => (
                    <React.Fragment key={`${item.id}-meta-${index}`}>
                      {index > 0 || item.badges?.length ? (
                        <span className="module-record-list__meta-sep" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      <span>{part}</span>
                    </React.Fragment>
                  ))}
                  {item.metaHighlight ? (
                    <>
                      {(item.badges?.length || item.metaParts?.length) ? (
                        <span className="module-record-list__meta-sep" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      <span className="module-record-list__meta-highlight">{item.metaHighlight}</span>
                    </>
                  ) : null}
                </div>
              )}
              {item.footnote ? <span className="module-record-list__footnote">{item.footnote}</span> : null}
            </div>

            <div className="module-record-list__actions">
              {onDelete ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={L.delete}
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => onOpen(item.id)}
                data-agent-id={getOpenAgentId?.(item)}
              >
                <span>{L.open}</span>
                <ArrowRightIcon className="size-3.5" />
              </Button>
            </div>
          </article>
        ))}
      </div>

      {showPager ? (
        <div className="module-record-list__pager">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="module-record-list__pager-btn"
            disabled={safePage <= 1}
            aria-label={L.pagePrev}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <span className="module-record-list__pager-counter" aria-live="polite">
            {safePage} / {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="module-record-list__pager-btn"
            disabled={safePage >= totalPages}
            aria-label={L.pageNext}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}
