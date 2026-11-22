import { useEffect, useRef } from 'react';

/** Focus and visibility often fire together on one return; count them once. */
const MIN_GAP_MS = 1000;

/**
 * Calls `onReturn` when the user comes back to this page: the window regains focus or the
 * document becomes visible again. The side panel stays open while the user works elsewhere
 * (the web app included), so anything it shows from the server can be stale by then.
 */
export function usePanelReturn(onReturn: () => void): void {
  const callback = useRef(onReturn);
  callback.current = onReturn;
  useEffect(() => {
    let last = 0;
    const fire = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - last < MIN_GAP_MS) return;
      last = now;
      callback.current();
    };
    window.addEventListener('focus', fire);
    document.addEventListener('visibilitychange', fire);
    return () => {
      window.removeEventListener('focus', fire);
      document.removeEventListener('visibilitychange', fire);
    };
  }, []);
}
