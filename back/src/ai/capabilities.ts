import type { Env } from '../config/env.schema';

export const AI_CAPABILITIES = [
  'profileAnalyzer',
  'profileImprover',
  'cvExtractor',
  'jobMatchEvaluator',
  'proposalWriter',
] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];
export type AiModelAttempt = 'primary' | 'fallback';

export const MODEL_SELECTABLE_CAPABILITIES = [
  'profileAnalyzer',
  'jobMatchEvaluator',
  'proposalWriter',
] as const;

export type ModelSelectableCapability =
  (typeof MODEL_SELECTABLE_CAPABILITIES)[number];

export interface CapabilityModelIds {
  primary: string;
  fallback: string;
}

export type CapabilityModelMap = Record<AiCapability, CapabilityModelIds>;

/**
 * Used when a capability has no model configured. One OpenAI model id per
 * capability, with the fallback retrying the same model: a single
 * OpenAI-compatible endpoint rarely serves models from several providers.
 */
export const developmentDefaults: CapabilityModelMap = {
  profileAnalyzer: { primary: 'gpt-4.1-mini', fallback: 'gpt-4.1-mini' },
  profileImprover: { primary: 'gpt-4.1-nano', fallback: 'gpt-4.1-nano' },
  cvExtractor: { primary: 'gpt-4.1-nano', fallback: 'gpt-4.1-nano' },
  jobMatchEvaluator: { primary: 'gpt-4.1-mini', fallback: 'gpt-4.1-mini' },
  proposalWriter: { primary: 'gpt-4.1-mini', fallback: 'gpt-4.1-mini' },
};

/**
 * A capability's own key wins, then AI_MODEL, then the built-in default. An
 * unset fallback retries the resolved primary.
 */
function resolvePair(
  primary: string | undefined,
  fallback: string | undefined,
  shared: string | undefined,
  defaults: CapabilityModelIds,
): CapabilityModelIds {
  const resolvedPrimary = primary ?? shared ?? defaults.primary;
  return { primary: resolvedPrimary, fallback: fallback ?? resolvedPrimary };
}

export function resolveCapabilityModels(
  environment: Pick<
    Env,
    | 'AI_MODEL'
    | 'AI_MODEL_PROFILE_ANALYZER_PRIMARY'
    | 'AI_MODEL_PROFILE_ANALYZER_FALLBACK'
    | 'AI_MODEL_PROFILE_IMPROVER_PRIMARY'
    | 'AI_MODEL_PROFILE_IMPROVER_FALLBACK'
    | 'AI_MODEL_CV_EXTRACTOR_PRIMARY'
    | 'AI_MODEL_CV_EXTRACTOR_FALLBACK'
    | 'AI_MODEL_JOB_MATCH_EVALUATOR_PRIMARY'
    | 'AI_MODEL_JOB_MATCH_EVALUATOR_FALLBACK'
    | 'AI_MODEL_PROPOSAL_WRITER_PRIMARY'
    | 'AI_MODEL_PROPOSAL_WRITER_FALLBACK'
  >,
): CapabilityModelMap {
  return {
    profileAnalyzer: resolvePair(
      environment.AI_MODEL_PROFILE_ANALYZER_PRIMARY,
      environment.AI_MODEL_PROFILE_ANALYZER_FALLBACK,
      environment.AI_MODEL,
      developmentDefaults.profileAnalyzer,
    ),
    profileImprover: resolvePair(
      environment.AI_MODEL_PROFILE_IMPROVER_PRIMARY,
      environment.AI_MODEL_PROFILE_IMPROVER_FALLBACK,
      environment.AI_MODEL,
      developmentDefaults.profileImprover,
    ),
    cvExtractor: resolvePair(
      environment.AI_MODEL_CV_EXTRACTOR_PRIMARY,
      environment.AI_MODEL_CV_EXTRACTOR_FALLBACK,
      environment.AI_MODEL,
      developmentDefaults.cvExtractor,
    ),
    jobMatchEvaluator: resolvePair(
      environment.AI_MODEL_JOB_MATCH_EVALUATOR_PRIMARY,
      environment.AI_MODEL_JOB_MATCH_EVALUATOR_FALLBACK,
      environment.AI_MODEL,
      developmentDefaults.jobMatchEvaluator,
    ),
    proposalWriter: resolvePair(
      environment.AI_MODEL_PROPOSAL_WRITER_PRIMARY,
      environment.AI_MODEL_PROPOSAL_WRITER_FALLBACK,
      environment.AI_MODEL,
      developmentDefaults.proposalWriter,
    ),
  };
}
