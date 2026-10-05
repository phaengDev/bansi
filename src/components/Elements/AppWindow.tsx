import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export type AppWindowLabels = {
  minimize: string;
  maximize: string;
  restore: string;
  close: string;
};

export type AppWindowHandle = {
  /** Bring the window to the front and un-minimize it — e.g. from a taskbar button. */
  restore: () => void;
  /** Minimize the window without closing it — e.g. from a taskbar button. */
  minimize: () => void;
};

type Position = { x: number; y: number };
type Size = { width: number; height: number };

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
} | null;

/** Which border the user grabbed — 'n'/'s'/'e'/'w' are the edges, the pairs are the corners. */
type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// Edges first, corners last: later siblings paint on top, so the corners win where they overlap.
const resizeEdges: readonly ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

type ResizeState = {
  pointerId: number;
  edge: ResizeEdge;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
} | null;

/** Keeps `value` inside [min, max] — `min` wins if the two ever cross (a very small desktop, say). */
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Height of the Life desktop taskbar — windows stay above it when dragged or resized. */
const TASKBAR_HEIGHT = 56;

type AppWindowProps = {
  open: boolean;
  onClose: () => void;
  /** Fires whenever the window is minimized/restored — wire it up only if the page shows a taskbar entry for it. */
  onMinimizedChange?: (minimized: boolean) => void;
  /** Container the window is dragged around inside of. Defaults to the browser viewport. */
  desktopRef?: React.RefObject<HTMLElement | null>;
  ariaLabel: string;
  icon: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /**
   * Starting size in px — each caller can size its own window; it still shrinks to fit smaller
   * screens, and the user can drag any border to resize from there.
   */
  width?: number;
  height?: number;
  /** Floor for the border-drag resize — the window can't be dragged smaller than this. */
  minWidth?: number;
  minHeight?: number;
  /** Open already maximized (fills the desktop) instead of at `width`×`height`. The user can still restore it. */
  defaultMaximized?: boolean;
  labels: AppWindowLabels;
  children: React.ReactNode;
};

/**
 * Stacking order shared by every <AppWindow> on the page: clicking a window (or opening/restoring
 * one) moves it in front of the others, which is what lets two open windows be shuffled front-to-back.
 *
 * The band is deliberately bounded rather than an ever-climbing counter — anything the app layers
 * *above* its windows sits just overhead (on the Life desktop the Start menu is at 20 and the taskbar
 * at 30), so an unbounded counter would eventually push a window over the top of them.
 */
const Z_BASE = 12;
const Z_CEILING = 19;

type StackEntry = { z: number; apply: (z: number) => void };

const windowStack = new Set<StackEntry>();

/** Moves `entry` in front of every other mounted window, renumbering if the band would overflow. */
const raiseToFront = (entry: StackEntry) => {
  const others = [...windowStack].filter((item) => item !== entry);
  const highest = others.reduce((max, item) => Math.max(max, item.z), Z_BASE);
  if (entry.z > highest) return;

  if (highest < Z_CEILING) {
    entry.z = highest + 1;
  } else {
    // Squash everyone back down to the base, keeping the order they are already in.
    others
      .sort((a, b) => a.z - b.z)
      .forEach((item, index) => {
        item.z = Math.min(Z_BASE + index, Z_CEILING - 1);
        item.apply(item.z);
      });
    entry.z = Z_CEILING;
  }
  entry.apply(entry.z);
};

const getInitialPosition = (width: number): Position => {
  if (typeof window === 'undefined') return { x: 260, y: 34 };
  const windowWidth = Math.min(width, window.innerWidth - 32);
  return {
    x: Math.max(16, (window.innerWidth - windowWidth) / 2),
    y: 34,
  };
};

