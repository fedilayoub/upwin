import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playedMs, sendVideoProgress, startVideoView } from './video-view';
const slug = '0123ABCDefgh';
const viewId = '018f6a77-4e90-7ab5-a3bf-15c8f850fa99';
const now = Date.UTC(2026, 10, 8);
const fetcher = vi.fn();
const storage = new Map<string, string>();
const key = `upwin.view.${slug}`;
const answer = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
beforeEach(() => {
  storage.clear();
  fetcher
    .mockReset()
    .mockResolvedValue(answer({ counted: true, owner: false, viewId }));
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('share-page views', () => {
  it('counts a first play once and keeps its view id for the day', async () => {
    expect(await startVideoView(slug)).toEqual({ viewId, owner: false });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`/api/videos/${slug}/views`, {
      method: 'POST',
      keepalive: true,
    });
    expect(JSON.parse(storage.get(key) ?? '')).toEqual({ at: now, id: viewId });
    // A replay the same day reports progress for the same view, without a new count.
    expect(await startVideoView(slug)).toEqual({ viewId, owner: false });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('counts again at the 24-hour boundary, and reads the older timestamp format', async () => {
    storage.set(key, String(now - 24 * 3600 * 1000 + 1));
    expect(await startVideoView(slug)).toEqual({ viewId: null, owner: false });
    expect(fetcher).not.toHaveBeenCalled();
    storage.set(key, JSON.stringify({ at: now - 24 * 3600 * 1000, id: viewId }));
    await startVideoView(slug);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('tells the owner, and stores nothing for their plays', async () => {
    fetcher.mockResolvedValue(answer({ counted: false, owner: true, viewId: null }));
    expect(await startVideoView(slug)).toEqual({ viewId: null, owner: true });
    expect(storage.has(key)).toBe(false);
  });
  it('works when browser storage is blocked or the network fails', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(await startVideoView(slug)).toEqual({ viewId, owner: false });
    fetcher.mockRejectedValue(new Error('offline'));
    expect(await startVideoView(slug)).toEqual({ viewId: null, owner: false });
  });
  it('ignores a malformed answer', async () => {
    fetcher.mockResolvedValue(answer({ counted: true, viewId: 'not-a-uuid' }));
    expect(await startVideoView(slug)).toEqual({ viewId: null, owner: false });
  });
});
describe('watch progress', () => {
  it('sums played ranges, so re-watching a part adds nothing', () => {
    const video = {
      played: {
        length: 2,
        start: (i: number) => [0, 10][i] ?? 0,
        end: (i: number) => [4.5, 12][i] ?? 0,
      },
    } as unknown as HTMLVideoElement;
    expect(playedMs(video)).toBe(6500);
  });
  it('posts progress while open, and uses a beacon when the page closes', () => {
    sendVideoProgress(slug, viewId, { watchedMs: 3000, finished: false });
    expect(fetcher).toHaveBeenCalledWith(
      `/api/videos/${slug}/views/${viewId}/progress`,
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({ watchedMs: 3000, finished: false }),
      }),
    );
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    sendVideoProgress(slug, viewId, { watchedMs: 9000, finished: true }, true);
    expect(beacon).toHaveBeenCalledWith(
      `/api/videos/${slug}/views/${viewId}/progress`,
      expect.any(Blob),
    );
  });
});
