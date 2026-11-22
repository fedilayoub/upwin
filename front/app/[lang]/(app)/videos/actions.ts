'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getBackendApiClient, getPublicVideo } from '@/lib/api/server';
import { videoActionError } from '@/lib/video-action-errors';

export async function renameVideoAction(
  locale: string,
  id: string,
  title: string,
) {
  if (!isLocale(locale)) throw new Error('Unsupported locale.');
  const copy = (await getDictionary(locale)).videos;
  const input = z
    .object({ id: z.uuid(), title: z.string().trim().min(1).max(120) })
    .safeParse({ id, title });
  if (!input.success)
    return { status: 'error' as const, message: copy.errors.invalid };
  try {
    const api = await getBackendApiClient();
    await api.renameVideo(input.data.id, { title: input.data.title });
    revalidatePath(`/${locale}/videos`);
    return { status: 'success' as const, message: copy.messages.renamed };
  } catch (error: unknown) {
    return videoActionError(error, copy.errors);
  }
}

export async function deleteVideoAction(locale: string, id: string) {
  if (!isLocale(locale)) throw new Error('Unsupported locale.');
  const copy = (await getDictionary(locale)).videos;
  if (!z.uuid().safeParse(id).success)
    return { status: 'error' as const, message: copy.errors.invalid };
  try {
    const api = await getBackendApiClient();
    await api.deleteVideo(id);
    revalidatePath(`/${locale}/videos`);
    return { status: 'success' as const, message: copy.messages.deleted };
  } catch (error: unknown) {
    return videoActionError(error, copy.errors);
  }
}

export async function loadMoreVideosAction(locale: string, cursor: string) {
  if (!isLocale(locale)) throw new Error('Unsupported locale.');
  const copy = (await getDictionary(locale)).videos;
  if (
    !z
      .string()
      .min(1)
      .max(2048)
      .regex(/^[A-Za-z0-9_-]+$/)
      .safeParse(cursor).success
  )
    return { status: 'error' as const, message: copy.errors.invalid };
  try {
    const api = await getBackendApiClient();
    const page = await api.listVideos({ cursor, limit: 20 });
    return { status: 'success' as const, page };
  } catch (error: unknown) {
    return videoActionError(error, copy.errors);
  }
}

/** Fresh presigned playback URLs for the in-app player. Same data the public share page gets. */
export async function getVideoPlaybackAction(locale: string, slug: string) {
  if (!isLocale(locale)) throw new Error('Unsupported locale.');
  const copy = (await getDictionary(locale)).videos;
  try {
    const result = await getPublicVideo(slug);
    if (result.kind !== 'ok')
      return { status: 'error' as const, message: copy.loadError };
    return { status: 'success' as const, video: result.video };
  } catch {
    return { status: 'error' as const, message: copy.loadError };
  }
}