/**
 * Standard reusable "popup" for any page in the app — a draggable, resizable, minimize/maximize/
 * close-able floating window. Imported and used just like rsuite's `<Modal open={…} onClose={…}>`,
 * plus the window-chrome behavior (drag by the titlebar, resize by any border, minimize, maximize)
 * a plain modal doesn't have. Every page that
 * needs a popup imports this one component and configures its own `title`/`icon`/`width`/`height`
 * — the body content is whatever that page passes as `children`.
 *
 * @example
 * const [open, setOpen] = useState(false);
 *
 * <button onClick={() => setOpen(true)}>ຂໍ້ມູນລູກຄ້າ</button>
 *
 * <AppWindow
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   ariaLabel="ຂໍ້ມູນລູກຄ້າ" icon="fa-address-book" title="ຂໍ້ມູນລູກຄ້າ"
 *   width={520} height={420}
 *   labels={{ minimize: '...', maximize: '...', restore: '...', close: '...' }}
 * >
 *   <CustomerQuickLookup />
 * </AppWindow>
 *
 * Need a taskbar entry that reflects minimize state (as the Life desktop does)? Pass `onMinimizedChange`
 * and a `ref` — `ref.current.minimize()` / `.restore()` control it from outside.
 */
const AppWindow = forwardRef<AppWindowHandle, AppWindowProps>(function AppWindow(
  {
    open,
    onClose,
    onMinimizedChange,
    desktopRef,
    ariaLabel,
    icon,
    title,
    subtitle,
    width = 900,
    height = 610,
    minWidth = 620,
    minHeight = 430,
    defaultMaximized = false, // full windown
    labels,
    children,
  },
  ref,
) {
  const windowRef = useRef<HTMLElement>(null);
  const dragStateRef = useRef<DragState>(null);
  const resizeStateRef = useRef<ResizeState>(null);
  const wasOpenRef = useRef(open);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(defaultMaximized);
  const [position, setPosition] = useState<Position>(() => getInitialPosition(width));
  const [zIndex, setZIndex] = useState(Z_BASE);
  const stackEntryRef = useRef<StackEntry>({ z: Z_BASE, apply: setZIndex });
  // null until the user drags a border — then it overrides the `width`/`height` props, and (like the
  // dragged position) sticks for the rest of the session so the window reopens the way they left it.
  const [size, setSize] = useState<Size | null>(null);

  // Join the shared stack for as long as this window is mounted.
  useEffect(() => {
    const entry = stackEntryRef.current;
    windowStack.add(entry);
    return () => { windowStack.delete(entry); };
  }, []);

  /** Lift this window above the other open ones — no-op when it is already the front-most. */
  const bringToFront = () => raiseToFront(stackEntryRef.current);

  // Mirrors how <Modal> starts fresh each time it opens: un-minimize on open, and reset
  // minimize/maximize back to `defaultMaximized` once fully closed so the next open starts fresh again.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setMinimized(false);
      bringToFront();
    }
    if (!open && wasOpenRef.current) {
      setMinimized(false);
      setMaximized(defaultMaximized);
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    onMinimizedChange?.(minimized);
  }, [minimized, onMinimizedChange]);

  useImperativeHandle(ref, () => ({
    restore: () => {
      setMinimized(false);
      bringToFront();
    },
    minimize: () => setMinimized(true),
  }), []);

  const getBounds = () => {
    const rect = desktopRef?.current?.getBoundingClientRect();
    if (rect) return rect;
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (maximized || (event.target as HTMLElement).closest('button')) return;
    const windowRect = windowRef.current?.getBoundingClientRect();
    if (!windowRect) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - windowRect.left,
      offsetY: event.clientY - windowRect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const windowElement = windowRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !windowElement) return;
    const bounds = getBounds();

    const maximumX = Math.max(0, bounds.width - windowElement.offsetWidth);
    const maximumY = Math.max(0, bounds.height - windowElement.offsetHeight - 56);
    const nextX = Math.min(maximumX, Math.max(0, event.clientX - bounds.left - dragState.offsetX));
    const nextY = Math.min(maximumY, Math.max(0, event.clientY - bounds.top - dragState.offsetY));

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLSpanElement>, edge: ResizeEdge) => {
    const windowRect = windowRef.current?.getBoundingClientRect();
    if (!windowRect) return;
    const bounds = getBounds();

    resizeStateRef.current = {
      pointerId: event.pointerId,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: windowRect.width,
      startHeight: windowRect.height,
      startLeft: windowRect.left - bounds.left,
      startTop: windowRect.top - bounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const state = resizeStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const bounds = getBounds();

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    // How far each border can travel before it runs into the desktop edge (or the taskbar).
    const maximumWidth = bounds.width - state.startLeft;
    const maximumHeight = bounds.height - TASKBAR_HEIGHT - state.startTop;
    const rightEdge = state.startLeft + state.startWidth;
    const bottomEdge = state.startTop + state.startHeight;

    let nextWidth = state.startWidth;
    let nextHeight = state.startHeight;
    let nextLeft = state.startLeft;
    let nextTop = state.startTop;

    if (state.edge.includes('e')) nextWidth = clamp(state.startWidth + deltaX, minWidth, maximumWidth);
    if (state.edge.includes('s')) nextHeight = clamp(state.startHeight + deltaY, minHeight, maximumHeight);
    // Dragging the left/top border moves that border while the opposite one stays pinned.
    if (state.edge.includes('w')) {
      nextWidth = clamp(state.startWidth - deltaX, minWidth, rightEdge);
      nextLeft = rightEdge - nextWidth;
    }
    if (state.edge.includes('n')) {
      nextHeight = clamp(state.startHeight - deltaY, minHeight, bottomEdge);
      nextTop = bottomEdge - nextHeight;
    }

    setSize({ width: nextWidth, height: nextHeight });
    setPosition({ x: nextLeft, y: nextTop });
  };

  const handleResizeEnd = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (resizeStateRef.current?.pointerId !== event.pointerId) return;
    resizeStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!open || minimized) return null;

  return (
    <section
      ref={windowRef as React.RefObject<HTMLElement>}
      className={`app-window ${maximized ? 'is-maximized' : ''}`}
      style={{
        '--app-window-width': `${size?.width ?? width}px`,
        '--app-window-height': `${size?.height ?? height}px`,
        '--app-window-min-width': `${minWidth}px`,
        '--app-window-min-height': `${minHeight}px`,
        zIndex,
        ...(maximized ? {} : { left: position.x, top: position.y }),
      } as React.CSSProperties}
      role="dialog"
      aria-label={ariaLabel}
      onClick={(event) => event.stopPropagation()}
      // Click anywhere in the window — titlebar, body, a form field — to raise it above the others.
      onPointerDown={bringToFront}
    >
      <div
        className="app-window-titlebar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={(event) => {
          if (!(event.target as HTMLElement).closest('button')) setMaximized((current) => !current);
        }}
      >
        <span className="app-window-title-icon">
          <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </span>
        <span className="app-window-title">
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </span>
        <span className="app-window-controls">
          <button type="button" onClick={() => setMinimized(true)} aria-label={labels.minimize}>
            <i className="fa-solid fa-minus" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setMaximized((current) => !current)}
            aria-label={maximized ? labels.restore : labels.maximize}
          >
            <i
              className={`fa-regular ${maximized ? 'fa-window-restore' : 'fa-square'}`}
              aria-hidden="true"
            />
          </button>
          <button type="button" className="is-close" onClick={onClose} aria-label={labels.close}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </span>
      </div>

      <div className="app-window-body">{children}</div>

      {/* Invisible grab strips on every border — a maximized window already fills the desktop. */}
      {!maximized && resizeEdges.map((edge) => (
        <span
          key={edge}
          className={`app-window-resize is-${edge}`}
          onPointerDown={(event) => handleResizeStart(event, edge)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
        />
      ))}
    </section>
  );
});

export default AppWindow;
