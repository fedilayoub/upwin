import { describe, expect, it, vi } from 'vitest';
import { AI_GATEWAY_ID } from '../../ai/model-registry';
import type { Database } from '../../database/database.module';
import {
  profileAnalyses,
  profileRecommendations,
  profileSnapshots,
} from '../../database/schema';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from '../../profile-snapshots/profile-snapshot.schema';
import { PROFILE_SECTION_IDS } from '../profile-section';
import { ProfileAnalysesRepository } from './profile-analyses.repository';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const GOAL_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const SNAPSHOT_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';
const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1d';
const CREATED_AT = new Date('2026-08-20T12:00:00.000Z');
const snapshot: ProfileSnapshot = {
  source: 'manual',
  capturedAt: CREATED_AT.toISOString(),
  completeness: UNREADABLE_PROFILE_COMPLETENESS,
  profile: {
    title: 'React Developer',
    skills: ['React'],
    portfolio: [],
    employment: [],
    education: [],
    certifications: [],
    languages: [],
  },
};
const sectionScores = PROFILE_SECTION_IDS.map((id) => ({
  id,
  score: 72,
  criteria: [],
}));

describe('ProfileAnalysesRepository.persist', () => {
  it('writes snapshot, analysis, and every recommendation through one transaction handle', async () => {
    const insertedTables: unknown[] = [];
    const insertedValues = new Map<unknown, unknown>();
    const analysisRow = {
      id: ANALYSIS_ID,
      userId: USER_ID,
      goalId: GOAL_ID,
      profileSnapshotId: SNAPSHOT_ID,
      winningScore: 72,
      completenessScore: null,
      sectionScores,
      summary: 'Summary',
      promptVersion: 'profile-analyzer-v1',
      rubricVersion: 'upwork-profile-v1',
      scoringVersion: 'scoring-v1',
      requestedModel: 'requested-model',
      gateway: AI_GATEWAY_ID,
      provider: 'served-upstream',
      model: 'served-upstream/served-model',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      createdAt: CREATED_AT,
    };
    const recommendationRow = {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1e',
      analysisId: ANALYSIS_ID,
      section: 'overview' as const,
      rank: 1,
      impact: 'high' as const,
      estimatedMinutes: 10,
      reason: 'Reason',
      evidence: ['Captured profile evidence.'],
      recommendation: 'Recommendation',
      originalValue: null,
      suggestedValue: null,
      status: 'pending' as const,
      createdAt: CREATED_AT,
    };
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ winningScore: 65 }]),
            }),
          }),
        }),
      }),
      insert: vi.fn((table: unknown) => {
        insertedTables.push(table);
        return {
          values: vi.fn((values: unknown) => {
            insertedValues.set(table, values);
            return {
              returning: vi
                .fn()
                .mockResolvedValue(
                  table === profileSnapshots
                    ? [{ id: SNAPSHOT_ID }]
                    : table === profileAnalyses
                      ? [analysisRow]
                      : [recommendationRow],
                ),
            };
          }),
        };
      }),
    };
    const transaction = vi.fn(
      async (callback: (handle: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const repository = new ProfileAnalysesRepository({
      transaction,
    } as unknown as Database);

    await expect(
      repository.persist({
        userId: USER_ID,
        goalId: GOAL_ID,
        snapshot,
        winningScore: 72,
        completenessScore: null,
        sectionScores,
        summary: 'Summary',
        promptVersion: 'profile-analyzer-v1',
        rubricVersion: 'upwork-profile-v1',
        scoringVersion: 'scoring-v1',
        requestedModel: 'requested-model',
        gateway: AI_GATEWAY_ID,
        provider: 'served-upstream',
        model: 'served-upstream/served-model',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        recommendations: [
          {
            signal: 'introVideo',
            section: 'positioning',
            rank: 1,
            impact: 'high',
            estimatedMinutes: 15,
            reason: 'Reason',
            evidence: ['Introduction video: not present.'],
            recommendation: 'Recommendation',
            kind: 'fill',
            field: null,
            itemIndex: null,
            guidance: 'Add an introduction video for the work you target.',
            items: ['Name the client problem you solve.'],
          },
        ],
      }),
    ).resolves.toMatchObject({
      analysis: analysisRow,
      recommendations: [recommendationRow],
      previousWinningScore: 65,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(insertedTables).toEqual([
      profileSnapshots,
      profileAnalyses,
      profileRecommendations,
    ]);
    expect(insertedValues.get(profileSnapshots)).toMatchObject({
      userId: USER_ID,
      completeness: UNREADABLE_PROFILE_COMPLETENESS,
      title: 'React Developer',
    });
    expect(insertedValues.get(profileAnalyses)).toMatchObject({
      profileSnapshotId: SNAPSHOT_ID,
      completenessScore: null,
      promptVersion: 'profile-analyzer-v1',
      rubricVersion: 'upwork-profile-v1',
      scoringVersion: 'scoring-v1',
      requestedModel: 'requested-model',
      gateway: AI_GATEWAY_ID,
      provider: 'served-upstream',
      model: 'served-upstream/served-model',
    });
    expect(insertedValues.get(profileRecommendations)).toEqual([
      expect.objectContaining({
        section: 'positioning',
        kind: 'fill',
        field: null,
        itemIndex: null,
        guidance: 'Add an introduction video for the work you target.',
        items: ['Name the client problem you solve.'],
        evidence: ['Introduction video: not present.'],
      }),
    ]);
  });
});
