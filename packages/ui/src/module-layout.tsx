import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cn } from '@no996/ui/utils';

export interface ContentWidthConfig {
  storageKey: string;
  cssUserVar: string;
  cssContentVar?: string;
  cssColumnVar?: string;
  minWidth: number;
  edgeBudget: number;
  defaultWidth: number | ((columnWidth: number) => number);
}

function applyResolvedContentWidth(root: HTMLDivElement, cfg: ContentWidthConfig, resolved: number): void {
  root.style.setProperty(cfg.cssUserVar, `${resolved}px`);
  if (cfg.cssContentVar) {
    root.style.setProperty(cfg.cssContentVar, `${resolved}px`);
  }
}

function readActiveContentWidth(root: HTMLDivElement, cfg: ContentWidthConfig): number {
  const inner = root.querySelector<HTMLElement>('.no996-module-layout__inner');
  if (inner && inner.offsetWidth > 0) {
    return inner.offsetWidth;
  }
  const inline = root.style.getPropertyValue(cfg.cssUserVar).trim();
  if (inline) {
    const parsed = Number.parseFloat(inline);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return resolveContentWidth(root.offsetWidth, readWidthPreference(cfg.storageKey), cfg);
}

function readWidthPreference(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function resolveContentWidth(
  columnWidth: number,
  preference: number | null,
  config: ContentWidthConfig,
): number {
  const max = Math.max(config.minWidth, columnWidth - config.edgeBudget);
  if (preference !== null) return Math.min(Math.max(preference, config.minWidth), max);
  const base =
    typeof config.defaultWidth === 'function' ? config.defaultWidth(columnWidth) : config.defaultWidth;
  return Math.min(Math.max(base, config.minWidth), max);
}

export interface ContentWidthApi {
  onHandleStart: () => number;
  /** 返回经列宽钳制后的实际内容宽度（用于把手在触顶后继续拖拽时不累加偏移）。 */
  onHandleDrag: (width: number) => number;
  onHandleCommit: (width: number) => void;
  onHandleEnd: () => void;
}

export const ContentWidthContext = createContext<ContentWidthApi | null>(null);

function WidthHandle({
  side,
  className,
  pointerVar,
  style,
  ariaLabel,
  onStart,
  onDrag,
  onCommit,
  onEnd,
}: {
  side: 'left' | 'right';
  className: string;
  pointerVar: string;
  style?: CSSProperties;
  ariaLabel?: string;
  onStart: () => number;
  onDrag: (width: number) => number;
  onCommit: (width: number) => void;
  onEnd: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const base = useRef(0);
  const origin = useRef(0);
  const latest = useRef(0);
  const pointerScale = useRef(1);
  const pendingCommitWidth = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const callbacks = useRef({ onStart, onDrag, onCommit, onEnd });
  callbacks.current = { onStart, onDrag, onCommit, onEnd };

  const outwardWidth = () => {
    // Pointer coordinates are viewport pixels; content widths are unzoomed layout pixels.
    const dx = (latest.current - origin.current) * pointerScale.current;
    const outward = side === 'right' ? dx : -dx;
    return base.current + outward * 2;
  };

  const cancelFrame = () => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const parent = e.currentTarget.parentElement;
    const visualWidth = parent?.getBoundingClientRect().width ?? 0;
    pointerScale.current = parent && visualWidth > 0 ? parent.offsetWidth / visualWidth : 1;
    origin.current = e.clientX;
    latest.current = e.clientX;
    base.current = callbacks.current.onStart();
    pendingCommitWidth.current = null;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const box = e.currentTarget.getBoundingClientRect();
      const scaleY = box.height > 0 ? e.currentTarget.offsetHeight / box.height : 1;
      e.currentTarget.style.setProperty(pointerVar, `${(e.clientY - box.top) * scaleY}px`);
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      latest.current = e.clientX;
      frame.current ??= requestAnimationFrame(() => {
        frame.current = null;
        const requested = outwardWidth();
        const resolved = callbacks.current.onDrag(requested);
        pendingCommitWidth.current = resolved;
        if (Math.round(resolved) !== Math.round(requested)) {
          base.current = resolved;
          origin.current = latest.current;
        }
      });
    },
    [pointerVar],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    cancelFrame();
    latest.current = e.clientX;
    const committed = pendingCommitWidth.current;
    pendingCommitWidth.current = null;
    if (committed !== null) callbacks.current.onCommit(committed);
    setDragging(false);
    callbacks.current.onEnd();
  }, []);

  const onPointerCancel = useCallback(() => {
    cancelFrame();
    pendingCommitWidth.current = null;
    setDragging(false);
    callbacks.current.onEnd();
  }, []);

  return (
    <div
      className={className}
      style={style}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      data-side={side}
      data-width-handle={side}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
    />
  );
}

