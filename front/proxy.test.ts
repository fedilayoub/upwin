import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionTokenFor } from '@/lib/app-session';
import { proxy } from '@/proxy';

describe('proxy', () => {
  it('sends the root to the Overview in the preferred locale', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.5' },
      }),
    );

    expect(response.headers.get('location')).toBe('http://localhost:3000/fr');
  });

  it('adds the locale to an unprefixed path and keeps its query', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/applications?window=30d'),
    );

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/en/applications?window=30d',
    );
  });

  it('prefers the saved locale cookie over Accept-Language', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/goals', {
        headers: { cookie: 'upwin_locale=fr', 'accept-language': 'en' },
      }),
    );

    expect(response.headers.get('location')).toBe('http://localhost:3000/fr/goals');
  });

  it.each(['/en', '/fr/context/review', '/manifest.webmanifest'])(
    'serves %s without a redirect or any sign-in gate',
    async (path) => {
      const response = await proxy(new NextRequest(`http://localhost:3000${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    },
  );

  describe('with APP_PASSWORD (an online install)', () => {
    beforeEach(() => {
      vi.stubEnv('APP_PASSWORD', 'correct horse');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('sends a locked visitor to the unlock page and remembers where they were going', async () => {
      const response = await proxy(new NextRequest('http://localhost:3000/en/goals?x=1'));
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/en/unlock?next=%2Fen%2Fgoals%3Fx%3D1',
      );
    });

    it('refuses locked API route calls with a bare 401', async () => {
      const response = await proxy(new NextRequest('http://localhost:3000/api/other'));
      expect(response.status).toBe(401);
    });

    it.each(['/en/v/0123ABCDefgh', '/api/videos/0123ABCDefgh/views', '/fr/unlock'])(
      'keeps %s open for clients',
      async (path) => {
        const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
        expect(response.status).toBe(200);
        expect(response.headers.get('location')).toBeNull();
      },
    );

    it('sends the link the API shares, /v/<slug>, to its localized page, not to unlock', async () => {
      const response = await proxy(new NextRequest('http://localhost:3000/v/0123ABCDefgh'));
      expect(response.headers.get('location')).toBe('http://localhost:3000/en/v/0123ABCDefgh');
    });

    it('lets an unlocked visitor through', async () => {
      const cookie = await sessionTokenFor('correct horse');
      const response = await proxy(
        new NextRequest('http://localhost:3000/en/goals', {
          headers: { cookie: `upwin_session=${cookie}` },
        }),
      );
      expect(response.status).toBe(200);
    });

    it('rejects a cookie from a previous password', async () => {
      const cookie = await sessionTokenFor('old password');
      const response = await proxy(
        new NextRequest('http://localhost:3000/en/goals', {
          headers: { cookie: `upwin_session=${cookie}` },
        }),
      );
      expect(response.headers.get('location')).toContain('/en/unlock');
    });
  });
});
