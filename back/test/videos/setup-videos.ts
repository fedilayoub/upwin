import { vi } from 'vitest';
import type { Env } from '../../src/config/env.schema';
import type { VideoRow } from '../../src/database/schema';
import { FakeVideoStorage } from './fake-video-storage';
import { fakeRepository, videoConfig, videoRow } from './video-test-helpers';
import type { VideoProcessor } from '../../src/videos/processing/video-processor';
import { VideosService } from '../../src/videos/videos.service';
import type { VideosRepository } from '../../src/videos/videos.repository';
export function setup(
  patch: Partial<VideoRow> = {},
  configured = true,
  env: Partial<Env> = {},
) {
  const row = videoRow(patch),
    repository = fakeRepository(row),
    storage = new FakeVideoStorage();
  storage.uploads.set('upload-0', [
    { partNumber: 1, sizeBytes: 8388608, etag: '"a"' },
    { partNumber: 2, sizeBytes: 1, etag: '"b"' },
  ]);
  const processor = { kick: vi.fn(async () => undefined) };
  const config = videoConfig(env);
  // Video is off when no bucket is configured: the module provides null.
  const service = new VideosService(
    repository as unknown as VideosRepository,
    processor as unknown as VideoProcessor,
    configured ? storage : null,
    config,
  );
  return { row, repository, storage, service, processor, config };
}
