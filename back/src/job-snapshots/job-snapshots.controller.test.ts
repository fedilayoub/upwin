import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { DRIZZLE, type Database } from '../database/database.module';
import type { User } from '../database/schema';
import { JobSnapshotsController } from './job-snapshots.controller';
import { JobSnapshotsService } from './job-snapshots.service';

const USER: User = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
  createdAt: new Date('2026-08-23T12:00:00.000Z'),
  updatedAt: new Date('2026-08-23T12:00:00.000Z'),
};
const apps: NestFastifyApplication[] = [];

@Injectable()
class TestUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    request.currentUser = USER;
    return true;
  }
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('POST /job-snapshots', () => {
  it('persists a valid snapshot and returns the contract response', async () => {
    const { app, insert } = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/job-snapshots',
      payload: { snapshot: validSnapshot() },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
      ciphertext: '~0def456',
      capturedAt: '2026-08-23T12:00:00.000Z',
      createdAt: '2026-08-23T12:00:01.000Z',
      truncatedFields: [],
    });
    expect(insert).toHaveBeenCalledOnce();
  });

  it('returns the 422 error envelope and writes nothing for invalid input', async () => {
    const { app, insert } = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/job-snapshots',
      payload: { snapshot: validSnapshot({ description: undefined }) },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'JOB_SNAPSHOT_INVALID',
        message: 'The job snapshot is invalid.',
      },
    });
    expect(insert).not.toHaveBeenCalled();
  });
});

async function createApp() {
  const returning = vi.fn().mockResolvedValue([
    {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c',
      ciphertext: '~0def456',
      capturedAt: new Date('2026-08-23T12:00:00.000Z'),
      createdAt: new Date('2026-08-23T12:00:01.000Z'),
    },
  ]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  const database = { insert } as unknown as Database;
  const testingModule = await Test.createTestingModule({
    controllers: [JobSnapshotsController],
    providers: [
      { provide: APP_GUARD, useClass: TestUserGuard },
      { provide: DRIZZLE, useValue: database },
      JobSnapshotsService,
    ],
  }).compile();
  const app = testingModule.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  apps.push(app);

  return { app, insert };
}

function validSnapshot(jobOverrides: Record<string, unknown> = {}) {
  return {
    source: 'upwork-payload',
    capturedAt: '2026-08-23T12:00:00.000Z',
    job: {
      ciphertext: '~0def456',
      url: 'https://www.upwork.com/jobs/~0def456',
      title: 'Synthetic job',
      description: 'Synthetic job description',
      engagement: {
        budgetType: 'hourly',
        hourlyBudget: { min: 15, max: 30, currency: 'USD' },
      },
      skills: [{ name: 'TypeScript', relevance: 'mandatory' }],
      questions: [],
      client: { country: 'Exampleland', paymentVerified: true },
      activity: {},
      ...jobOverrides,
    },
  };
}
