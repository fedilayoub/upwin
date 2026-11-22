import 'server-only';

import { BackendApiClient } from '@/lib/api/client';
import {
  fetchPublicVideo,
  NOT_COUNTED,
  parseViewResult,
  VIDEO_SLUG,
  type ViewProgress,
  type ViewResult,
} from '@/lib/api/public-videos';

export async function getPublicVideo(slug: string) {
  if (!VIDEO_SLUG.test(slug)) return { kind: 'not-found' } as const;
  return fetchPublicVideo(slug, getApiUrl());
}

export async function recordPublicVideoView(
  slug: string,
  token: string | null,
): Promise<ViewResult> {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${getApiUrl().replace(/\/+$/, '')}/public/videos/${slug}/views`, {
    method: 'POST', cache: 'no-store', credentials: 'omit', headers,
  });
  if (!response.ok) return NOT_COUNTED;
  return parseViewResult(await response.json().catch(() => null));
}

export async function recordPublicVideoProgress(
  slug: string,
  viewId: string,
  progress: ViewProgress,
): Promise<void> {
  await fetch(
    `${getApiUrl().replace(/\/+$/, '')}/public/videos/${slug}/views/${viewId}/progress`,
    {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
    },
  );
}

/**
 * The API runs on the user's machine and serves one local user, so there is
 * no session to read. `API_TOKEN` is only needed when the API was started
 * with one (it is reachable over a network).
 */
export async function getBackendApiClient(): Promise<BackendApiClient> {
  return new BackendApiClient({
    baseUrl: getApiUrl(),
    token: process.env.API_TOKEN?.trim() || undefined,
  });
}

export function getApiUrl(): string {
  const apiUrl = process.env.API_URL?.trim();
  if (!apiUrl) {
    throw new Error('API_URL must be configured for server-side backend requests.');
  }

  return apiUrl;
}
