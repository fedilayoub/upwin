import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { insightsService } from './insights';

const getToken = vi.fn().mockResolvedValue('session-token');

const activity = {
  timeZone: 'UTC',
  from: '2025-08-26',
  to: '2026-08-25',
  days: [{ date: '2026-08-25', drafted: 2, sent: 1, level: 3 }],
  totals: { drafted: 2, sent: 1, activeDays: 1 },
  currentStreakWeeks: 1,
  longestStreakWeeks: 2,
  maxPerDay: 2,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('insightsService response validation', () => {
  it('rejects a malformed summary response', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({ generatedAt: 'never' });

    await expect(insightsService.getInsightsSummary(getToken)).rejects.toThrow(
      'invalid insights summary response',
    );
  });

  it('rejects a heatmap level outside the frozen 0-4 range', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      ...activity,
      days: [{ ...activity.days[0], level: 5 }],
    });

    await expect(insightsService.getActivity(getToken)).rejects.toThrow(
      'invalid activity calendar response',
    );
  });

  it('sends one validated proposal outcome update', async () => {
    const analysisId = '018f6a77-4e90-7ab5-a3bf-15c8f850fa11';
    const response = {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa12',
      jobAnalysisId: analysisId,
      status: 'viewed',
      connectsSpent: null,
      sentAt: '2026-08-25T10:00:00.000Z',
      respondedAt: '2026-08-25T10:00:00.000Z',
      decidedAt: null,
      note: null,
      createdAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-08-25T10:00:00.000Z',
    };
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue(response);

    await expect(
      insightsService.putProposalOutcome(analysisId, 'viewed', getToken),
    ).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith(
      `/job-analyses/${analysisId}/outcome`,
      expect.objectContaining({
        body: JSON.stringify({ status: 'viewed' }),
        method: 'PUT',
      }),
    );
  });
});
