import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { setup } from '../../test/videos/setup-videos';
import { USER_ID, VIDEO_ID } from '../../test/videos/video-test-helpers';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { PublicVideosController } from './public-videos.controller';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
const apps: NestFastifyApplication[] = [];
@Injectable()
class TestUserGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    req.currentUser = {
      id: USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return true;
  }
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function createApp(patch: Parameters<typeof setup>[0] = {}) {
  const s = setup(patch);
  const module = await Test.createTestingModule({
    controllers: [VideosController, PublicVideosController],
    providers: [
      { provide: VideosService, useValue: s.service },
      { provide: ConfigService, useValue: s.config },
      { provide: APP_GUARD, useClass: TestUserGuard },
    ],
  }).compile();
  const app = module.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  apps.push(app);
  return { ...s, app };
}
describe('video HTTP contract', () => {
  it('returns 201 on create and uses the existing safe error envelope', async () => {
    const s = await createApp();
    const response = await s.app.inject({
      method: 'POST',
      url: '/videos',
      payload: {
        sourceKind: 'tab',
        hasCamera: true,
        hasAudio: false,
        mimeType: 'video/mp4',
        title: ' Demo ',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json<{ video: { title: string } }>().video.title).toBe(
      'Demo',
    );
    const invalid = await s.app.inject({
      method: 'POST',
      url: '/videos',
      payload: { sourceKind: 'tab', mimeType: 'text/html' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The video request is invalid.',
      },
    });
  });
  it.each([{ limit: 51 }, { limit: 0 }, { jobSnapshotId: 'invalid' }])(
    'validates list query %j',
    async (query) => {
      const s = await createApp();
      const response = await s.app.inject({
        method: 'GET',
        url: `/videos?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)] as [string, string])).toString()}`,
      });
      expect(response.statusCode).toBe(400);
    },
  );
  it('trims updates and enforces title length', async () => {
    const s = await createApp();
    const ok = await s.app.inject({
      method: 'PATCH',
      url: `/videos/${VIDEO_ID}`,
      payload: { title: ' Updated ' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json<{ video: { title: string } }>().video.title).toBe('Updated');
    for (const title of [' ', 'a'.repeat(121)])
      expect(
        (
          await s.app.inject({
            method: 'PATCH',
            url: `/videos/${VIDEO_ID}`,
            payload: { title },
          })
        ).statusCode,
      ).toBe(400);
  });
  it('sends no-store on public responses and null URLs while processing', async () => {
    const s = await createApp({ status: 'processing' });
    const response = await s.app.inject({
      method: 'GET',
      url: `/public/videos/${s.row.slug}`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      status: 'processing',
      playbackUrl: null,
      posterUrl: null,
    });
    const missing = await s.app.inject({
      method: 'GET',
      url: '/public/videos/invalid',
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['cache-control']).toBe('no-store');
  });
  it('returns 200 on parts, complete and views, and 204 on abort, delete and progress', async () => {
    const s = await createApp();
    expect(
      (
        await s.app.inject({
          method: 'POST',
          url: `/videos/${VIDEO_ID}/upload-parts`,
          payload: { partNumbers: [1] },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await s.app.inject({
          method: 'GET',
          url: `/videos/${VIDEO_ID}/upload-parts`,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await s.app.inject({
          method: 'POST',
          url: `/videos/${VIDEO_ID}/complete`,
          payload: {
            parts: [
              { partNumber: 1, etag: '"a"' },
              { partNumber: 2, etag: '"b"' },
            ],
            clientDurationMs: 100,
          },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await s.app.inject({ method: 'DELETE', url: `/videos/${VIDEO_ID}` }))
        .statusCode,
    ).toBe(204);
    // A view always answers 200 with what happened, so the share page can report progress.
    const view = await s.app.inject({
      method: 'POST',
      url: '/public/videos/unknown/views',
    });
    expect(view.statusCode).toBe(200);
    expect(view.json()).toEqual({ counted: false, owner: false, viewId: null });
    // Progress always answers 204, whatever the input.
    expect(
      (
        await s.app.inject({
          method: 'POST',
          url: '/public/videos/unknown/views/not-a-uuid/progress',
          payload: { junk: true },
        })
      ).statusCode,
    ).toBe(204);
    const other = await createApp();
    expect(
      (
        await other.app.inject({
          method: 'DELETE',
          url: `/videos/${VIDEO_ID}/upload`,
        })
      ).statusCode,
    ).toBe(204);
  });
});
