import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SharePage, { generateMetadata } from './page';
import en from '@/i18n/dictionaries/en';
import type { PublicVideo } from '@/lib/api/types';
const mocks = vi.hoisted(() => ({
  getPublicVideo: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('@/lib/api/server', () => ({ getPublicVideo: mocks.getPublicVideo }));
vi.mock('@/i18n/dictionaries', () => ({ getDictionary: async () => en }));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));
const params = Promise.resolve({ lang: 'en', slug: '0123ABCDefgh' });
const video: PublicVideo = {
  slug: '0123ABCDefgh',
  title: 'A proposal for your project',
  status: 'ready',
  durationMs: 65200,
  width: 1280,
  height: 720,
  playbackUrl: 'https://storage.example/playback',
  posterUrl: 'https://storage.example/poster',
  createdAt: '2026-11-06T12:00:00Z',
};
beforeEach(() => {
  vi.clearAllMocks();
});
describe('share page', () => {
  it('renders only public recording information with native inline playback', async () => {
    mocks.getPublicVideo.mockResolvedValue({ kind: 'ok', video });
    const markup = renderToStaticMarkup(await SharePage({ params }));
    expect(markup).toContain(video.title);
    expect(markup).toContain('playsInline');
    expect(markup).toContain('poster="https://storage.example/poster"');
    expect(markup).toContain('1:05');
    expect(markup).toContain('Recorded Nov 6, 2026');
    // No link anywhere: the rest of the site is the freelancer's private app.
    expect(markup).not.toContain('href=');
    expect(markup).toContain('Recorded with');
    expect(markup).not.toMatch(/mailto:|avatar|userId|owner|@/i);
    // Custom controls over the native element: a big play button, speed, full screen.
    expect(markup).toContain('aria-label="Play"');
    expect(markup).toContain('aria-label="Playback speed"');
    expect(markup).toContain('aria-label="Full screen"');
    expect(markup).toContain('role="slider"');
    expect(markup).toContain(en.share.eyebrow);
    expect(markup).not.toContain(' controls=""');
  });
  it('uses stable poster metadata and noindex, never a presigned og:video', async () => {
    vi.stubEnv('APP_URL', 'https://upwin.example.com');
    mocks.getPublicVideo.mockResolvedValue({ kind: 'ok', video });
    const metadata = await generateMetadata({ params });
    expect(metadata.title).toEqual({ absolute: `${video.title} · Video` });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(metadata)).toContain(
      'https://upwin.example.com/api/videos/0123ABCDefgh/poster',
    );
    expect(JSON.stringify(metadata)).not.toContain('storage.example');
  });
  it.each([
    ['processing', { kind: 'ok', video: { ...video, status: 'processing', posterUrl: null } }],
    ['missing', { kind: 'not-found' }],
  ])('shares a text-only card while the video is %s', async (_label, result) => {
    // The poster route 404s until the video is ready; a scraper would cache an empty card.
    vi.stubEnv('APP_URL', 'https://upwin.example.com');
    mocks.getPublicVideo.mockResolvedValue(result);
    const metadata = await generateMetadata({ params });
    expect(metadata.openGraph?.images).toEqual([]);
    expect(metadata.twitter).toMatchObject({ card: 'summary', images: [] });
    expect(JSON.stringify(metadata)).not.toContain('/poster');
  });
  it('404s a missing recording', async () => {
    mocks.getPublicVideo.mockResolvedValue({ kind: 'not-found' });
    await expect(SharePage({ params })).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('renders processing without a player', async () => {
    mocks.getPublicVideo.mockResolvedValue({
      kind: 'ok',
      video: {
        ...video,
        status: 'processing',
        playbackUrl: null,
        posterUrl: null,
      },
    });
    const markup = renderToStaticMarkup(await SharePage({ params }));
    expect(markup).toContain(en.share.processing);
    expect(markup).not.toContain('<video');
  });
});
