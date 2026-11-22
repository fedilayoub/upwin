import { parseViewResult, type ViewProgress } from '@/lib/api/public-videos';

const DAY = 24 * 60 * 60 * 1000;
export interface ViewTicket {
  /** Reports this view's progress; null when the play was not counted. */
  viewId: string | null;
  /** The signed-in owner is watching: nothing is counted. */
  owner: boolean;
}

function storedView(raw: string | null): { at: number; id: string | null } | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    // Older pages stored a bare timestamp.
    if (typeof value === 'number') return { at: value, id: null };
    if (typeof value === 'object' && value !== null) {
      const v = value as { at?: unknown; id?: unknown };
      if (typeof v.at === 'number')
        return { at: v.at, id: typeof v.id === 'string' ? v.id : null };
    }
  } catch {
    // Unreadable: count anew.
  }
  return null;
}

/**
 * First play: counts one view per browser per day. A replay within the day keeps reporting
 * progress for the same view. No viewer identifier leaves the browser.
 */
export async function startVideoView(slug: string): Promise<ViewTicket> {
  const key = `upwin.view.${slug}`;
  const now = Date.now();
  try {
    const stored = storedView(localStorage.getItem(key));
    if (stored && now - stored.at < DAY) return { viewId: stored.id, owner: false };
  } catch {
    // Playback and counting also work with browser storage disabled.
  }
  try {
    const response = await fetch(`/api/videos/${slug}/views`, {
      method: 'POST',
      keepalive: true,
    });
    const result = parseViewResult(await response.json());
    if (result.counted)
      try {
        localStorage.setItem(key, JSON.stringify({ at: now, id: result.viewId }));
      } catch {
        // See above.
      }
    return { viewId: result.viewId, owner: result.owner };
  } catch {
    return { viewId: null, owner: false };
  }
}

/** Distinct video time played so far: the union of played ranges, so re-watching adds nothing. */
export function playedMs(video: HTMLVideoElement): number {
  let seconds = 0;
  for (let i = 0; i < video.played.length; i++)
    seconds += video.played.end(i) - video.played.start(i);
  return Math.round(seconds * 1000);
}

export function sendVideoProgress(
  slug: string,
  viewId: string,
  progress: ViewProgress,
  closing = false,
): void {
  const url = `/api/videos/${slug}/views/${viewId}/progress`;
  const body = JSON.stringify(progress);
  // A closing page only finishes requests sent as a beacon.
  if (closing && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    return;
  }
  void fetch(url, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => undefined);
}
