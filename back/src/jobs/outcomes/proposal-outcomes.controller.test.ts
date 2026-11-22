import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import { ZodValidationPipe } from 'nestjs-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../../common/api-exception.filter';
import type { User } from '../../database/schema';
import { JobAnalysesRepository } from '../analysis/job-analyses.repository';
import { ProposalOutcomesController } from './proposal-outcomes.controller';
import { ProposalOutcomesRepository } from './proposal-outcomes.repository';
import { ProposalOutcomesService } from './proposal-outcomes.service';

const USER: User = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
  createdAt: new Date('2026-08-25T12:00:00.000Z'),
  updatedAt: new Date('2026-08-25T12:00:00.000Z'),
};
const OTHER_ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const OUTCOME_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';
const CREATED_AT = new Date('2026-09-01T10:00:00.000Z');
const UPDATED_AT = new Date('2026-09-01T11:00:00.000Z');
const apps: NestFastifyApplication[] = [];

const outcomeMocks = vi.hoisted(() => ({
  findLatestDraftId: vi.fn(),
  upsert: vi.fn(),
  list: vi.fn(),
  stats: vi.fn(),
}));
const analysisMocks = vi.hoisted(() => ({ findById: vi.fn() }));

@Injectable()
class TestUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    request.currentUser = USER;
    return true;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('proposal outcomes API', () => {
  it("returns 404 for a job analysis the current user doesn't own", async () => {
    analysisMocks.findById.mockResolvedValue(null);
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: `/job-analyses/${OTHER_ANALYSIS_ID}/outcome`,
      payload: { status: 'sent' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Job analysis not found.' },
    });
    expect(analysisMocks.findById).toHaveBeenCalledWith(
      USER.id,
      OTHER_ANALYSIS_ID,
    );
    expect(outcomeMocks.upsert).not.toHaveBeenCalled();
  });

  it('returns OUTCOME_INVALID for a body outside the closed status set', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: `/job-analyses/${OTHER_ANALYSIS_ID}/outcome`,
      payload: { status: 'replied' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'OUTCOME_INVALID',
        message: 'The proposal outcome is invalid.',
      },
    });
    expect(analysisMocks.findById).not.toHaveBeenCalled();
  });

  it('parses and applies a deduped comma-separated status filter', async () => {
    outcomeMocks.list.mockResolvedValue({
      records: [
        {
          outcome: {
            id: OUTCOME_ID,
            userId: USER.id,
            jobAnalysisId: OTHER_ANALYSIS_ID,
            proposalDraftId: null,
            status: 'in-progress',
            connectsSpent: null,
            sentAt: null,
            respondedAt: null,
            decidedAt: null,
            note: null,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
          },
          jobTitle: 'Synthetic application',
          jobUrl: 'https://www.upwork.com/jobs/~synthetic',
          matchScore: 81,
          cursorCreatedAt: CREATED_AT.toISOString(),
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/proposal-outcomes?status=sent,hired,sent',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        {
          id: OUTCOME_ID,
          status: 'in-progress',
          sentAt: null,
          createdAt: CREATED_AT.toISOString(),
          updatedAt: UPDATED_AT.toISOString(),
        },
      ],
    });
    expect(outcomeMocks.list).toHaveBeenCalledWith(USER.id, undefined, 20, [
      'sent',
      'hired',
    ]);
  });

  it('returns OUTCOME_INVALID for an unknown list status', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/proposal-outcomes?status=bogus',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'OUTCOME_INVALID',
        message: 'The proposal outcome is invalid.',
      },
    });
    expect(outcomeMocks.list).not.toHaveBeenCalled();
  });

  it('returns every status key at zero for a fresh account', async () => {
    outcomeMocks.stats.mockResolvedValue({
      total: 0,
      applied: 0,
      inProgress: 0,
      sent: 0,
      viewed: 0,
      messaged: 0,
      interviewing: 0,
      hired: 0,
      declined: 0,
      noResponse: 0,
    });
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/proposal-outcomes/stats',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      window: '30d',
      total: 0,
      applied: 0,
      counts: {
        'in-progress': 0,
        sent: 0,
        viewed: 0,
        messaged: 0,
        interviewing: 0,
        hired: 0,
        declined: 0,
        'no-response': 0,
      },
    });
    expect(outcomeMocks.stats).toHaveBeenCalledWith(USER.id, expect.any(Date));
  });
});

async function createApp(): Promise<NestFastifyApplication> {
  const testingModule = await Test.createTestingModule({
    controllers: [ProposalOutcomesController],
    providers: [
      { provide: APP_GUARD, useClass: TestUserGuard },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      { provide: ProposalOutcomesRepository, useValue: outcomeMocks },
      { provide: JobAnalysesRepository, useValue: analysisMocks },
      ProposalOutcomesService,
    ],
  }).compile();
  const app = testingModule.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  apps.push(app);
  return app;
}
