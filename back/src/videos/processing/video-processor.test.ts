import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema';
import type { VideoRow } from '../../database/schema';
import { FakeVideoStorage } from '../../../test/videos/fake-video-storage';
import {
  fakeRepository,
  videoConfig,
  videoRow,
} from '../../../test/videos/video-test-helpers';
import type { VideosRepository } from '../videos.repository';
import { VideoProcessor } from './video-processor';
import type { ProbeResult } from './probe-schema';
import { InvalidMediaError } from './media-tools';
const dirs: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function setup(
  patch: Partial<VideoRow> = {},
  env: Partial<Env> = {},
) {
  const row = videoRow({
    status: 'processing',
    uploadId: null,
    processingAttempts: 1,
    ...patch,
  });
  const repository = fakeRepository(row);
  const storage = new FakeVideoStorage();
  storage.objects.set(`${row.storagePrefix}raw.mp4`, Buffer.from('raw'));
  const probe: ProbeResult = {
    format: { format_name: 'mov,mp4', duration: '6' },
    streams: [
      { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720 },
      { codec_type: 'audio', codec_name: 'aac' },
    ],
  };
  const media = {
    probe: vi.fn(async () => probe),
    remux: vi.fn(async (_in: string, out: string) =>
      writeFile(out, 'playback'),
    ),
    poster: vi.fn(async (_in: string, out: string, seconds: number) => {
      void seconds;
      return writeFile(out, 'poster');
    }),
    assertAvailable: vi.fn(),
  };
  const dir = await mkdtemp(join(tmpdir(), 'video-processor-'));
  dirs.push(dir);
  // The processor works under os.tmpdir(), which follows TMPDIR.
  vi.stubEnv('TMPDIR', dir);
  const processor = new VideoProcessor(
    repository as unknown as VideosRepository,
    storage,
    media,
    videoConfig(env),
  );
  return {
    row,
    repository,
    storage,
    media,
    processor,
    dir,
    probe,
  };
}
describe('video processor', () => {
  it(
    'publishes validated playback and poster',
    async () => {
      const s = await setup();
      await s.processor.process(s.row);
      const ready = s.repository.rows.get(s.row.id);
      expect(ready).toMatchObject({
        status: 'ready',
        playbackReady: true,
        durationMs: 6000,
        sizeBytes: 8,
        width: 1280,
        height: 720,
        nextAttemptAt: null,
      });
      expect(s.storage.objects.has(`${s.row.storagePrefix}raw.mp4`)).toBe(
        false,
      );
      expect(s.storage.objects.has(`${s.row.storagePrefix}playback.mp4`)).toBe(
        true,
      );
      expect(s.media.poster).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        1,
      );
      await expect(access(join(s.dir, 'upwin-videos', s.row.id))).rejects.toThrow();
    },
  );
  it.each(['invalid_media', 'too_long'] as const)(
    'purges terminal %s',
    async (reason) => {
      const s = await setup();
      if (reason === 'invalid_media')
        s.media.probe.mockResolvedValue({
          ...s.probe,
          streams: [{ codec_type: 'video', codec_name: 'vp9' }],
        });
      else
        s.media.probe.mockResolvedValue({
          ...s.probe,
          format: { format_name: 'mov,mp4', duration: '400' },
        });
      await s.processor.process(s.row);
      expect(s.repository.rows.get(s.row.id)).toMatchObject({
        status: 'failed',
        failureReason: reason,
      });
      expect(s.storage.objects.size).toBe(0);
    },
  );
  it('retries a transient error and then succeeds', async () => {
    const s = await setup();
    s.media.remux.mockRejectedValueOnce(new Error('timeout'));
    await s.processor.process(s.row);
    expect(s.repository.rows.get(s.row.id)?.status).toBe('processing');
    expect(
      s.repository.rows.get(s.row.id)?.nextAttemptAt?.getTime(),
    ).toBeGreaterThan(Date.now());
    const next = { ...s.repository.rows.get(s.row.id)!, processingAttempts: 2 };
    s.repository.rows.set(next.id, next);
    await s.processor.process(next);
    expect(s.repository.rows.get(next.id)?.status).toBe('ready');
  });
  it('fails after three transient errors', async () => {
    const s = await setup();
    s.media.remux.mockRejectedValue(new Error('timeout'));
    for (let attempt = 1; attempt <= 3; attempt++) {
      const row = {
        ...s.repository.rows.get(s.row.id)!,
        processingAttempts: attempt,
      };
      s.repository.rows.set(row.id, row);
      await s.processor.process(row);
    }
    expect(s.repository.rows.get(s.row.id)).toMatchObject({
      status: 'failed',
      failureReason: 'processing_error',
    });
  });
  it('does not publish a video deleted during processing', async () => {
    const s = await setup();
    s.media.poster.mockImplementationOnce(async (_in, out) => {
      await writeFile(out, 'poster');
      await s.repository.update(s.row.id, { deletedAt: new Date() });
    });
    await s.processor.process(s.row);
    expect(s.repository.markReady).not.toHaveBeenCalled();
    expect(s.storage.objects.size).toBe(0);
  });
  it('marks the failure even when its purge has to wait for the reaper', async () => {
    const s = await setup();
    s.media.probe.mockRejectedValue(new InvalidMediaError());
    s.storage.deletePrefix.mockRejectedValue(new Error('storage unavailable'));
    await s.processor.process(s.row);
    expect(s.repository.rows.get(s.row.id)).toMatchObject({
      status: 'failed',
      failureReason: 'invalid_media',
      storagePurgedAt: null,
    });
  });
  it('never starts polling or claims work in test mode', async () => {
    const s = await setup();
    s.processor.onApplicationBootstrap();
    await s.processor.kick();
    await s.processor.onModuleDestroy();
    expect(s.repository.claim).not.toHaveBeenCalled();
  });
  it('leaves concurrent deletion retryable when storage fails after an earlier purge', async () => {
    const s = await setup();
    s.media.poster.mockImplementationOnce(async (_in, out) => {
      await writeFile(out, 'poster');
      await s.repository.update(s.row.id, {
        deletedAt: new Date(),
        storagePurgedAt: new Date(),
      });
    });
    s.storage.deletePrefix.mockRejectedValue(new Error('storage offline'));
    await s.processor.process(s.row);
    expect(s.repository.rows.get(s.row.id)?.storagePurgedAt).toBeNull();
    expect(s.storage.uploadFile).not.toHaveBeenCalled();
  });
  it('does not overwrite a newer processing lease with a terminal result', async () => {
    const s = await setup();
    s.media.probe.mockImplementationOnce(async () => {
      await s.repository.update(s.row.id, { processingAttempts: 2 });
      return {
        ...s.probe,
        streams: [{ codec_type: 'video', codec_name: 'vp9' }],
      };
    });
    await s.processor.process(s.row);
    expect(s.repository.rows.get(s.row.id)?.status).toBe('processing');
  });
});
