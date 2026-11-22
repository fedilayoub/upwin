import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  DEFAULT_LAUNCHER_FRACTION,
  LAUNCHER_DRAG_THRESHOLD,
  launcherFractionFromTop,
  launcherTopFromFraction,
} from './position';
import { launcherPositionItem } from './position-storage';

interface DragOrigin {
  pointerId: number;
  startClientY: number;
  startTop: number;
}

export interface LauncherPosition {
  barRef: RefObject<HTMLDivElement | null>;
  dragging: boolean;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  /**
   * True when the gesture that just ended moved far enough to count as a drag.
   * The bar calls this from a capture-phase click handler so releasing a drag
   * over the toggle does not also open the side panel.
   */
  shouldSuppressClick: () => boolean;
  /** `top` in CSS pixels, or null before the bar has been measured. */
  top: number | null;
}

/**
 * Makes the launcher bar draggable along the right edge.
 *
 * Pointer events rather than mouse events, so a trackpad, a touch screen and a
 * pen all work through one path, and `setPointerCapture` — claimed at the
 * moment the press turns into a drag — keeps the drag alive when the pointer
 * leaves the bar, including over page regions the content script has no
 * listeners on.
 */
export function useLauncherPosition(): LauncherPosition {
  const barRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<DragOrigin | null>(null);
  const movedRef = useRef(false);
  // Read inside pointer handlers, which must not be re-created per frame.
  const fractionRef = useRef(DEFAULT_LAUNCHER_FRACTION);
  const draggingRef = useRef(false);

  const [fraction, setFraction] = useState(DEFAULT_LAUNCHER_FRACTION);
  const [barHeight, setBarHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    () => window.innerHeight,
  );
  const [dragging, setDragging] = useState(false);

  const applyFraction = useCallback((next: number) => {
    fractionRef.current = next;
    setFraction(next);
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      setBarHeight(barRef.current?.getBoundingClientRect().height ?? 0);
      setViewportHeight(window.innerHeight);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    void launcherPositionItem
      .getValue()
      .then((stored) => {
        if (draggingRef.current) return;
        applyFraction(stored);
      })
      .catch(() => undefined);

    // Storage changes cross contexts, so parking the bar in one tab moves it
    // in the others too. Ignored mid-drag: the live gesture is authoritative.
    return launcherPositionItem.watch((next) => {
      if (draggingRef.current) return;
      applyFraction(next);
    });
  }, [applyFraction]);

  const top =
    barHeight > 0
      ? launcherTopFromFraction(fraction, viewportHeight, barHeight)
      : null;

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;

    dragOriginRef.current = null;
    draggingRef.current = false;
    setDragging(false);
    // Guarded: the browser has already released capture by the time
    // `pointerup` fires, and releasing an inactive pointer throws.
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!movedRef.current) return;
    void launcherPositionItem.setValue(fractionRef.current).catch(() => undefined);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Primary button only: a right-click opens the page's context menu and a
      // middle-click is the page's business, not the launcher's.
      if (event.button !== 0 || dragOriginRef.current) return;

      const rect = barRef.current?.getBoundingClientRect();
      if (!rect) return;

      movedRef.current = false;
      dragOriginRef.current = {
        pointerId: event.pointerId,
        startClientY: event.clientY,
        startTop: rect.top,
      };
      draggingRef.current = true;
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const origin = dragOriginRef.current;
      if (!origin || origin.pointerId !== event.pointerId) return;

      const delta = event.clientY - origin.startClientY;
      if (!movedRef.current && Math.abs(delta) < LAUNCHER_DRAG_THRESHOLD) return;

      if (!movedRef.current) {
        movedRef.current = true;
        // Only now is this a drag, so only now does the cursor say so.
        setDragging(true);
        // Capture is claimed here rather than on `pointerdown` on purpose. It
        // retargets `pointerup` to this element, and the browser fires `click`
        // at the common ancestor of the down and up targets — capturing early
        // moves every click off the shortcut button and onto the toolbar, so
        // the side panel never opens. Claiming it only once the press has
        // become a drag leaves a plain click untouched.
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }

      applyFraction(
        launcherFractionFromTop(
          origin.startTop + delta,
          window.innerHeight,
          barRef.current?.getBoundingClientRect().height ?? 0,
        ),
      );
    },
    [applyFraction],
  );

  const shouldSuppressClick = useCallback(() => movedRef.current, []);

  return {
    barRef,
    dragging,
    onPointerCancel: endDrag,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    shouldSuppressClick,
    top,
  };
}
