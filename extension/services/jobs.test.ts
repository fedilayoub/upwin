import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JobSnapshot } from '@/types/job';
import { apiClient } from './api';
import { jobService } from './jobs';

const snapshot: JobSnapshot = {
  source: 'upwork-dom',
  capturedAt: '2026-08-23T12:00:00.000Z',
  job: {
    ciphertext: '~0def456',
    url: 'https://www.upwork.com/jobs/~0def456',
    title: 'Synthetic job',
    description: 'Synthetic description',
    engagement: { budgetType: 'unknown' },
    skills: [],
    questions: [],
    client: { paymentVerified: null },
    activity: {},
  },
};

const receipt = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
  ciphertext: snapshot.job.ciphertext,
  capturedAt: snapshot.capturedAt,
  createdAt: '2026-08-23T12:00:01.000Z',
  truncatedFields: [],
};

const analysis = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa11',
  jobSnapshotId: receipt.id,
  goalId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa12',
  matchScore: 74,
  summary: 'A credible match.',
  dimensions: [
    'skills',
    'domain',
    'experience',
    'budget',
    'goalAlignment',
  ].map((id) => ({ id, score: 74, criteria: [] })),
  strengths: ['Relevant stack'],
  concerns: ['Budget is unclear'],
  questionCount: 0,
  versions: {
    prompt: 'job-match-v1',
    rubric: 'job-match-rubric-v1',
    scoring: 'job-match-scoring-v1',
    requestedModel: 'gpt-4.1-mini',
    gateway: 'llmgateway',
    provider: 'openai',
    model: 'openai/gpt-4.1-mini',
  },
  createdAt: '2026-08-23T12:00:02.000Z',
};

afterEach(() => vi.restoreAllMocks());

describe('real job API methods', () => {
  it('persists the captured snapshot before analysis', async () => {
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValueOnce(receipt)
      .mockResolvedValueOnce(analysis);
    const getToken = vi.fn().mockResolvedValue('session-token');

    await expect(jobService.persist(snapshot, getToken)).resolves.toEqual(
      receipt,
    );
    await expect(jobService.analyze(snapshot, getToken)).resolves.toMatchObject(
      { id: analysis.id, matchScore: 74 },
    );

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/job-snapshots',
      expect.objectContaining({
        getToken,
        method: 'POST',
        operation: 'POST /job-snapshots',
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/job-analyses',
      expect.objectContaining({
        getToken,
        method: 'POST',
        operation: 'POST /job-analyses',
      }),
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1].body))).toEqual({
      snapshot,
    });
    expect(JSON.parse(String(request.mock.calls[1]?.[1].body))).toEqual({
      snapshot,
    });
  });

  it('rejects an off-contract analysis response', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      ...analysis,
      dimensions: analysis.dimensions.slice(0, 4),
    });

    await expect(
      jobService.analyze(snapshot, vi.fn().mockResolvedValue('token')),
    ).rejects.toThrow('invalid job analysis response');
  });
});
