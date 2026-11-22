import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './poster/route';
import { POST } from './views/route';
import { POST as PROGRESS } from './views/[viewId]/progress/route';
import { sessionTokenFor } from '@/lib/app-session';
const mocks = vi.hoisted(() => ({
  getPublicVideo: vi.fn(),
  recordPublicVideoView: vi.fn(),
  recordPublicVideoProgress: vi.fn(),
  cookie: vi.fn<() => { value: string } | undefined>(),
}));
vi.mock('@/lib/api/server', () => ({
  getPublicVideo: mocks.getPublicVideo,
  recordPublicVideoView: mocks.recordPublicVideoView,
  recordPublicVideoProgress: mocks.recordPublicVideoProgress,
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => mocks.cookie() }),
}));
const slug = '0123ABCDefgh';
const ctx = (value = slug) => ({ params: Promise.resolve({ slug: value }) });
const request = new Request('http://localhost');
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
describe('poster route', () => {
  it('redirects a ready poster for five minutes', async () => {
    mocks.getPublicVideo.mockResolvedValue({
      kind: 'ok',
      video: { status: 'ready', posterUrl: 'https://storage.example/poster' },
    });
    const response = await GET(request, ctx());
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      'https://storage.example/poster',
    );
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
  });
  it.each([
    { kind: 'not-found' },
    { kind: 'ok', video: { status: 'processing' } },
  ])('404s unavailable posters', async (result) => {
    mocks.getPublicVideo.mockResolvedValue(result);
    expect((await GET(request, ctx())).status).toBe(404);
  });
  it('rejects invalid slugs before fetching', async () => {
    expect((await GET(request, ctx('bad'))).status).toBe(404);
    expect(mocks.getPublicVideo).not.toHaveBeenCalled();
  });
});
const notCounted = { counted: false, owner: false, viewId: null };
const viewId = '018f6a77-4e90-7ab5-a3bf-15c8f850fa99';
describe('view route', () => {
  it('pings anonymously for a client, and returns the view', async () => {
    vi.stubEnv('APP_PASSWORD', 'correct horse');
    vi.stubEnv('API_TOKEN', 'owner-api-token');
    mocks.recordPublicVideoView.mockResolvedValue({ counted: true, owner: false, viewId });
    const response = await POST(request, ctx());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ counted: true, owner: false, viewId });
    expect(mocks.recordPublicVideoView).toHaveBeenCalledWith(slug, null);
  });
  it('sends the API token for the freelancer, who unlocked the app, so their plays do not count', async () => {
    vi.stubEnv('APP_PASSWORD', 'correct horse');
    vi.stubEnv('API_TOKEN', 'owner-api-token');
    mocks.cookie.mockReturnValue({ value: await sessionTokenFor('correct horse') });
    mocks.recordPublicVideoView.mockResolvedValue({ counted: false, owner: true, viewId: null });
    const response = await POST(request, ctx());
    expect(await response.json()).toMatchObject({ owner: true });
    expect(mocks.recordPublicVideoView).toHaveBeenCalledWith(slug, 'owner-api-token');
  });
  it('never sends the token without a password gate to prove who is watching', async () => {
    vi.stubEnv('APP_PASSWORD', '');
    vi.stubEnv('API_TOKEN', 'owner-api-token');
    mocks.recordPublicVideoView.mockResolvedValue({ counted: true, owner: false, viewId });
    await POST(request, ctx());
    expect(mocks.recordPublicVideoView).toHaveBeenCalledWith(slug, null);
  });
  it('answers "not counted" on an API failure', async () => {
    mocks.recordPublicVideoView.mockRejectedValue(new Error('unavailable'));
    expect(await (await POST(request, ctx())).json()).toEqual(notCounted);
  });
  it('never pings an invalid slug', async () => {
    expect(await (await POST(request, ctx('../bad'))).json()).toEqual(notCounted);
    expect(mocks.recordPublicVideoView).not.toHaveBeenCalled();
  });
});
describe('progress route', () => {
  const progressCtx = (s = slug, v = viewId) => ({
    params: Promise.resolve({ slug: s, viewId: v }),
  });
  const body = (value: unknown) =>
    new Request('http://localhost', { method: 'POST', body: JSON.stringify(value) });
  it('forwards a valid progress report and always answers 204', async () => {
    const response = await PROGRESS(body({ watchedMs: 4200, finished: false }), progressCtx());
    expect(response.status).toBe(204);
    expect(mocks.recordPublicVideoProgress).toHaveBeenCalledWith(slug, viewId, {
      watchedMs: 4200,
      finished: false,
    });
  });
  it('drops malformed ids, payloads and backend errors silently', async () => {
    expect((await PROGRESS(body({ watchedMs: 1, finished: true }), progressCtx('../bad'))).status).toBe(204);
    expect((await PROGRESS(body({ watchedMs: 1, finished: true }), progressCtx(slug, 'x'))).status).toBe(204);
    expect((await PROGRESS(body({ watchedMs: -1, finished: true }), progressCtx())).status).toBe(204);
    expect((await PROGRESS(body('x'.repeat(300)), progressCtx())).status).toBe(204);
    expect(mocks.recordPublicVideoProgress).not.toHaveBeenCalled();
    mocks.recordPublicVideoProgress.mockRejectedValue(new Error('down'));
    expect((await PROGRESS(body({ watchedMs: 1, finished: true }), progressCtx())).status).toBe(204);
  });
});
