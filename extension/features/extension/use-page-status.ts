import { useCallback, useEffect, useRef, useState } from 'react';

export type PageState = 'checking' | 'missing' | 'ready';

interface TabChangeInfo {
  status?: string;
  url?: string;
}

/**
 * The active tab navigated. Upwork moves between pages with the history API,
 * which reports a URL change without a new load, so both signals count.
 */
export function isActiveTabNavigation(
  changeInfo: TabChangeInfo,
  tab: { active?: boolean },
): boolean {
  return (
    tab.active === true &&
    (changeInfo.url !== undefined || changeInfo.status === 'complete')
  );
}

/**
 * Whether the active tab is the page a screen works on, kept current while
 * that screen is mounted.
 *
 * `check` asks the launcher for the tab's URL and reads no DOM, so following
 * tab events here is not capture. Capture still starts only from a click. A
 * background refresh never passes through "checking", so the screen does not
 * flicker on every in-app navigation.
 *
 * `check` must be a stable reference.
 */
export function usePageStatus(check: () => Promise<{ supported: boolean }>) {
  const [state, setState] = useState<{
    error: string | null;
    status: PageState;
  }>({ error: null, status: 'checking' });
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;

    try {
      const { supported } = await check();
      if (request !== latestRequest.current) return;
      setState({ error: null, status: supported ? 'ready' : 'missing' });
    } catch (error: unknown) {
      if (request !== latestRequest.current) return;
      setState({
        error: error instanceof Error ? error.message : null,
        status: 'missing',
      });
    }
  }, [check]);

  /** A user-asked re-check shows its progress, unlike a background refresh. */
  const recheck = useCallback(() => {
    setState((current) => ({ ...current, status: 'checking' }));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const handleActivated = () => {
      void refresh();
    };
    const handleUpdated = (
      _tabId: number,
      changeInfo: TabChangeInfo,
      tab: { active?: boolean },
    ) => {
      if (isActiveTabNavigation(changeInfo, tab)) void refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    browser.tabs.onActivated.addListener(handleActivated);
    browser.tabs.onUpdated.addListener(handleUpdated);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      browser.tabs.onActivated.removeListener(handleActivated);
      browser.tabs.onUpdated.removeListener(handleUpdated);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  return { ...state, recheck, refresh };
}
