import type { LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { ModelRegistryService } from '../../ai/model-registry.service';
import {
  buildModelRegistry,
  type AiModelRegistry,
} from '../../ai/model-registry';
import type { FreelancerContextFields } from '../../freelancer-context/freelancer-context.schema';
import type { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import type { GoalResponse } from '../../goals/goals.service';
import type { GoalsService } from '../../goals/goals.service';
import type {
  ProfileRecommendationRow,
  ProfileSnapshotRow,
} from '../../database/schema';
import { UNREADABLE_PROFILE_COMPLETENESS } from '../../profile-snapshots/profile-snapshot.schema';
import { ProfileImprover } from './profile-improver.service';
import { UPWORK_TITLE_MAX_LENGTH } from './profile-suggestion.schema';
import { SUGGESTION_VARIANT_INDEX } from './profile-suggestions.repository';
import type {
  PersistProfileSuggestionInput,
  ProfileSuggestionsRepository,
} from './profile-suggestions.repository';
import { ProfileSuggestionsService } from './profile-suggestions.service';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a';
const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b';
const SNAPSHOT_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1c';
const RECOMMENDATION_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa1d';
const CREATED_AT = new Date('2026-08-21T12:00:00.000Z');

const goal: GoalResponse = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1e',
  objective: 'higher-paying-projects',
  targetRole: 'Senior React SaaS Developer',
  targetProjectTypes: ['React SaaS dashboards'],
  targetClients: ['B2B SaaS teams'],
  preferredSkills: ['React', 'TypeScript'],
  targetRate: { min: 90 },
  isActive: true,
  createdAt: CREATED_AT.toISOString(),
  updatedAt: CREATED_AT.toISOString(),
};

const contextWithoutMetrics: FreelancerContextFields = {
  experience: { roles: [] },
  skills: ['React', 'TypeScript'],
  portfolio: [],
  preferences: {},
  positioning: { targetRole: 'Frontend Developer' },
};

const snapshotWithoutMetrics: ProfileSnapshotRow = {
  id: SNAPSHOT_ID,
  userId: USER_ID,
  source: 'manual',
  completeness: UNREADABLE_PROFILE_COMPLETENESS,
  name: null,
  title: 'Frontend Developer',
  overview: 'I build dependable product interfaces for growing teams.',
  hourlyRate: null,
  skills: ['React', 'TypeScript'],
  portfolio: [],
  employment: [],
  education: [],
  certifications: [],
  languages: [],
  capturedAt: CREATED_AT,
  createdAt: CREATED_AT,
};

describe('ProfileSuggestionsService', () => {
  it('generates for a section not flagged by the analysis, then reuses the saved suggestion', async () => {
    let saved: ProfileRecommendationRow | null = null;
    const persistSuggestion = vi.fn(
      async (input: PersistProfileSuggestionInput) => {
        saved = suggestionRow(input, RECOMMENDATION_ID);
        return saved;
      },
    );
    const findExistingSuggestion = vi.fn(async () => saved);
    const service = serviceWith({
      findExistingSuggestion,
      persistSuggestion,
      improver: fakeImprover(),
    });

    const first = await service.create(USER_ID, ANALYSIS_ID, 'overview', {
      style: null,
    });
    const second = await service.create(USER_ID, ANALYSIS_ID, 'overview', {
      style: null,
    });

    if (first.kind !== 'rewrite' || second.kind !== 'rewrite') {
      throw new Error('Expected overview suggestions to be rewrites.');
    }
    // Reopening the priority must show the same advice, without a second AI
    // call and without writing a second row.
    expect(second).toEqual(first);
    expect(persistSuggestion).toHaveBeenCalledTimes(1);
    expect(first.suggestedValue).not.toMatch(/\d/);
    expect(first).not.toHaveProperty('insertTarget');
    expect(persistSuggestion).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        suggestionStyle: 'default',
        promptVersion: 'profile-improver-v4',
        kind: 'rewrite',
        itemIndex: null,
        provider: 'fake',
        model: 'fake/profileImprover',
      }),
    );
  });

  it('rejects a numeric claim absent from confirmed context and snapshot, then persists nothing', async () => {
    const persistSuggestion = vi.fn();
    const service = serviceWith({
      persistSuggestion,
      improver: improverReturning({
        suggestedValue: 'I improved client results by 47 percent.',
        guidance: null,
        items: null,
        explanation: 'Adds a concrete outcome.',
        impact: 'high',
      }),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'overview', { style: null }),
    ).rejects.toMatchObject({
      response: { code: 'AI_EVALUATION_FAILED' },
      status: 502,
    });
    expect(persistSuggestion).not.toHaveBeenCalled();
  });

  it('maps off-schema model output to AI_EVALUATION_FAILED and persists nothing', async () => {
    const persistSuggestion = vi.fn();
    const fallback = modelThatThrows(
      new Error('Validation failures must not use fallback.'),
    );
    const service = serviceWith({
      persistSuggestion,
      improver: improverFromModels(
        modelThatReturns({ suggestedValue: 42 }),
        fallback,
      ),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'overview', { style: null }),
    ).rejects.toMatchObject({
      response: { code: 'AI_EVALUATION_FAILED' },
      status: 502,
    });
    expect(persistSuggestion).not.toHaveBeenCalled();
    expect(fallback.doGenerateCalls).toHaveLength(0);
  });

  it('returns an empty portfolio as fill guidance with items and no suggestedValue', async () => {
    const persistSuggestion = vi.fn(
      async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
    );
    const service = serviceWith({
      persistSuggestion,
      improver: improverReturning({
        suggestedValue: null,
        guidance:
          'Add target-relevant project records that make your React SaaS focus concrete.',
        items: [
          'React SaaS dashboard sample project',
          'B2B product workflow sample',
        ],
        explanation:
          'Creates proof aligned with the higher-paying work you are targeting.',
        impact: 'high',
      }),
    });

    const result = await service.create(USER_ID, ANALYSIS_ID, 'portfolio', {
      style: null,
    });

    expect(result).toMatchObject({
      kind: 'fill',
      field: 'portfolio',
      itemIndex: null,
      items: [
        'React SaaS dashboard sample project',
        'B2B product workflow sample',
      ],
    });
    expect(result).not.toHaveProperty('suggestedValue');
    expect(JSON.stringify(result)).not.toMatch(
      /don't have|do not have|no portfolio|not have a portfolio/i,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /\b(?:built|created|delivered|developed|launched)\b/i,
    );
    expect(persistSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'fill',
        suggestedValue: null,
        guidance:
          'Add target-relevant project records that make your React SaaS focus concrete.',
        items: [
          'React SaaS dashboard sample project',
          'B2B product workflow sample',
        ],
      }),
    );
  });

  it.each([
    {
      guidance: 'Currently, I do not have a portfolio to showcase.',
      items: ['Add a React SaaS dashboard project'],
      name: 'language that advertises the absence',
    },
    {
      guidance: 'Show target-relevant proof.',
      items: ['Built 3 React SaaS dashboards'],
      name: 'a past-tense achievement claim',
    },
    {
      guidance: 'Create a target-relevant project concept.',
      items: ['Highlight the specific features you developed.'],
      name: 'a past-tense claim embedded in an instruction',
    },
    {
      guidance: 'Add a portfolio showcasing case studies.',
      items: ['Add detailed descriptions of your work on SaaS projects.'],
      name: 'an implied existing case study for an empty portfolio',
    },
  ])(
    'rejects portfolio fill output containing $name',
    async ({ guidance, items }) => {
      const persistSuggestion = vi.fn();
      const service = serviceWith({
        persistSuggestion,
        improver: improverReturning({
          suggestedValue: null,
          guidance,
          items,
          explanation: 'Supports the target work.',
          impact: 'high',
        }),
      });

      await expect(
        service.create(USER_ID, ANALYSIS_ID, 'portfolio', { style: null }),
      ).rejects.toMatchObject({
        response: { code: 'AI_EVALUATION_FAILED' },
        status: 502,
      });
      expect(persistSuggestion).not.toHaveBeenCalled();
    },
  );

  it('keeps a populated portfolio as a field-level fill with no current text', async () => {
    const populatedSnapshot: ProfileSnapshotRow = {
      ...snapshotWithoutMetrics,
      portfolio: [
        {
          title: 'SaaS operations dashboard',
          description:
            'A React dashboard for operations teams with typed data workflows and accessible components.',
          skills: ['React', 'TypeScript'],
        },
      ],
    };
    const persistSuggestion = vi.fn(
      async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
    );
    const service = serviceWith({
      findSource: vi.fn().mockResolvedValue({
        snapshot: populatedSnapshot,
        goalId: goal.id,
      }),
      persistSuggestion,
      improver: improverReturning({
        suggestedValue: null,
        guidance:
          'Add another project that makes the target SaaS work easy to recognize.',
        items: ['B2B SaaS workflow sample'],
        explanation:
          'Adds goal-aligned proof without inventing profile description text.',
        impact: 'high',
      }),
    });

    const result = await service.create(USER_ID, ANALYSIS_ID, 'portfolio', {
      style: null,
    });

    expect(result).toMatchObject({
      kind: 'fill',
      field: 'portfolio',
      itemIndex: null,
      items: ['B2B SaaS workflow sample'],
    });
    expect(result).not.toHaveProperty('originalValue');
    expect(result).not.toHaveProperty('suggestedValue');
    expect(persistSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'fill',
        itemIndex: null,
        originalValue: null,
        suggestedValue: null,
      }),
    );
  });

  it('accepts only backend-ranked missing CV project titles', async () => {
    const contextWithProjects: FreelancerContextFields = {
      ...contextWithoutMetrics,
      portfolio: [
        { title: 'React SaaS dashboard', skills: ['React', 'TypeScript'] },
        { title: 'TypeScript design system', skills: ['TypeScript'] },
      ],
    };
    const persistSuggestion = vi.fn();
    const service = serviceWith({
      findConfirmedByUserId: vi.fn().mockResolvedValue(contextWithProjects),
      persistSuggestion,
      improver: improverReturning({
        suggestedValue: null,
        guidance: 'Publish the strongest CV project for the configured goal.',
        items: ['Invented portfolio project'],
        explanation: 'Makes the target work visible.',
        impact: 'high',
      }),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'portfolio', { style: null }),
    ).rejects.toMatchObject({
      response: { code: 'AI_EVALUATION_FAILED' },
      status: 502,
    });
    expect(persistSuggestion).not.toHaveBeenCalled();
  });

  it('accepts a subset of the ranked titles rather than demanding all of them', async () => {
    const contextWithProjects: FreelancerContextFields = {
      ...contextWithoutMetrics,
      portfolio: [
        { title: 'React SaaS dashboard', skills: ['React', 'TypeScript'] },
        { title: 'TypeScript design system', skills: ['TypeScript'] },
        { title: 'Marketing website', skills: ['CSS'] },
      ],
    };
    const service = serviceWith({
      findConfirmedByUserId: vi.fn().mockResolvedValue(contextWithProjects),
      persistSuggestion: vi.fn(async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
      ),
      improver: improverReturning({
        suggestedValue: null,
        guidance: 'Publish the closest CV projects for the configured goal.',
        items: ['React SaaS dashboard'],
        explanation: 'Leads with the strongest target match.',
        impact: 'high',
      }),
    });

    // Every item is a real ranked title, so the suggestion is grounded. Naming
    // two of three is an editorial choice, not a contract violation.
    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'portfolio', { style: null }),
    ).resolves.toMatchObject({
      items: ['React SaaS dashboard'],
    });
  });

  it('accepts the ranked titles in any order', async () => {
    const contextWithProjects: FreelancerContextFields = {
      ...contextWithoutMetrics,
      portfolio: [
        { title: 'React SaaS dashboard', skills: ['React', 'TypeScript'] },
        { title: 'Marketing website', skills: ['CSS'] },
      ],
    };
    const service = serviceWith({
      findConfirmedByUserId: vi.fn().mockResolvedValue(contextWithProjects),
      persistSuggestion: vi.fn(async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
      ),
      improver: improverReturning({
        suggestedValue: null,
        guidance: 'Publish these CV projects.',
        items: ['Marketing website', 'React SaaS dashboard'],
        explanation: 'Both make the target work visible.',
        impact: 'high',
      }),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'portfolio', { style: null }),
    ).resolves.toMatchObject({
      kind: 'fill',
    });
  });

  it('persists the exact backend-ranked missing CV project titles', async () => {
    const contextWithProjects: FreelancerContextFields = {
      ...contextWithoutMetrics,
      portfolio: [
        { title: 'Marketing website', skills: ['CSS'] },
        { title: 'React SaaS dashboard', skills: ['React', 'TypeScript'] },
      ],
    };
    const persistSuggestion = vi.fn(
      async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
    );
    const service = serviceWith({
      findConfirmedByUserId: vi.fn().mockResolvedValue(contextWithProjects),
      persistSuggestion,
      improver: improverReturning({
        suggestedValue: null,
        guidance:
          'Publish these CV projects so the target React SaaS work is visible.',
        items: ['React SaaS dashboard', 'Marketing website'],
        explanation: 'Prioritizes the closest target match first.',
        impact: 'high',
      }),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'portfolio', { style: null }),
    ).resolves.toMatchObject({
      kind: 'fill',
      itemIndex: null,
      items: ['React SaaS dashboard', 'Marketing website'],
    });
    expect(persistSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        items: ['React SaaS dashboard', 'Marketing website'],
      }),
    );
  });

  // Replaces a test that asserted a 502 here. A fully published portfolio is
  // the good state, so failing the request punishes the user for being done:
  // the schema requires at least one item, so "return nothing" cannot be
  // satisfied and every press of the button 502s. The honest answer is new work
  // to build next, never a rename or re-description of a published project.
  it('recommends new concept work when every titled CV project is published', async () => {
    const coveredProject = {
      title: 'React SaaS dashboard',
      skills: ['React', 'TypeScript'],
    };
    const contextWithCoveredProject: FreelancerContextFields = {
      ...contextWithoutMetrics,
      portfolio: [coveredProject],
    };
    const persistSuggestion = vi.fn(
      async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
    );
    const service = serviceWith({
      findSource: vi.fn().mockResolvedValue({
        snapshot: {
          ...snapshotWithoutMetrics,
          portfolio: [coveredProject],
        },
        goalId: goal.id,
      }),
      findConfirmedByUserId: vi
        .fn()
        .mockResolvedValue(contextWithCoveredProject),
      persistSuggestion,
      improver: improverReturning({
        suggestedValue: null,
        guidance: 'Build one more project aimed at the configured goal.',
        items: ['Create a React SaaS onboarding flow sample'],
        explanation: 'Adds target-shaped proof beyond what is published.',
        impact: 'medium',
      }),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'portfolio', { style: null }),
    ).resolves.toMatchObject({
      kind: 'fill',
    });
    expect(persistSuggestion).toHaveBeenCalled();
  });

  it('always treats skills as fill tags rather than prose', async () => {
    const persistSuggestion = vi.fn(
      async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
    );
    const service = serviceWith({
      persistSuggestion,
      improver: improverReturning({
        suggestedValue: null,
        guidance: 'Add tags that reinforce the configured React SaaS target.',
        items: ['React', 'TypeScript', 'SaaS'],
        explanation: 'Keeps the tag picker focused on the target work.',
        impact: 'medium',
      }),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'skills', { style: null }),
    ).resolves.toMatchObject({
      kind: 'fill',
      field: 'skills',
      items: ['React', 'TypeScript', 'SaaS'],
    });
    expect(persistSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'fill', originalValue: null }),
    );
  });

  it('resamples once when the model writes prose into a skills fill, instead of failing the request', async () => {
    const persistSuggestion = vi.fn(
      async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
    );
    const prose = {
      suggestedValue: null,
      guidance: 'Add tags that reinforce the configured React SaaS target.',
      items: [
        'Add React to your skills so clients can find you.',
        'Showcase your TypeScript experience.',
      ],
      explanation: 'Keeps the tag picker focused on the target work.',
      impact: 'medium',
    };
    const tags = {
      ...prose,
      items: ['React', 'TypeScript'],
    };
    const service = serviceWith({
      persistSuggestion,
      improver: improverFromModels(
        modelThatReturnsInTurn([prose, tags]),
        modelThatThrows(new Error('Fallback should not be needed.')),
      ),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'skills', { style: null }),
    ).resolves.toMatchObject({
      kind: 'fill',
      items: ['React', 'TypeScript'],
    });
    expect(persistSuggestion).toHaveBeenCalledTimes(1);
  });

  it('still fails when resampling produces prose again, and persists nothing', async () => {
    const persistSuggestion = vi.fn();
    const prose = {
      suggestedValue: null,
      guidance: 'Add tags that reinforce the configured React SaaS target.',
      items: ['Add React to your skills so clients can find you.'],
      explanation: 'Keeps the tag picker focused on the target work.',
      impact: 'medium',
    };
    const service = serviceWith({
      persistSuggestion,
      improver: improverReturning(prose),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'skills', { style: null }),
    ).rejects.toMatchObject({
      response: { code: 'AI_EVALUATION_FAILED' },
    });
    expect(persistSuggestion).not.toHaveBeenCalled();
  });

  it('rejects an overview rewrite that is only a small fraction of the current field', async () => {
    const longOverview = Array.from(
      { length: 40 },
      () => 'I build reliable React product interfaces for growing SaaS teams.',
    ).join(' ');
    const persistSuggestion = vi.fn();
    const service = serviceWith({
      findSource: vi.fn().mockResolvedValue({
        snapshot: { ...snapshotWithoutMetrics, overview: longOverview },
        goalId: goal.id,
      }),
      persistSuggestion,
      improver: improverReturning({
        suggestedValue: 'I build reliable SaaS interfaces.',
        guidance: null,
        items: null,
        explanation: 'A shorter opening.',
        impact: 'high',
      }),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'overview', { style: null }),
    ).rejects.toMatchObject({
      response: { code: 'AI_EVALUATION_FAILED' },
      status: 502,
    });
    expect(persistSuggestion).not.toHaveBeenCalled();
  });

  it('resamples a title rewrite that exceeds the 70-character Upwork limit', async () => {
    const persistSuggestion = vi.fn(
      async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
    );
    const tooLong =
      'React and TypeScript Frontend Developer Building SaaS Dashboards for Growing Startups';
    const withinLimit = 'React SaaS Frontend Developer for Startup Dashboards';
    const service = serviceWith({
      persistSuggestion,
      improver: improverFromModels(
        modelThatReturnsInTurn([
          titleRewrite(tooLong),
          titleRewrite(withinLimit),
        ]),
        modelThatThrows(new Error('Fallback should not be needed.')),
      ),
    });

    expect(tooLong.length).toBeGreaterThan(UPWORK_TITLE_MAX_LENGTH);
    expect(withinLimit.length).toBeLessThanOrEqual(UPWORK_TITLE_MAX_LENGTH);
    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'title', { style: null }),
    ).resolves.toMatchObject({
      kind: 'rewrite',
      suggestedValue: withinLimit,
    });
    expect(persistSuggestion).toHaveBeenCalledTimes(1);
  });

  it('accepts a title rewrite of exactly the Upwork limit', async () => {
    const exact = 'a'.repeat(UPWORK_TITLE_MAX_LENGTH);
    const service = serviceWith({
      persistSuggestion: vi.fn(async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
      ),
      improver: improverReturning(titleRewrite(exact)),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'title', { style: null }),
    ).resolves.toMatchObject({
      suggestedValue: exact,
    });
  });

  it('fails without persisting when every title sample is too long', async () => {
    const persistSuggestion = vi.fn();
    const service = serviceWith({
      persistSuggestion,
      improver: improverReturning(titleRewrite('a'.repeat(120))),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'title', { style: null }),
    ).rejects.toMatchObject({
      response: { code: 'AI_EVALUATION_FAILED' },
    });
    expect(persistSuggestion).not.toHaveBeenCalled();
  });

  it('does not impose the title limit on an overview rewrite', async () => {
    const longOverview =
      'I help growing SaaS teams turn complex product requirements into dependable React interfaces that their customers can rely on every day.';
    const service = serviceWith({
      persistSuggestion: vi.fn(async (input: PersistProfileSuggestionInput) =>
        suggestionRow(input, RECOMMENDATION_ID),
      ),
      improver: improverReturning({
        suggestedValue: longOverview,
        guidance: null,
        items: null,
        explanation: 'Leads with the client outcome.',
        impact: 'high',
      }),
    });

    expect(longOverview.length).toBeGreaterThan(UPWORK_TITLE_MAX_LENGTH);
    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'overview', { style: null }),
    ).resolves.toMatchObject({
      suggestedValue: longOverview,
    });
  });

  it("returns 404 for another user's analysis before reading confirmed context", async () => {
    const findSource = vi.fn().mockResolvedValue(null);
    const findConfirmedByUserId = vi.fn();
    const service = serviceWith({
      findSource,
      findConfirmedByUserId,
      persistSuggestion: vi.fn(),
      improver: fakeImprover(),
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'title', { style: 'concise' }),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND', message: 'Analysis not found.' },
      status: 404,
    });
    expect(findConfirmedByUserId).not.toHaveBeenCalled();
  });


  it('never evaluates against an unconfirmed freelancer context', async () => {
    const improve = vi.fn();
    const service = serviceWith({
      findConfirmedByUserId: vi.fn().mockResolvedValue(null),
      persistSuggestion: vi.fn(),
      improver: { improve } as unknown as ProfileImprover,
    });

    await expect(
      service.create(USER_ID, ANALYSIS_ID, 'title', { style: null }),
    ).rejects.toMatchObject({
      response: { code: 'CONTEXT_INCOMPLETE' },
      status: 409,
    });
    expect(improve).not.toHaveBeenCalled();
  });

  it('updates only copied or dismissed suggestion statuses', async () => {
    const updateStatus = vi
      .fn()
      .mockResolvedValue(suggestionRow(basePersistInput(), RECOMMENDATION_ID));
    const service = serviceWith({
      updateStatus,
      persistSuggestion: vi.fn(),
      improver: fakeImprover(),
    });

    await expect(
      service.updateStatus(USER_ID, RECOMMENDATION_ID, { status: 'copied' }),
    ).resolves.toEqual({
      id: RECOMMENDATION_ID,
      status: 'copied',
    });
    expect(updateStatus).toHaveBeenCalledWith(
      USER_ID,
      RECOMMENDATION_ID,
      'copied',
    );

    await expect(
      service.updateStatus(USER_ID, RECOMMENDATION_ID, { status: 'inserted' }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });
});

