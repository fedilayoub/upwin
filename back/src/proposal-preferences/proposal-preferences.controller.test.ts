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
import { ApiExceptionFilter } from '../common/api-exception.filter';
import type { User } from '../database/schema';
import { ProposalPreferencesController } from './proposal-preferences.controller';
import { DEFAULT_PROPOSAL_PREFERENCES } from './proposal-preferences.schema';
import { ProposalPreferencesService } from './proposal-preferences.service';

const USER: User = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
  createdAt: new Date('2026-08-23T12:00:00.000Z'),
  updatedAt: new Date('2026-08-23T12:00:00.000Z'),
};
const apps: NestFastifyApplication[] = [];

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
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
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('proposal preferences API', () => {
  it('GET returns defaults with no updatedAt and no 404 when nothing is saved', async () => {
    mocks.get.mockResolvedValue({ ...DEFAULT_PROPOSAL_PREFERENCES });
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/proposal-preferences',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(DEFAULT_PROPOSAL_PREFERENCES);
    expect(mocks.get).toHaveBeenCalledWith(USER.id);
  });

  it.each([
    {
      name: 'over-length custom instructions',
      payload: {
        ...DEFAULT_PROPOSAL_PREFERENCES,
        customInstructions: 'x'.repeat(2_001),
      },
    },
    {
      name: 'an unknown proposal tone',
      payload: {
        ...DEFAULT_PROPOSAL_PREFERENCES,
        proposalTone: 'aggressive',
      },
    },
  ])('PUT returns 422 for $name', async ({ payload }) => {
    const app = await createApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/proposal-preferences',
      payload,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        code: 'UNPROCESSABLE_ENTITY',
        message: 'The proposal preferences are invalid.',
      },
    });
    expect(mocks.put).not.toHaveBeenCalled();
  });
});

async function createApp(): Promise<NestFastifyApplication> {
  const testingModule = await Test.createTestingModule({
    controllers: [ProposalPreferencesController],
    providers: [
      { provide: APP_GUARD, useClass: TestUserGuard },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      { provide: ProposalPreferencesService, useValue: mocks },
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
