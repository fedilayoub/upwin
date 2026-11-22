import { describe, expect, it, vi } from 'vitest';
import { FakeVideoStorage } from '../../test/videos/fake-video-storage';
import { videoConfig } from '../../test/videos/video-test-helpers';
import { VideosModule } from './videos.module';
describe('video boot checks', () => {
  function media() {
    return {
      probe: vi.fn(),
      remux: vi.fn(),
      poster: vi.fn(),
      assertAvailable: vi.fn(async () => undefined),
    };
  }
  it('does not need storage or ffmpeg when disabled', async () => {
    const tools = media();
    await new VideosModule(
      null,
      tools,
      videoConfig({ NODE_ENV: 'development' }),
    ).onModuleInit();
    expect(tools.assertAvailable).not.toHaveBeenCalled();
  });
  it('skips binary detection in tests even when configured', async () => {
    const tools = media();
    await new VideosModule(
      new FakeVideoStorage(),
      tools,
      videoConfig(),
    ).onModuleInit();
    expect(tools.assertAvailable).not.toHaveBeenCalled();
  });
  it('fails boot if configured binaries are missing', async () => {
    const tools = media();
    tools.assertAvailable.mockRejectedValueOnce(new Error('ffmpeg missing'));
    await expect(
      new VideosModule(
        new FakeVideoStorage(),
        tools,
        videoConfig({ NODE_ENV: 'development' }),
      ).onModuleInit(),
    ).rejects.toThrow('ffmpeg missing');
  });
});
