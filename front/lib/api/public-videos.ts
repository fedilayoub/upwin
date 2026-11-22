import { ApiError } from '@/lib/api/client';
import type { PublicVideo } from '@/lib/api/types';

export const VIDEO_SLUG = /^[0-9A-Za-z]{12}$/;
export const VIEW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the backend did with a share-page play (`POST /public/videos/:slug/views`). */
export interface ViewResult {
  counted: boolean;
  owner: boolean;
  viewId: string | null;
}
export const NOT_COUNTED: ViewResult = { counted: false, owner: false, viewId: null };
export function parseViewResult(value: unknown): ViewResult {
  if (typeof value !== 'object' || value === null) return NOT_COUNTED;
  const v = value as Record<string, unknown>;
  return {
    counted: v.counted === true,
    owner: v.owner === true,
    viewId: typeof v.viewId === 'string' && VIEW_ID.test(v.viewId) ? v.viewId : null,
  };
}
/** One view's progress: distinct video time played, and whether it reached the end. */
export interface ViewProgress {
  watchedMs: number;
  finished: boolean;
}
export function parseViewProgress(value: unknown): ViewProgress | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.watchedMs !== 'number' ||
    !Number.isInteger(v.watchedMs) ||
    v.watchedMs < 0 ||
    v.watchedMs > 86_400_000 ||
    typeof v.finished !== 'boolean'
  )
    return null;
  return { watchedMs: v.watchedMs, finished: v.finished };
}

export type PublicVideoResult =
  | { kind: 'ok'; video: PublicVideo }
  | { kind: 'not-found' };

export async function fetchPublicVideo(
  slug: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PublicVideoResult> {
  if (!VIDEO_SLUG.test(slug)) return { kind: 'not-found' };
  const response = await fetcher(
    `${baseUrl.replace(/\/+$/, '')}/public/videos/${slug}`,
    {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    },
  );
  if (response.status === 404) return { kind: 'not-found' };
  if (response.status !== 200)
    throw new ApiError(
      'Could not load video.',
      'VIDEO_FETCH_ERROR',
      response.status,
    );
  return { kind: 'ok', video: (await response.json()) as PublicVideo };
}
