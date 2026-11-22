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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';
import { ZodValidationPipe } from 'nestjs-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import type { User } from '../database/schema';
import { InsightsController } from './insights.controller';
import { InsightsRepository } from './insights.repository';
import { InsightsService } from './insights.service';

const USER: User = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
  createdAt: new Date('2026-08-25T12:00:00.000Z'),
  updatedAt: new Date('2026-08-25T12:00:00.000Z'),
};
const apps: NestFastifyApplication[] = [];

const mocks = vi.hoisted(() => ({
  getProfileSummary: vi.fn(),
  listScoreSparkline: vi.fn(),
  getSuggestionStatuses: vi.fn(),
  getJobSummary: vi.fn(),
  getProposalSummary: vi.fn(),
  getOutcomeSummary: vi.fn(),
  findActiveGoal: vi.fn(),
  listRecentActivity: vi.fn(),
  listActivityDays: vi.fn(),
  getActivityTotals: vi.fn(),
  listScoreHistory: vi.fn(),
  getFunnelCounts: vi.fn(),
}));

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
  mocks.getProfileSummary.mockResolvedValue({
    analysesCount: 0,
    analysesLast30Days: 0,
    distinctGoalCount: 0,
    latestId: null,
    latestWinningScore: null,
    latestCompletenessScore: null,
    latestCreatedAt: null,
    latestSectionScores: null,
    previousWinningScore: null,
    firstWinningScore: null,
  });
  mocks.listScoreSparkline.mockResolvedValue([]);
  mocks.getSuggestionStatuses.mockResolvedValue([]);
  mocks.getJobSummary.mockResolvedValue({
    analysesCount: 0,
    analysesLast30Days: 0,
    averageMatchScore: null,
    averageMatchScoreLast30Days: null,
    highFitCount: 0,
    averageMatchScoreApplied: null,
  });
  mocks.getProposalSummary.mockResolvedValue({
    draftedCount: 0,
    draftedLast30Days: 0,
    copiedBlocks: null,
    averageProposalWords: null,
  });
  mocks.getOutcomeSummary.mockResolvedValue({
    sent: 0,
    inProgress: 0,
    viewed: 0,
    messaged: 0,
    interviewing: 0,
    hired: 0,
    declined: 0,
    noResponse: 0,
    connectsSpent: null,
  });
  mocks.findActiveGoal.mockResolvedValue(null);
  mocks.listRecentActivity.mockResolvedValue([]);
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('insights API', () => {
  it('returns INVALID_TIME_ZONE for an unknown time zone', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/insights/activity?timeZone=Mars%2FOlympus',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_TIME_ZONE',
        message: 'The time zone is invalid.',
      },
    });
    expect(mocks.listActivityDays).not.toHaveBeenCalled();
  });

  it('returns a complete zero-data summary instead of throwing', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/insights/summary',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      profile: {
        latestWinningScore: null,
        latestAnalysisId: null,
        analysesCount: 0,
        scoreSparkline: [],
        activeGoal: null,
      },
      suggestions: { copied: 0, dismissed: 0, pending: 0 },
      jobs: { analysesCount: 0, highFitCount: 0, highFitShare: 0 },
      proposals: { draftedCount: 0, copiedBlocks: 0 },
      outcomes: { sent: 0, sufficientData: false },
      recentActivity: [],
    });
  });

  it('publishes all four insights routes in OpenAPI', async () => {
    const app = await createApp();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1').build(),
    );

    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/insights/summary',
        '/insights/activity',
        '/insights/score-history',
        '/insights/funnel',
      ]),
    );
  });
});

async function createApp(): Promise<NestFastifyApplication> {
  const testingModule = await Test.createTestingModule({
    controllers: [InsightsController],
    providers: [
      { provide: APP_GUARD, useClass: TestUserGuard },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      { provide: InsightsRepository, useValue: mocks },
      InsightsService,
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
