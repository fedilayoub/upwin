import {
  Controller,
  Get,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { unauthenticated } from '../auth/auth.errors';
import {
  ApiExceptionFilter,
  describeCause,
  describeRequest,
} from './api-exception.filter';
import { genRequestId, isRequestId, registerRequestIdHeader } from './request-id';

@Controller('probe')
class ProbeController {
  @Get('ok')
  ok(): { ok: true } {
    return { ok: true };
  }

  @Get('denied')
  denied(): never {
    const cause = Object.assign(new Error('azp mismatch'), {
      reason: 'token-invalid-authorized-parties',
    });
    throw unauthenticated(cause);
  }

  @Get('broken')
  broken(): never {
    throw new Error('database exploded');
  }
}

const apps: NestFastifyApplication[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function createApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ genReqId: genRequestId }),
    { logger: false },
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  registerRequestIdHeader(app.getHttpAdapter().getInstance());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  apps.push(app);
  return app;
}

describe('request ids', () => {
  it('accepts only ids shaped like ours', () => {
    expect(isRequestId('0b4c3f1e-9f7a-4f5e-8f61-2b1d7c9e5a10')).toBe(true);
    expect(isRequestId('short')).toBe(false);
    expect(isRequestId('bad id with spaces')).toBe(false);
    expect(isRequestId('x'.repeat(65))).toBe(false);
    expect(isRequestId(['a-valid-request-id'])).toBe(false);
  });

  it('honours a valid incoming id and mints a uuid otherwise', () => {
    expect(
      genRequestId({ headers: { 'x-request-id': 'client-abc-123' } }),
    ).toBe('client-abc-123');
    expect(
      genRequestId({ headers: { 'x-request-id': 'evil\nline' } }),
    ).toMatch(/^[0-9a-f-]{36}$/);
    expect(genRequestId({ headers: {} })).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('puts X-Request-Id on successes and on error envelopes', async () => {
    const app = await createApp();

    const ok = await app.inject({ method: 'GET', url: '/probe/ok' });
    expect(ok.statusCode).toBe(200);
    expect(isRequestId(ok.headers['x-request-id'])).toBe(true);

    const denied = await app.inject({
      method: 'GET',
      url: '/probe/denied',
      headers: { 'x-request-id': 'report-1234-abcd' },
    });
    expect(denied.statusCode).toBe(401);
    expect(denied.headers['x-request-id']).toBe('report-1234-abcd');
    // The body keeps the frozen envelope; the cause never reaches the client.
    expect(denied.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
    });

    const missing = await app.inject({ method: 'GET', url: '/nowhere' });
    expect(missing.statusCode).toBe(404);
    expect(isRequestId(missing.headers['x-request-id'])).toBe(true);
  });

  it('hides internal error text from the client', async () => {
    const app = await createApp();
    const broken = await app.inject({ method: 'GET', url: '/probe/broken' });

    expect(broken.statusCode).toBe(500);
    expect(broken.body).not.toContain('database exploded');
    expect(isRequestId(broken.headers['x-request-id'])).toBe(true);
  });
});

describe('error log lines', () => {
  it('names the route, status, code, request id and user, never the query', () => {
    const line = describeRequest(
      {
        method: 'GET',
        url: '/videos/abc?token=secret',
        id: 'req-12345678',
        routeOptions: { url: '/videos/:id' },
        currentUser: { id: 'user-1' },
      } as never,
      404,
      'VIDEO_NOT_FOUND',
    );

    expect(line).toBe(
      'GET /videos/:id status=404 code=VIDEO_NOT_FOUND requestId=req-12345678 userId=user-1',
    );
    expect(line).not.toContain('secret');
  });

  it('falls back to the path without its query for unmatched routes', () => {
    const line = describeRequest(
      {
        method: 'POST',
        url: '/missing?share=abc',
        id: 'req-87654321',
        routeOptions: {},
      } as never,
      404,
      'NOT_FOUND',
    );
    expect(line).toBe('POST /missing status=404 code=NOT_FOUND requestId=req-87654321');
  });

  it('prints the verification reason of a 401 cause', () => {
    const cause = Object.assign(new Error('Invalid JWT "azp" claim'), {
      reason: 'token-invalid-authorized-parties',
    });

    expect(describeCause(unauthenticated(cause))).toBe(
      "token-invalid-authorized-parties: Invalid JWT 'azp' claim",
    );
    expect(describeCause(unauthenticated('missing-bearer'))).toBe(
      'missing-bearer',
    );
    expect(describeCause(new UnauthorizedException())).toBeNull();
  });

  it('logs 4xx with its cause and 5xx with the stack', async () => {
    // The filter's logger is an instance field; spy on Nest's Logger prototype.
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const app = await createApp();

    await app.inject({
      method: 'GET',
      url: '/probe/denied',
      headers: { 'x-request-id': 'trace-0001-zzzz' },
    });
    await app.inject({ method: 'GET', url: '/probe/broken' });

    expect(warn).toHaveBeenCalledWith(
      'GET /probe/denied status=401 code=UNAUTHENTICATED requestId=trace-0001-zzzz cause="token-invalid-authorized-parties: azp mismatch"',
    );
    const [errorLine] = error.mock.calls[0] ?? [];
    expect(String(errorLine)).toContain('GET /probe/broken status=500 code=INTERNAL_ERROR');
    expect(String(errorLine)).toContain('database exploded');
  });
});
