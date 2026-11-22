import { describe, expect, it, vi } from 'vitest';
import { fetchPublicVideo } from '@/lib/api/public-videos';

const slug = '0123ABCDefgh';
describe('public video client', () => {
  it('requests the public endpoint without auth or caching', async () => {
    const video = { slug, status: 'ready' };
    const fetcher = vi.fn(async () => Response.json(video));
    await expect(
      fetchPublicVideo(slug, 'http://backend/', fetcher),
    ).resolves.toEqual({ kind: 'ok', video });
    expect(fetcher).toHaveBeenCalledWith(
      `http://backend/public/videos/${slug}`,
      {
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      },
    );
  });
  it.each([[404, 'not-found']] as const)('maps %s', async (status, kind) => {
    await expect(
      fetchPublicVideo(
        slug,
        'http://backend',
        async () => new Response(null, { status }),
      ),
    ).resolves.toEqual({ kind });
  });
  it.each([201, 401, 403, 410, 429, 500, 503])(
    'throws for unexpected status %s',
    async (status) => {
      await expect(
        fetchPublicVideo(
          slug,
          'http://backend',
          async () => new Response(null, { status }),
        ),
      ).rejects.toMatchObject({ status });
    },
  );
  it.each(['short', '../012345678901', '01234567890_', '0123456789012'])(
    'does not fetch invalid slug %s',
    async (invalid) => {
      const fetcher = vi.fn();
      await expect(
        fetchPublicVideo(invalid, 'http://backend', fetcher),
      ).resolves.toEqual({ kind: 'not-found' });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});
