import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renameVideoAction,
  deleteVideoAction,
  loadMoreVideosAction,
} from './actions';
import { ApiError } from '@/lib/api/client';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';
const mocks = vi.hoisted(() => ({
  getBackendApiClient: vi.fn(),
  renameVideo: vi.fn(),
  deleteVideo: vi.fn(),
  listVideos: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/api/server', () => ({
  getBackendApiClient: mocks.getBackendApiClient,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/i18n/dictionaries', () => ({
  getDictionary: async (locale: string) => (locale === 'fr' ? fr : en),
}));
const id = '88888888-8888-4888-8888-888888888888';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getBackendApiClient.mockResolvedValue(mocks);
});
describe('video actions', () => {
  it.each(['', '   ', 'x'.repeat(121)])(
    'rejects invalid title %j without calling the API',
    async (title) => {
      expect((await renameVideoAction('en', id, title)).status).toBe('error');
      expect(mocks.getBackendApiClient).not.toHaveBeenCalled();
    },
  );
  it('trims titles and revalidates the library', async () => {
    expect((await renameVideoAction('fr', id, '  Bonjour  ')).status).toBe(
      'success',
    );
    expect(mocks.renameVideo).toHaveBeenCalledWith(id, { title: 'Bonjour' });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/fr/videos');
  });
  it('validates the id on rename and deletion', async () => {
    expect((await renameVideoAction('en', '../bad', 'Title')).status).toBe(
      'error',
    );
    expect((await deleteVideoAction('en', 'bad')).status).toBe('error');
    expect(mocks.getBackendApiClient).not.toHaveBeenCalled();
  });
  it('deletes and refreshes the library and its storage usage', async () => {
    expect((await deleteVideoAction('en', id)).status).toBe('success');
    expect(mocks.deleteVideo).toHaveBeenCalledWith(id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/videos');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/videos');
  });
  it.each([
    ['VIDEO_NOT_FOUND', 'notFound'],
    ['VIDEO_NOT_CONFIGURED', 'notConfigured'],
    ['VIDEO_STORAGE_ERROR', 'storage'],
    ['UNAUTHENTICATED', 'unauthenticated'],
    ['FORBIDDEN', 'forbidden'],
    ['VALIDATION_FAILED', 'invalid'],
    ['UNKNOWN_ERROR', 'generic'],
  ] as const)(
    'localizes %s without exposing the backend message',
    async (code, key) => {
      mocks.deleteVideo.mockRejectedValue(
        new ApiError('internal English error', code, 400),
      );
      expect(await deleteVideoAction('fr', id)).toEqual({
        status: 'error',
        message: fr.videos.errors[key],
      });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );
  it('loads the next page using the opaque cursor', async () => {
    const page = { items: [], nextCursor: null };
    mocks.listVideos.mockResolvedValue(page);
    expect(await loadMoreVideosAction('en', 'abc_DEF-123')).toEqual({
      status: 'success',
      page,
    });
    expect(mocks.listVideos).toHaveBeenCalledWith({
      limit: 20,
      cursor: 'abc_DEF-123',
    });
  });
  it('rejects malformed cursors', async () => {
    expect((await loadMoreVideosAction('en', '../../bad')).status).toBe(
      'error',
    );
    expect(mocks.listVideos).not.toHaveBeenCalled();
  });
  it('rejects unsupported locales before mutation', async () => {
    await expect(deleteVideoAction('de', id)).rejects.toThrow(
      'Unsupported locale',
    );
    expect(mocks.getBackendApiClient).not.toHaveBeenCalled();
  });
});
