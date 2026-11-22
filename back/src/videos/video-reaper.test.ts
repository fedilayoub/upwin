import { describe, expect, it } from 'vitest';
import type { Env } from '../config/env.schema';
import { FakeVideoStorage } from '../../test/videos/fake-video-storage';
import {
  fakeRepository,
  videoConfig,
  videoRow,
} from '../../test/videos/video-test-helpers';
import { VideoReaper } from './video-reaper';
import type { VideosRepository } from './videos.repository';
function setup(
  task: string,
  patch: Parameters<typeof videoRow>[0] = {},
  env: Partial<Env> = {},
) {
  const row = videoRow(patch),
    repository = fakeRepository(row),
    storage = new FakeVideoStorage();
  repository.candidates.mockImplementation(async (selected) =>
    selected === task ? [row] : [],
  );
  return {
    row,
    repository,
    storage,
    reaper: new VideoReaper(
      repository as unknown as VideosRepository,
      storage,
      videoConfig(env),
    ),
  };
}
describe('video reaper', () => {
  it('does no work if another instance holds the advisory lock', async () => {
    const s = setup('abandoned');
    s.repository.withReaperLock.mockResolvedValue(false);
    await s.reaper.run();
    expect(s.repository.candidates).not.toHaveBeenCalled();
  });
  it('aborts and purges abandoned uploads and marks the failure', async () => {
    const s = setup('abandoned');
    await s.reaper.run();
    expect(s.storage.abortMultipartUpload).toHaveBeenCalledWith(
      `${s.row.storagePrefix}raw.mp4`,
      'upload-0',
    );
    expect(s.repository.rows.get(s.row.id)).toMatchObject({
      status: 'failed',
      failureReason: 'upload_abandoned',
      uploadId: null,
    });
  });
  it('purges ownerless rows by the stored prefix and removes multipart uploads', async () => {
    const s = setup('orphans', { userId: null });
    await s.reaper.run();
    expect(s.storage.deletePrefix).toHaveBeenCalledWith(s.row.storagePrefix);
    expect(s.repository.hardDelete).toHaveBeenCalledWith(s.row.id);
  });
  it.each(['deleted', 'failed'] as const)(
    'retries a %s purge and records successful deletion',
    async (state) => {
      const s = setup(
        'purge',
        state === 'deleted'
          ? { deletedAt: new Date() }
          : { status: 'failed', failureReason: 'invalid_media' },
      );
      await s.reaper.run();
      expect(s.storage.deletePrefix).toHaveBeenCalledWith(s.row.storagePrefix);
      expect(s.repository.rows.get(s.row.id)?.storagePurgedAt).toBeInstanceOf(
        Date,
      );
    },
  );
  it('retains rows for a failed storage operation and continues other tasks', async () => {
    const s = setup('orphans', { userId: null });
    s.storage.deletePrefix.mockRejectedValueOnce(new Error('offline'));
    await s.reaper.run();
    expect(s.repository.hardDelete).not.toHaveBeenCalled();
    expect(s.repository.candidates).toHaveBeenCalledWith('housekeeping');
  });
  it('removes old already-purged failures during housekeeping', async () => {
    const s = setup('housekeeping', {
      status: 'failed',
      storagePurgedAt: new Date(),
    });
    await s.reaper.run();
    expect(s.repository.hardDelete).toHaveBeenCalledWith(s.row.id);
  });
  it('does not schedule timers in tests', async () => {
    const s = setup('none');
    s.reaper.onApplicationBootstrap();
    await s.reaper.onModuleDestroy();
    expect(s.repository.withReaperLock).not.toHaveBeenCalled();
  });
});