export function ContentWidthProvider({
  config,
  children,
  className,
  style,
}: {
  config: ContentWidthConfig;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const rootEl = useRef<HTMLDivElement | null>(null);
  const rootObserver = useRef<ResizeObserver | null>(null);
  const dragSessionRef = useRef(0);
  const configRef = useRef(config);
  configRef.current = config;

  const publish = useCallback((root: HTMLDivElement) => {
    if (dragSessionRef.current > 0) return;
    const cfg = configRef.current;
    const column = root.offsetWidth;
    if (cfg.cssColumnVar) {
      root.style.setProperty(cfg.cssColumnVar, `${column}px`);
    }
    const preference = readWidthPreference(cfg.storageKey);
    const resolved = resolveContentWidth(column, preference, cfg);
    applyResolvedContentWidth(root, cfg, resolved);
  }, []);

  const rootResizeRef = useCallback(
    (root: HTMLDivElement | null) => {
      rootObserver.current?.disconnect();
      rootObserver.current = null;
      rootEl.current = root;
      if (root === null) return;
      rootObserver.current = new ResizeObserver(() => publish(root));
      rootObserver.current.observe(root);
      publish(root);
    },
    [publish],
  );

  const onHandleStart = useCallback((): number => {
    dragSessionRef.current += 1;
    const root = rootEl.current;
    const cfg = configRef.current;
    if (root === null) {
      const fallback =
        typeof cfg.defaultWidth === 'function' ? cfg.defaultWidth(1200) : cfg.defaultWidth;
      return fallback;
    }
    return readActiveContentWidth(root, cfg);
  }, []);

  const onHandleDrag = useCallback((width: number): number => {
    const root = rootEl.current;
    const cfg = configRef.current;
    if (root === null) {
      return typeof cfg.defaultWidth === 'function' ? cfg.defaultWidth(1200) : cfg.defaultWidth;
    }
    const resolved = resolveContentWidth(root.offsetWidth, width, cfg);
    applyResolvedContentWidth(root, cfg, resolved);
    return resolved;
  }, []);

  const onHandleCommit = useCallback((width: number): void => {
    const root = rootEl.current;
    const cfg = configRef.current;
    if (root === null) return;
    try {
      localStorage.setItem(
        cfg.storageKey,
        `${resolveContentWidth(root.offsetWidth, width, cfg)}`,
      );
    } catch {
      // ignore
    }
  }, []);

  const onHandleEnd = useCallback((): void => {
    dragSessionRef.current = Math.max(0, dragSessionRef.current - 1);
    const root = rootEl.current;
    if (root !== null) publish(root);
  }, [publish]);

  const api: ContentWidthApi = {
    onHandleStart,
    onHandleDrag,
    onHandleCommit,
    onHandleEnd,
  };

  return (
    <ContentWidthContext.Provider value={api}>
      <div ref={rootResizeRef} className={className} style={style}>
        {children}
      </div>
    </ContentWidthContext.Provider>
  );
}

export function ContentWidthHandles({
  handleClassName = 'module-content-width-handle',
  pointerVar = '--content-width-handle-pointer-y',
  contentCssVar,
  leftAriaLabel,
  rightAriaLabel,
}: {
  handleClassName?: string;
  pointerVar?: string;
  contentCssVar?: string;
  leftAriaLabel?: string;
  rightAriaLabel?: string;
}) {
  const api = useContext(ContentWidthContext);
  if (!api) return null;

  const style: CSSProperties | undefined = contentCssVar
    ? { ['--module-content-width' as string]: `var(${contentCssVar})` }
    : undefined;

  return (['left', 'right'] as const).map((side) => (
    <WidthHandle
      key={side}
      side={side}
      className={handleClassName}
      pointerVar={pointerVar}
      style={style}
      ariaLabel={side === 'left' ? leftAriaLabel : rightAriaLabel}
      onStart={api.onHandleStart}
      onDrag={api.onHandleDrag}
      onCommit={api.onHandleCommit}
      onEnd={api.onHandleEnd}
    />
  ));
}

export interface ModuleLayoutProps {
  moduleId: string;
  layoutPrefix?: string;
  defaultWidth?: number;
  minWidth?: number;
  edgeBudget?: number;
  className?: string;
  widthRootClassName?: string;
  bodyClassName?: string;
  innerClassName?: string;
  enableHandles?: boolean;
  leftHandleLabel?: string;
  rightHandleLabel?: string;
  /** Full-width strip above the content column (e.g. session nav); not affected by width handles. */
  topChrome?: ReactNode;
  topChromeClassName?: string;
  children: ReactNode;
}

export function ModuleLayout({
  moduleId,
  layoutPrefix,
  defaultWidth = 1120,
  minWidth = 640,
  edgeBudget = 0,
  className,
  widthRootClassName,
  bodyClassName,
  innerClassName,
  enableHandles = true,
  leftHandleLabel,
  rightHandleLabel,
  topChrome,
  topChromeClassName,
  children,
}: ModuleLayoutProps) {
  const prefix = layoutPrefix ?? moduleId;
  const cssUserVar = `--${prefix}-user-width`;
  const cssContentVar = `--${prefix}-content-width`;

  const config = useMemo<ContentWidthConfig>(
    () => ({
      storageKey: `no996.${moduleId}.contentWidth`,
      cssUserVar,
      cssContentVar,
      minWidth,
      edgeBudget,
      defaultWidth,
    }),
    [moduleId, cssUserVar, cssContentVar, minWidth, edgeBudget, defaultWidth],
  );

  const rootStyle = useMemo<CSSProperties>(
    () => ({
      [cssContentVar]: `var(${cssUserVar}, ${defaultWidth}px)`,
      ['--module-content-width' as string]: `var(${cssContentVar})`,
    }),
    [cssContentVar, cssUserVar, defaultWidth],
  );

  const bodyStyle = useMemo<CSSProperties>(
    () => ({
      ['--module-content-width' as string]: `var(${cssContentVar})`,
    }),
    [cssContentVar],
  );

  return (
    <div className={cn('no996-module-layout', `${prefix}-layout`, className)}>
      <ContentWidthProvider
        config={config}
        className={cn('no996-module-layout__width-root', `${prefix}-layout__width-root`, widthRootClassName)}
        style={rootStyle}
      >
        {topChrome ? (
          <div
            className={cn(
              'no996-module-layout__top-chrome',
              `${prefix}-layout__top-chrome`,
              topChromeClassName,
            )}
          >
            {topChrome}
          </div>
        ) : null}
        <div
          className={cn('no996-module-layout__body', `${prefix}-layout__body`, bodyClassName)}
          style={bodyStyle}
        >
          {enableHandles && (
            <ContentWidthHandles
              contentCssVar={cssContentVar}
              leftAriaLabel={leftHandleLabel}
              rightAriaLabel={rightHandleLabel}
            />
          )}
          <div className={cn('no996-module-layout__inner', `${prefix}-layout__inner`, innerClassName)}>
            {children}
          </div>
        </div>
      </ContentWidthProvider>
    </div>
  );
}
