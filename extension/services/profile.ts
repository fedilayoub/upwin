import { sendExtensionRequest } from '@/features/extension/client';
import {
  createCaptureProfileRequest,
  createProfilePageStatusRequest,
  isProfileCaptureResult,
  isProfilePageStatus,
} from '@/features/extension/protocol';
import {
  profileCaptureResultSchema,
  profileSnapshotSchema,
  ProfileSnapshotValidationError,
  type ProfileCaptureResult,
  type ProfileSnapshot,
} from '@/features/upwork/profile/schema';
import {
  PROFILE_SECTION_IDS,
  type ActiveProfileGoal,
  type ProfileAnalysis,
  type ProfileAnalysisList,
  type ProfileAnalysisProgress,
  type ProfileAnalyzerSetup,
  type ProfilePageStatus,
  type ProfileSectionId,
  type ProfileSnapshotDiff,
  type ProfileSuggestion,
  type ProfileSuggestionStyle,
  type RecommendationActionStatus,
} from '@/types/profile';
import { z } from 'zod';
import { ApiClientError, apiClient, type TokenProvider } from './api';

const goalObjectiveSchema = z.enum([
  'first-client',
  'more-clients',
  'more-responses',
  'higher-paying-projects',
  'scale',
]);

const sectionIdSchema = z.enum(PROFILE_SECTION_IDS);
const criterionEvidenceSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    evidence: z.array(z.string().trim().min(1)),
  })
  .strict();
const sectionScoreSchema = z
  .object({
    id: sectionIdSchema,
    score: z.number().int().min(0).max(100),
    criteria: z.array(criterionEvidenceSchema),
  })
  .strict();

const sectionScoresSchema = z
  .array(sectionScoreSchema)
  .length(PROFILE_SECTION_IDS.length)
  .superRefine((scores, context) => {
    if (new Set(scores.map(({ id }) => id)).size !== PROFILE_SECTION_IDS.length) {
      context.addIssue({
        code: 'custom',
        message: 'Section scores must contain every section exactly once.',
      });
    }
  });

const analysisGoalSchema = z
  .object({
    id: z.string().uuid(),
    objective: goalObjectiveSchema,
    targetRole: z.string().trim().min(1),
  })
  .strict();

const recommendationBaseShape = {
  id: z.string().uuid(),
  section: sectionIdSchema,
  rank: z.number().int().positive(),
  impact: z.enum(['high', 'medium', 'low']),
  estimatedMinutes: z.number().int().nonnegative(),
  recommendation: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  evidence: z.array(z.string().trim().min(1)),
  // Optional so a response from a backend that predates the field still parses;
  // both arms are strict, so an unexpected key would fail the whole union.
  previousOutcome: z
    .object({
      status: z.enum(['implemented', 'partial', 'not-implemented']),
      note: z.string().trim().min(1),
    })
    .strict()
    .optional(),
};

const evaluationRecommendationSchema = z
  .object({
    ...recommendationBaseShape,
  })
  .strict();