function serviceWith(options: {
  improver: ProfileImprover;
  findSource?: ReturnType<typeof vi.fn>;
  findExistingSuggestion?: ReturnType<typeof vi.fn>;
  findGoalForAnalysis?: ReturnType<typeof vi.fn>;
  findConfirmedByUserId?: ReturnType<typeof vi.fn>;
  persistSuggestion: ReturnType<typeof vi.fn>;
  updateStatus?: ReturnType<typeof vi.fn>;
}): ProfileSuggestionsService {
  const goals = {
    findForAnalysis:
      options.findGoalForAnalysis ?? vi.fn().mockResolvedValue(goal),
  } as unknown as GoalsService;
  const contexts = {
    findConfirmedByUserId:
      options.findConfirmedByUserId ??
      vi.fn().mockResolvedValue(contextWithoutMetrics),
  } as unknown as FreelancerContextService;
  const repository = {
    findSource:
      options.findSource ??
      vi.fn().mockResolvedValue({
        snapshot: snapshotWithoutMetrics,
        goalId: goal.id,
      }),
    findExistingSuggestion:
      options.findExistingSuggestion ?? vi.fn().mockResolvedValue(null),
    persistSuggestion: options.persistSuggestion,
    updateStatus: options.updateStatus ?? vi.fn(),
  } as unknown as ProfileSuggestionsRepository;

  return new ProfileSuggestionsService(
    goals,
    contexts,
    options.improver,
    repository,
  );
}

