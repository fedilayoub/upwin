import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';

const ORIGIN = 'http://localhost:3000';

async function request(path: string) {
  const response = await unstable_getResponseFromNextConfig({ url: `${ORIGIN}${path}`, nextConfig });
  return { status: response.status, location: getRedirectUrl(response) };
}

describe('renamed app routes', () => {
  it.each([
    ['/en/dashboard', '/en'],
    ['/fr/onboarding', '/fr/context'],
    ['/en/onboarding/review', '/en/context/review'],
    ['/en/onboarding/cv', '/en/context/cv'],
    ['/en/proposals', '/en/proposal-style'],
    ['/en/admin/models', '/en/settings/models'],
    ['/fr/admin/prompts', '/fr/settings/prompts'],
  ])('sends %s to %s', async (from, to) => {
    await expect(request(from)).resolves.toEqual({ status: 307, location: `${ORIGIN}${to}` });
  });

  it('keeps the query string', async () => {
    await expect(request('/en/onboarding/review?edit=1')).resolves.toEqual({
      status: 307,
      location: `${ORIGIN}/en/context/review?edit=1`,
    });
  });

  it.each(['/en/admin/users', '/en/context', '/de/dashboard'])('does not redirect %s', async (path) => {
    await expect(request(path)).resolves.toEqual({ status: 200, location: null });
  });
});

it.each(['en', 'fr'])('sets noindex and no-referrer on /%s/v links', async (lang) => {
  const response = await unstable_getResponseFromNextConfig({ url: `${ORIGIN}/${lang}/v/0123ABCDefgh`, nextConfig });
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});

it.each(['/', '/en', '/en/settings/prompts', '/en/v/0123ABCDefgh', '/api/anything'])(
  'forbids framing and MIME sniffing on %s',
  async (path) => {
    const response = await unstable_getResponseFromNextConfig({ url: `${ORIGIN}${path}`, nextConfig });
    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  },
);

it('never writes an AGENTS.md during development', () => {
  expect(nextConfig.agentRules).toBe(false);
});