const completenessRecommendationSchema = z
  .object({
    ...recommendationBaseShape,
    kind: z.literal('fill'),
    field: z.null(),
    itemIndex: z.null(),
    guidance: z.string().trim().min(1),
    items: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

const recommendationSchema = z.union([
  completenessRecommendationSchema,
  evaluationRecommendationSchema,
]);

const suggestionBaseShape = {
  id: z.string().uuid(),
  section: sectionIdSchema,
  field: z
    .enum(['title', 'overview', 'skills', 'portfolio', 'employment'])
    .nullable(),
  itemIndex: z.number().int().nonnegative().nullable(),
  explanation: z.string().trim().min(1),
  impact: z.enum(['high', 'medium', 'low']),
};

const rewriteSuggestionSchema = z
  .object({
    ...suggestionBaseShape,
    kind: z.literal('rewrite'),
    originalValue: z.string().trim().min(1).optional(),
    suggestedValue: z.string().trim().min(1),
  })
  .strict();

const fillSuggestionSchema = z
  .object({
    ...suggestionBaseShape,
    kind: z.literal('fill'),
    guidance: z.string().trim().min(1),
    items: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

const suggestionSchema = z.discriminatedUnion('kind', [
  rewriteSuggestionSchema,
  fillSuggestionSchema,
]);

const recommendationStatusSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(['copied', 'dismissed']),
  })
  .strict();

const analysisSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.iso.datetime(),
    winningScore: z.number().int().min(0).max(100),
    completenessScore: z.number().int().min(0).max(100).nullable(),
    previousWinningScore: z.number().int().min(0).max(100).nullable(),
    goal: analysisGoalSchema,
    summary: z.string().trim().min(1),
    strongestSection: sectionIdSchema,
    biggestOpportunity: sectionIdSchema,
    sectionScores: sectionScoresSchema,
    priorities: z.array(recommendationSchema),
    versions: z
      .object({
        prompt: z.string().trim().min(1),
        rubric: z.string().trim().min(1),
        scoring: z.string().trim().min(1),
        requestedModel: z.string().trim().min(1).optional(),
        provider: z.string().trim().min(1),
        model: z.string().trim().min(1),
        gateway: z.string().trim().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const analysisListSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string().uuid(),
          createdAt: z.iso.datetime(),
          winningScore: z.number().int().min(0).max(100),
          sectionScores: sectionScoresSchema,
          goal: analysisGoalSchema,
        })
        .strict(),
    ),
    pageSize: z.number().int().positive(),
    hasMore: z.boolean(),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((history, context) => {
    if (history.hasMore !== (history.nextCursor !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'History cursor and hasMore must agree.',
      });
    }
  });

const progressSchema = z
  .object({
    latest: z
      .object({
        id: z.string().uuid(),
        createdAt: z.iso.datetime(),
        winningScore: z.number().int().min(0).max(100),
      })
      .strict()
      .nullable(),
    deltaSinceFirst: z.number().int().min(-100).max(100).nullable(),
    trend: z.array(
      z
        .object({
          id: z.string().uuid(),
          createdAt: z.iso.datetime(),
          winningScore: z.number().int().min(0).max(100),
        })
        .strict(),
    ),
    sectionDeltas: z
      .array(
        z
          .object({
            id: sectionIdSchema,
            firstScore: z.number().int().min(0).max(100),
            latestScore: z.number().int().min(0).max(100),
            delta: z.number().int().min(-100).max(100).nullable(),
          })
          .strict(),
      )
      .superRefine((deltas, context) => {
        if (new Set(deltas.map(({ id }) => id)).size !== deltas.length) {
          context.addIssue({
            code: 'custom',
            message: 'Section progress must not contain duplicate sections.',
          });
        }
      }),
  })
  .strict()
  .superRefine((progress, context) => {
    const expectedSections =
      progress.latest === null ? 0 : PROFILE_SECTION_IDS.length;
    if (progress.sectionDeltas.length !== expectedSections) {
      context.addIssue({
        code: 'custom',
        message: 'Profile progress must contain every section exactly once.',
      });
    }
    if ((progress.latest === null) !== (progress.trend.length === 0)) {
      context.addIssue({
        code: 'custom',
        message: 'Profile progress latest and trend must agree.',
      });
    }
  });

