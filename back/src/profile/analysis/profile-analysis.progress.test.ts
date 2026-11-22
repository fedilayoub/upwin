import { describe, expect, it, vi } from 'vitest';
import type { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import type { GoalsService } from '../../goals/goals.service';
import { PROFILE_SECTION_IDS } from '../profile-section';
import type { ProfileEvaluator } from './profile-evaluator.service';
import type { ProfileAnalysesRepository } from './profile-analyses.repository';
import { ProfileAnalysesService } from './profile-analyses.service';

const FIRST_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const LATEST_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';

describe('ProfileAnalysesService.progress', () => {
  it('returns no delta for a single persisted analysis', async () => {
    const service = serviceWithRows([record(FIRST_ID, 64, 50)]);

    await expect(service.progress('user-id')).resolves.toMatchObject({
      latest: { id: FIRST_ID, winningScore: 64 },
      deltaSinceFirst: null,
      trend: [{ id: FIRST_ID, winningScore: 64 }],
      sectionDeltas: PROFILE_SECTION_IDS.map((id) => ({
        id,
        firstScore: 50,
        latestScore: 50,
        delta: null,
      })),
    });
  });

  it('computes the score trend and section deltas from persisted rows', async () => {
    const service = serviceWithRows([
      record(FIRST_ID, 64, 50),
      record(LATEST_ID, 84, 72),
    ]);

    const progress = await service.progress('user-id');

    expect(progress.deltaSinceFirst).toBe(20);
    expect(progress.trend.map(({ winningScore }) => winningScore)).toEqual([
      64, 84,
    ]);
    expect(progress.sectionDeltas).toEqual(
      PROFILE_SECTION_IDS.map((id) => ({
        id,
        firstScore: 50,
        latestScore: 72,
        delta: 22,
      })),
    );
  });

  it('returns an empty summary when no persisted analyses exist', async () => {
    const service = serviceWithRows([]);

    await expect(service.progress('user-id')).resolves.toEqual({
      latest: null,
      deltaSinceFirst: null,
      trend: [],
      sectionDeltas: [],
    });
  });
});

function serviceWithRows(
  rows: Array<{
    id: string;
    createdAt: Date;
    winningScore: number;
    sectionScores: Array<{
      id: (typeof PROFILE_SECTION_IDS)[number];
      score: number;
    }>;
  }>,
): ProfileAnalysesService {
  const repository = {
    listForProgress: vi.fn().mockResolvedValue(rows),
  } as unknown as ProfileAnalysesRepository;

  return new ProfileAnalysesService(
    {} as GoalsService,
    {} as FreelancerContextService,
    {} as ProfileEvaluator,
    repository,
  );
}

function record(id: string, winningScore: number, sectionScore: number) {
  return {
    id,
    createdAt: new Date(
      id === FIRST_ID ? '2026-08-20T12:00:00.000Z' : '2026-08-21T12:00:00.000Z',
    ),
    winningScore,
    sectionScores: PROFILE_SECTION_IDS.map((sectionId) => ({
      id: sectionId,
      score: sectionScore,
    })),
  };
}