function fakeImprover(): ProfileImprover {
  return new ProfileImprover(
    new ModelRegistryService(
      buildModelRegistry({
        NODE_ENV: 'test',
        AI_BASE_URL: 'https://ai.example.test/v1',
      }),
    ),
  );
}

function improverReturning(object: unknown): ProfileImprover {
  return improverFromModels(
    modelThatReturns(object),
    modelThatThrows(new Error('Fallback should not be needed.')),
  );
}

function improverFromModels(
  primary: LanguageModel,
  fallback: LanguageModel,
): ProfileImprover {
  const registry: AiModelRegistry = {
    mode: 'live',
    resolve(_capability, attempt) {
      return {
        model: attempt === 'primary' ? primary : fallback,
        requestedModelId:
          attempt === 'primary' ? 'primary-model' : 'fallback-model',
      };
    },
  };
  return new ProfileImprover(new ModelRegistryService(registry));
}

function titleRewrite(suggestedValue: string) {
  return {
    suggestedValue,
    guidance: null,
    items: null,
    explanation: 'Names the target role and the clients it serves.',
    impact: 'high',
  };
}

function generateResult(object: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(object) }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: {
      inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 3, text: 3, reasoning: 0 },
    },
    warnings: [],
    response: { modelId: 'served-upstream/served-model' },
  };
}

