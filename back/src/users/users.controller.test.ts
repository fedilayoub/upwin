import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { LOCAL_USER_ID, type User } from '../database/schema';

const EXTENSION_ORIGIN = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const API_TOKEN = 'local-test-token-0123456789';

describe('GET /me', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('without API_TOKEN', () => {
    it('returns the local user for a request addressed to localhost', async () => {
      stubRequiredEnvironment();
      const app = await createApp();

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/me',
          headers: { host: 'localhost:3002' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          id: LOCAL_USER_ID,
          createdAt: localUser().createdAt.toISOString(),
        });
      } finally {
        await app.close();
      }
    });

    it('serves the allowed extension origin', async () => {
      stubRequiredEnvironment();
      const app = await createApp();

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/me',
          headers: {
            host: '127.0.0.1:3002',
            origin: EXTENSION_ORIGIN,
            'x-upilot-extension-origin': EXTENSION_ORIGIN,
          },
        });

        expect(response.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });

    it('refuses a host name outside the allowlist, as a DNS-rebinding page sends', async () => {
      stubRequiredEnvironment();
      const ensureLocalUser = vi.fn(async () => localUser());
      const app = await createApp(ensureLocalUser);

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/me',
          headers: {
            host: 'attacker.example:3002',
            // Same-origin from the page's point of view, and spoofable.
            'x-forwarded-host': 'localhost',
          },
        });

        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({
          error: {
            code: 'FORBIDDEN',
            message:
              'Without API_TOKEN, only requests addressed to localhost are served. Set API_TOKEN to reach the API by another name.',
          },
        });
        expect(ensureLocalUser).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });

    it('returns FORBIDDEN for a disallowed extension origin', async () => {
      stubRequiredEnvironment();
      const ensureLocalUser = vi.fn(async () => localUser());
      const app = await createApp(ensureLocalUser);
      const rogueOrigin = 'chrome-extension://cccccccccccccccccccccccccccccccc';

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/me',
          headers: {
            host: 'localhost:3002',
            origin: rogueOrigin,
            'x-upilot-extension-origin': rogueOrigin,
          },
        });

        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({
          error: {
            code: 'FORBIDDEN',
            message: 'This extension origin is not allowed.',
          },
        });
        expect(ensureLocalUser).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });
  });

  describe('with API_TOKEN', () => {
    it.each([
      ['a missing bearer', undefined],
      ['a malformed bearer', 'Token abc'],
      ['a wrong token', 'Bearer not-the-configured-token'],
    ])('returns the 401 envelope for %s', async (_name, authorization) => {
      stubRequiredEnvironment();
      vi.stubEnv('API_TOKEN', API_TOKEN);
      const ensureLocalUser = vi.fn(async () => localUser());
      const app = await createApp(ensureLocalUser);

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/me',
          headers: {
            host: 'localhost:3002',
            ...(authorization === undefined ? {} : { authorization }),
          },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required.',
          },
        });
        expect(ensureLocalUser).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });

    it('serves the correct token from any host name', async () => {
      stubRequiredEnvironment();
      vi.stubEnv('API_TOKEN', API_TOKEN);
      const app = await createApp();

      try {
        const response = await app.inject({
          method: 'GET',
          url: '/me',
          headers: {
            host: 'upwin.my-server.example',
            authorization: `Bearer ${API_TOKEN}`,
          },
        });

        expect(response.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    });
  });

  it('keeps public routes open without a token or an allowed host', async () => {
    stubRequiredEnvironment();
    vi.stubEnv('API_TOKEN', API_TOKEN);
    const app = await createApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { host: 'attacker.example' },
      });

      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

async function createApp(
  ensureLocalUser: () => Promise<User> = async () => localUser(),
): Promise<NestFastifyApplication> {
  // ConfigModule validates the environment when app.module is first imported,
  // so every test re-imports it to see its own stubbed variables.
  vi.resetModules();
  const { AppModule } = await import('../app.module.js');
  const { DRIZZLE } = await import('../database/database.module.js');
  const { UsersService } = await import('./users.service.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DRIZZLE)
    .useValue({})
    .overrideProvider(UsersService)
    .useValue({ ensureLocalUser })
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

function localUser(): User {
  return {
    id: LOCAL_USER_ID,
    createdAt: new Date('2026-08-18T12:00:00.000Z'),
    updatedAt: new Date('2026-08-18T12:00:00.000Z'),
  };
}

function stubRequiredEnvironment(): void {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv(
    'DATABASE_URL',
    'postgresql://upwin:password@localhost:5432/upwin',
  );
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.stubEnv('EXTENSION_ALLOWED_ORIGINS', EXTENSION_ORIGIN);
  vi.stubEnv('AI_MODE', 'fake');
  vi.stubEnv('API_TOKEN', '');
}