const snapshotDiffSchema = z
  .object({
    fromSnapshotId: z.string().uuid(),
    toSnapshotId: z.string().uuid(),
    fromCapturedAt: z.iso.datetime(),
    toCapturedAt: z.iso.datetime(),
    changes: z
      .object({
        title: z.object({ status: z.enum(['changed', 'unchanged']) }).strict(),
        overview: z
          .object({ status: z.enum(['updated', 'unchanged']) })
          .strict(),
        portfolio: z
          .object({
            status: z.enum(['changed', 'unchanged']),
            added: z.number().int().nonnegative(),
            removed: z.number().int().nonnegative(),
          })
          .strict(),
        skills: z
          .object({
            status: z.enum(['changed', 'unchanged']),
            added: z.array(z.string().trim().min(1)),
            removed: z.array(z.string().trim().min(1)),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const activeGoalSchema = z
  .object({
    id: z.string().uuid(),
    objective: goalObjectiveSchema,
    targetRole: z.string().trim().min(1),
    targetProjectTypes: z.array(z.string().trim().min(1)),
    targetClients: z.array(z.string().trim().min(1)),
    preferredSkills: z.array(z.string().trim().min(1)),
    targetRate: z
      .object({
        min: z.number().finite().nonnegative().optional(),
        max: z.number().finite().nonnegative().optional(),
      })
      .strict()
      .nullable(),
    isActive: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

const contextStatusSchema = z
  .object({ confirmedAt: z.iso.datetime().nullable() })
  .nullable();

interface CaptureProfileDependencies {
  captureProfile: () => Promise<unknown>;
}

export function createCaptureProfile({
  captureProfile,
}: CaptureProfileDependencies) {
  return async (): Promise<ProfileCaptureResult> => {
    const capture = profileCaptureResultSchema.safeParse(
      await captureProfile(),
    );

    if (!capture.success) throw new ProfileSnapshotValidationError();
    return capture.data;
  };
}

const capture = createCaptureProfile({
  captureProfile: (): Promise<ProfileCaptureResult> =>
    sendExtensionRequest(createCaptureProfileRequest(), isProfileCaptureResult),
});

async function analyze(
  snapshot: ProfileSnapshot,
  getToken: TokenProvider,
  goalId?: string,
): Promise<ProfileAnalysis> {
  const parsedSnapshot = profileSnapshotSchema.safeParse(snapshot);
  if (!parsedSnapshot.success) throw new ProfileSnapshotValidationError();

  const parsedGoalId =
    goalId === undefined ? undefined : z.uuid().safeParse(goalId);
  if (parsedGoalId !== undefined && !parsedGoalId.success) {
    throw new Error('The selected goal is invalid.');
  }

  const response = await apiClient.request<unknown>('/profile-analyses', {
    body: JSON.stringify({
      snapshot: parsedSnapshot.data,
      ...(parsedGoalId?.data === undefined ? {} : { goalId: parsedGoalId.data }),
    }),
    getToken,
    method: 'POST',
    operation: 'POST /profile-analyses',
  });

  return parseApiResponse(analysisSchema, response, 'profile analysis');
}

async function getAnalyses(
  getToken: TokenProvider,
  cursor?: string,
  pageSize = 20,
): Promise<ProfileAnalysisList> {
  const query = new URLSearchParams({ pageSize: String(pageSize) });
  if (cursor !== undefined) query.set('cursor', cursor);
  const response = await apiClient.request<unknown>(
    `/profile-analyses?${query.toString()}`,
    {
      getToken,
      method: 'GET',
      operation: 'GET /profile-analyses',
    },
  );

  return parseApiResponse(
    analysisListSchema,
    response,
    'profile analysis history',
  );
}

async function getProgress(
  getToken: TokenProvider,
): Promise<ProfileAnalysisProgress> {
  const response = await apiClient.request<unknown>(
    '/profile-analyses/progress',
    {
      getToken,
      method: 'GET',
      operation: 'GET /profile-analyses/progress',
    },
  );

  return parseApiResponse(progressSchema, response, 'profile progress');
}

async function getSnapshotDiff(
  getToken: TokenProvider,
): Promise<ProfileSnapshotDiff | null> {
  const response = await apiClient.request<unknown>('/profile-snapshots/diff', {
    getToken,
    method: 'GET',
    operation: 'GET /profile-snapshots/diff',
  });

  return parseApiResponse(
    snapshotDiffSchema.nullable(),
    response,
    'profile snapshot diff',
  );
}

async function getAnalysis(
  id: string,
  getToken: TokenProvider,
): Promise<ProfileAnalysis> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) throw new Error('The selected analysis is invalid.');

  const response = await apiClient.request<unknown>(
    `/profile-analyses/${parsedId.data}`,
    {
      getToken,
      method: 'GET',
      operation: 'GET /profile-analyses/:id',
    },
  );

  return parseApiResponse(analysisSchema, response, 'profile analysis');
}

async function createSuggestion(
  analysisId: string,
  section: ProfileSectionId,
  getToken: TokenProvider,
  style: ProfileSuggestionStyle | null = null,
): Promise<ProfileSuggestion> {
  const parsedAnalysisId = z.uuid().safeParse(analysisId);
  const parsedSection = sectionIdSchema.safeParse(section);
  if (!parsedAnalysisId.success || !parsedSection.success) {
    throw new Error('The selected profile recommendation is invalid.');
  }

  const response = await apiClient.request<unknown>(
    `/profile-analyses/${parsedAnalysisId.data}/suggestions/${parsedSection.data}`,
    {
      body: JSON.stringify({ style }),
      getToken,
      method: 'POST',
      operation: 'POST /profile-analyses/:id/suggestions/:section',
    },
  );

  return parseApiResponse(suggestionSchema, response, 'profile suggestion');
}

async function updateRecommendationStatus(
  recommendationId: string,
  status: RecommendationActionStatus,
  getToken: TokenProvider,
): Promise<{ id: string; status: RecommendationActionStatus }> {
  const parsedId = z.uuid().safeParse(recommendationId);
  const parsedStatus = z.enum(['copied', 'dismissed']).safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    throw new Error('The selected recommendation action is invalid.');
  }

  const response = await apiClient.request<unknown>(
    `/profile-recommendations/${parsedId.data}`,
    {
      body: JSON.stringify({ status: parsedStatus.data }),
      getToken,
      method: 'PATCH',
      operation: 'PATCH /profile-recommendations/:id',
    },
  );

  return parseApiResponse(
    recommendationStatusSchema,
    response,
    'recommendation status',
  );
}

async function getActiveGoal(
  getToken: TokenProvider,
): Promise<ActiveProfileGoal | null> {
  try {
    const response = await apiClient.request<unknown>('/goals/active', {
      getToken,
      method: 'GET',
      operation: 'GET /goals/active',
    });

    return parseApiResponse(activeGoalSchema, response, 'active goal');
  } catch (error: unknown) {
    if (
      error instanceof ApiClientError &&
      error.status === 404 &&
      error.code === 'NOT_FOUND'
    ) {
      return null;
    }

    throw error;
  }
}

async function getContextConfirmed(getToken: TokenProvider): Promise<boolean> {
  const response = await apiClient.request<unknown>('/freelancer-context', {
    getToken,
    method: 'GET',
    operation: 'GET /freelancer-context',
  });
  const context = parseApiResponse(
    contextStatusSchema,
    response,
    'freelancer context',
  );

  return context?.confirmedAt !== null && context?.confirmedAt !== undefined;
}

async function getSetup(
  getToken: TokenProvider,
): Promise<ProfileAnalyzerSetup> {
  const [activeGoal, contextConfirmed, progress, snapshotDiff] =
    await Promise.all([
      getActiveGoal(getToken),
      getContextConfirmed(getToken),
      getProgress(getToken),
      getSnapshotDiff(getToken),
    ]);

  return {
    activeGoal,
    contextConfirmed,
    progress,
    snapshotDiff,
    latestAnalysis:
      progress.latest === null
        ? null
        : await getAnalysis(progress.latest.id, getToken),
  };
}

async function getPageStatus(): Promise<ProfilePageStatus> {
  return sendExtensionRequest(
    createProfilePageStatusRequest(),
    isProfilePageStatus,
  );
}

function parseApiResponse<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  resource: string,
): z.output<TSchema> {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new Error(`The backend returned an invalid ${resource} response.`);
  }

  return parsed.data;
}

export const profileService = {
  analyze,
  capture,
  createSuggestion,
  getAnalyses,
  getAnalysis,
  getPageStatus,
  getProgress,
  getSetup,
  getSnapshotDiff,
  updateRecommendationStatus,
};