function modelThatReturns(object: unknown): MockLanguageModelV4 {
  return new MockLanguageModelV4({ doGenerate: generateResult(object) });
}

/** Successive calls get successive objects, so a resample can differ. */
function modelThatReturnsInTurn(objects: unknown[]): MockLanguageModelV4 {
  return new MockLanguageModelV4({ doGenerate: objects.map(generateResult) });
}

function modelThatThrows(error: Error): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: () => {
      throw error;
    },
  });
}

function basePersistInput(): PersistProfileSuggestionInput {
  return {
    userId: USER_ID,
    analysisId: ANALYSIS_ID,
    section: 'overview',
    impact: 'high',
    kind: 'rewrite',
    field: 'overview',
    itemIndex: null,
    originalValue: snapshotWithoutMetrics.overview,
    suggestedValue: 'Suggested value',
    guidance: null,
    items: null,
    explanation: 'Explanation',
    suggestionStyle: 'default',
    promptVersion: 'profile-improver-v2',
    requestedModel: 'requested-model',
    gateway: null,
    provider: 'fake',
    model: 'fake/profileImprover',
    usage: { inputTokens: null, outputTokens: null, totalTokens: null },
  };
}

function suggestionRow(
  input: PersistProfileSuggestionInput,
  id: string,
): ProfileRecommendationRow {
  return {
    id,
    analysisId: input.analysisId,
    section: input.section,
    rank: 5,
    impact: input.impact,
    estimatedMinutes: 0,
    reason: input.explanation,
    evidence: [],
    signal: null,
    recommendation:
      input.kind === 'rewrite'
        ? `Use the generated ${input.field} rewrite.`
        : `Follow the generated ${input.field} recommendations.`,
    kind: input.kind,
    field: input.field,
    itemIndex: input.itemIndex,
    originalValue: input.originalValue,
    suggestedValue: input.suggestedValue,
    guidance: input.guidance,
    items: input.items,
    suggestionStyle: input.suggestionStyle,
    variantIndex: SUGGESTION_VARIANT_INDEX,
    promptVersion: input.promptVersion,
    requestedModel: input.requestedModel,
    gateway: input.gateway,
    provider: input.provider,
    model: input.model,
    usage: input.usage,
    status: 'pending' as const,
    outcomeStatus: null,
    outcomeNote: null,
    outcomeAnalysisId: null,
    createdAt: CREATED_AT,
  };
}
