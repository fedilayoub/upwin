import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from '@/features/upwork/profile/schema';
import { PROFILE_SECTION_IDS } from '@/types/profile';
import { apiClient } from './api';
import { createCaptureProfile, profileService } from './profile';

const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const GOAL_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const RECOMMENDATION_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';

const snapshot: ProfileSnapshot = {
  source: 'upwork',
  capturedAt: '2026-08-18T12:00:00.000Z',
  completeness: UNREADABLE_PROFILE_COMPLETENESS,
  profile: {
    skills: [],
    portfolio: [],
    employment: [],
    education: [],
    certifications: [],
    languages: [],
  },
};

const capture = { snapshot, truncatedFields: [] };

const analysis = {
  id: ANALYSIS_ID,
  createdAt: '2026-08-20T12:00:00.000Z',
  winningScore: 72,
  completenessScore: 75,
  previousWinningScore: 65,
  goal: {
    id: GOAL_ID,
    objective: 'first-client',
    targetRole: 'Senior Frontend Developer',
  },
  summary: 'A credible profile that needs sharper target alignment.',
  strongestSection: 'trust',
  biggestOpportunity: 'goalAlignment',
  sectionScores: PROFILE_SECTION_IDS.map((id, index) => ({
    id,
    score: 55 + index,
    criteria: [],
  })),
  priorities: [
    {
      id: RECOMMENDATION_ID,
      section: 'overview',
      rank: 1,
      impact: 'high',
      estimatedMinutes: 5,
      recommendation: 'Lead with the client problem you solve.',
      reason: 'The opening starts with experience instead of outcomes.',
      evidence: ['The overview opens with a statement about experience.'],
    },
  ],
  versions: {
    prompt: 'profile-analyzer-v1',
    rubric: 'upwork-profile-v1',
    scoring: 'scoring-v1',
    requestedModel: 'gpt-4.1-mini',
    provider: 'openai',
    model: 'openai/gpt-4.1-nano',
    gateway: 'llmgateway',
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('capture', () => {
  it('validates the typed background result before returning the snapshot', async () => {
    const captureProfile = vi.fn().mockResolvedValue(capture);
    const runCapture = createCaptureProfile({ captureProfile });

    await expect(runCapture()).resolves.toEqual(capture);
    expect(captureProfile).toHaveBeenCalledOnce();
  });

  it('rejects an invalid capture result before any API call can use it', async () => {
    const runCapture = createCaptureProfile({
      captureProfile: vi.fn().mockResolvedValue({
        ...capture,
        snapshot: {
          ...snapshot,
          profile: { portfolio: [] },
        },
      }),
    });

    await expect(runCapture()).rejects.toThrow(
      'We could not read your profile',
    );
  });
});

describe('real profile analysis API methods', () => {
  it('POSTs the structured snapshot and optional goal id to the analyzer', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue(analysis);
    const getToken = vi.fn().mockResolvedValue('session-token');

    await expect(
      profileService.analyze(snapshot, getToken, GOAL_ID),
    ).resolves.toMatchObject({ id: ANALYSIS_ID, winningScore: 72 });

    expect(request).toHaveBeenCalledWith(
      '/profile-analyses',
      expect.objectContaining({
        getToken,
        method: 'POST',
        operation: 'POST /profile-analyses',
      }),
    );
    const options = request.mock.calls[0]?.[1];
    expect(JSON.parse(String(options?.body))).toEqual({
      snapshot,
      goalId: GOAL_ID,
    });
  });


  it('accepts an embedded completeness fill with no copy value', async () => {
    const fill = {
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa25',
      section: 'positioning',
      rank: 1,
      impact: 'high',
      estimatedMinutes: 15,
      recommendation: 'Add a concise introduction video.',
      reason: 'First-time clients have less profile evidence to judge you on.',
      evidence: ['Introduction video: not present.'],
      kind: 'fill',
      field: null,
      itemIndex: null,
      guidance: 'Add an introduction video for the React work you target.',
      items: ['Name the client problem you solve.'],
    };
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      ...analysis,
      priorities: [fill],
    });

    const result = await profileService.analyze(
      snapshot,
      vi.fn().mockResolvedValue('session-token'),
    );

    expect(result.priorities).toEqual([fill]);
    expect(result.priorities[0]).not.toHaveProperty('suggestedValue');
  });

  it('GETs analysis history and one owned analysis through the real paths', async () => {
    const history = {
      items: [
        {
          id: ANALYSIS_ID,
          createdAt: analysis.createdAt,
          winningScore: analysis.winningScore,
          sectionScores: analysis.sectionScores,
          goal: analysis.goal,
        },
      ],
      pageSize: 20,
      hasMore: true,
      nextCursor: 'next-cursor',
    };
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValueOnce(history)
      .mockResolvedValueOnce(analysis);
    const getToken = vi.fn().mockResolvedValue('session-token');

    await expect(
      profileService.getAnalyses(getToken, 'current-cursor'),
    ).resolves.toEqual(history);
    await expect(
      profileService.getAnalysis(ANALYSIS_ID, getToken),
    ).resolves.toEqual(analysis);

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/profile-analyses?pageSize=20&cursor=current-cursor',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      `/profile-analyses/${ANALYSIS_ID}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('GETs persisted progress and the deterministic snapshot diff', async () => {
    const progress = {
      latest: {
        id: ANALYSIS_ID,
        createdAt: analysis.createdAt,
        winningScore: 72,
      },
      deltaSinceFirst: 8,
      trend: [
        {
          id: ANALYSIS_ID,
          createdAt: analysis.createdAt,
          winningScore: 72,
        },
      ],
      sectionDeltas: analysis.sectionScores.map(({ id, score }) => ({
        id,
        firstScore: score - 2,
        latestScore: score,
        delta: 2,
      })),
    };
    const diff = {
      fromSnapshotId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa20',
      toSnapshotId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa21',
      fromCapturedAt: '2026-08-19T12:00:00.000Z',
      toCapturedAt: '2026-08-20T12:00:00.000Z',
      changes: {
        title: { status: 'changed' },
        overview: { status: 'updated' },
        portfolio: { status: 'changed', added: 1, removed: 0 },
        skills: { status: 'unchanged', added: [], removed: [] },
      },
    };
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValueOnce(progress)
      .mockResolvedValueOnce(diff);
    const getToken = vi.fn().mockResolvedValue('session-token');

    await expect(profileService.getProgress(getToken)).resolves.toEqual(
      progress,
    );
    await expect(profileService.getSnapshotDiff(getToken)).resolves.toEqual(
      diff,
    );

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/profile-analyses/progress',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/profile-snapshots/diff',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects a response that does not contain all eight unique sections', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      ...analysis,
      sectionScores: analysis.sectionScores.map((section, index) =>
        index === 7 ? analysis.sectionScores[0] : section,
      ),
    });

    await expect(
      profileService.analyze(
        snapshot,
        vi.fn().mockResolvedValue('session-token'),
      ),
    ).rejects.toThrow('invalid profile analysis response');
  });

  it('creates a suggestion and records copied status through the real paths', async () => {
    const suggestion = {
      id: RECOMMENDATION_ID,
      section: 'overview',
      kind: 'rewrite',
      field: 'overview',
      itemIndex: null,
      originalValue: 'I build interfaces.',
      suggestedValue: 'I help teams build dependable product interfaces.',
      explanation: 'Leads with the client outcome.',
      impact: 'high',
    };
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValueOnce(suggestion)
      .mockResolvedValueOnce({ id: RECOMMENDATION_ID, status: 'copied' });
    const getToken = vi.fn().mockResolvedValue('session-token');

    await expect(
      profileService.createSuggestion(
        ANALYSIS_ID,
        'overview',
        getToken,
        'concise',
      ),
    ).resolves.toEqual(suggestion);
    await expect(
      profileService.updateRecommendationStatus(
        RECOMMENDATION_ID,
        'copied',
        getToken,
      ),
    ).resolves.toEqual({ id: RECOMMENDATION_ID, status: 'copied' });

    expect(request).toHaveBeenNthCalledWith(
      1,
      `/profile-analyses/${ANALYSIS_ID}/suggestions/overview`,
      expect.objectContaining({
        method: 'POST',
        operation: 'POST /profile-analyses/:id/suggestions/:section',
      }),
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1].body))).toEqual({
      style: 'concise',
    });
    expect(request).toHaveBeenNthCalledWith(
      2,
      `/profile-recommendations/${RECOMMENDATION_ID}`,
      expect.objectContaining({
        method: 'PATCH',
        operation: 'PATCH /profile-recommendations/:id',
      }),
    );
  });

  it('accepts fill guidance only when suggestedValue is absent', async () => {
    const fillSuggestion = {
      id: RECOMMENDATION_ID,
      section: 'portfolio',
      kind: 'fill',
      field: 'portfolio',
      itemIndex: null,
      guidance: 'Add project records aligned with the configured target work.',
      items: ['React SaaS dashboard sample project'],
      explanation: 'Relevant proof reduces client uncertainty.',
      impact: 'high',
    };
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValueOnce(fillSuggestion)
      .mockResolvedValueOnce({
        ...fillSuggestion,
        suggestedValue: 'I do not have a portfolio.',
      });
    const getToken = vi.fn().mockResolvedValue('session-token');

    await expect(
      profileService.createSuggestion(
        ANALYSIS_ID,
        'portfolio',
        getToken,
        null,
      ),
    ).resolves.toEqual(fillSuggestion);
    await expect(
      profileService.createSuggestion(
        ANALYSIS_ID,
        'portfolio',
        getToken,
        null,
      ),
    ).rejects.toThrow('invalid profile suggestion response');

    expect(request).toHaveBeenCalledTimes(2);
  });
});
