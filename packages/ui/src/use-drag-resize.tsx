import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/** 侧栏拖拽调宽（板块 J）：拖动时直写 DOM 宽度，避免整树 React 重渲染卡顿；
 *  松手后再 setState + localStorage。direction：
 *  'left' = 面板在左、把手在右缘；'right' = 面板在右、把手在左缘。
 *  把手视觉（.resize-handle）由宿主应用的全局样式提供，本包不绑定主题。 */
export function useDragResize(
  storageKey: string,
  defaultWidth: number,
  minRatio: number,
  maxRatio: number,
  direction: 'left' | 'right',
  minPx = 0,
  snap?: (px: number) => number,
  onWidthChange?: (px: number) => void,
) {
  const clamp = useCallback(
    (px: number) => {
      const min = Math.max(minPx, Math.round(window.innerWidth * minRatio));
      const max = Math.round(window.innerWidth * maxRatio);
      return Math.min(max, Math.max(min, px));
    },
    [minRatio, maxRatio, minPx],
  );

  const settle = useCallback(
    (px: number) => clamp(snap ? snap(px) : px),
    [clamp, snap],
  );

  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(saved) && saved > 0) return settle(saved);
    } catch {
      /* ignore */
    }
    return settle(defaultWidth);
  });
  const widthRef = useRef(width);
  widthRef.current = width;

  const panelRef = useRef<HTMLElement | null>(null);
  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, width: 0 });

  const syncPanelWidth = useCallback((px: number) => {
    widthRef.current = px;
    const el = panelRef.current;
    if (el) {
      // data-resize-css-var：宿主用 CSS 变量驱动宽度（如首页轨动画），拖动时直写变量而不钉死 style.width
      const cssVar = el.dataset.resizeCssVar;
      if (cssVar) {
        el.style.setProperty(cssVar, `${px}px`);
        el.style.removeProperty('width');
      } else {
        el.style.width = `${px}px`;
      }
    }
    onWidthChangeRef.current?.(px);
  }, []);

  // 非拖动态：state / 窗口缩放后与 DOM 对齐
  useLayoutEffect(() => {
    if (dragging) return;
    syncPanelWidth(width);
  }, [width, dragging, syncPanelWidth]);

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent) => {
      event.preventDefault();
      startRef.current = { x: event.clientX, width: widthRef.current };
      setDragging(true);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      const delta =
        direction === 'left' ? event.clientX - startRef.current.x : startRef.current.x - event.clientX;
      syncPanelWidth(clamp(startRef.current.width + delta));
    };
    const onUp = () => {
      setDragging(false);
      const final = settle(widthRef.current);
      widthRef.current = final;
      setWidth(final);
      try {
        localStorage.setItem(storageKey, String(final));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.classList.add('col-resizing');
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('col-resizing');
    };
  }, [dragging, clamp, direction, storageKey, syncPanelWidth, settle]);

  useEffect(() => {
    const onWindowResize = () => {
      const next = settle(widthRef.current);
      setWidth(next);
    };
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [clamp, settle]);

  const setWidthExplicit = useCallback(
    (px: number) => {
      const next = settle(px);
      widthRef.current = next;
      setWidth(next);
      syncPanelWidth(next);
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        /* ignore */
      }
    },
    [settle, storageKey, syncPanelWidth],
  );

  const setPanelRef = useCallback((node: HTMLElement | null) => {
    panelRef.current = node;
    if (!node) return;
    const cssVar = node.dataset.resizeCssVar;
    if (cssVar) {
      node.style.setProperty(cssVar, `${widthRef.current}px`);
      node.style.removeProperty('width');
    } else {
      node.style.width = `${widthRef.current}px`;
    }
    onWidthChangeRef.current?.(widthRef.current);
  }, []);

  return { width, dragging, onHandlePointerDown, panelRef: setPanelRef, setWidth: setWidthExplicit };
}

export interface ResizeHandleProps {
  edge: 'left' | 'right';
  onPointerDown: (event: ReactPointerEvent) => void;
}

/** 拖拽把手：透明热区，hover/拖动时不显色条（避免干扰）。 */
export function ResizeHandle({ edge, onPointerDown }: ResizeHandleProps) {
  return (
    <div
      className={`resize-handle resize-handle--${edge}`}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
    />
  );
}
