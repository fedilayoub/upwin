import type { EvaluationPriority } from '../../ai/schemas/profile-evaluation.schema';
import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import type { ProfileSectionId } from '../profile-section';
import type { SectionScore } from '../scoring/profile-scoring';
import type { ScoringWeights } from '../scoring/weights/scoring-weights';
import {
  resolveSuggestionTarget,
  suggestionTargetKey,
} from '../suggestions/suggestion-target';
import type { CompletenessFillRecommendation } from './completeness-recommendations';

export type RecommendationImpact = 'high' | 'medium' | 'low';
export type RecommendationCandidate =
  EvaluationPriority | CompletenessFillRecommendation;

export type RankedRecommendation = RecommendationCandidate & {
  impact: RecommendationImpact;
  rank: number;
  estimatedMinutes: number;
};

export class InvalidRecommendationEvidenceError extends Error {
  constructor(section: ProfileSectionId) {
    super(`The ${section} priority must cite at least one piece of evidence.`);
    this.name = 'InvalidRecommendationEvidenceError';
  }
}

const IMPACT_ORDER = { high: 3, medium: 2, low: 1 } as const;
// Enough to show the model's own citation plus the section's criterion evidence
// without turning one card into a wall of quotes.
const MAX_PRIORITY_EVIDENCE = 6;
const ESTIMATED_MINUTES = {
  title: 5,
  overview: 10,
  skills: 5,
  portfolio: 20,
  employment: 15,
};

export function rankRecommendations(
  priorities: EvaluationPriority[],
  sectionScores: SectionScore[],
  weights: ScoringWeights,
  facts: Pick<ProfileFacts, 'counts'>,
  completenessRecommendations: CompletenessFillRecommendation[] = [],
): RankedRecommendation[] {
  const scores = new Map(sectionScores.map(({ id, score }) => [id, score]));
  const groundedPriorities = groundPriorityEvidence(priorities, sectionScores);

  const rankedAiPriorities = groundedPriorities
    .map((priority, originalIndex) => ({
      priority: {
        ...priority,
        impact: recommendationImpact(priority.section, scores, weights),
      },
      originalIndex,
      rankingScore: recommendationRankingScore(
        priority.section,
        scores,
        weights,
      ),
    }))
    .sort(
      (left, right) =>
        right.rankingScore - left.rankingScore ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ priority }) => priority);

  const deduplicated = new Map<
    string,
    EvaluationPriority & {
      impact: RecommendationImpact;
      estimatedMinutes: number;
    }
  >();
  for (const priority of rankedAiPriorities) {
    const target = resolveSuggestionTarget(priority.section, facts);
    const key = suggestionTargetKey(target);
    const existing = deduplicated.get(key);
    if (!existing) {
      deduplicated.set(key, {
        ...priority,
        estimatedMinutes: ESTIMATED_MINUTES[target.field],
      });
      continue;
    }

    deduplicated.set(key, {
      ...existing,
      impact:
        IMPACT_ORDER[priority.impact] > IMPACT_ORDER[existing.impact]
          ? priority.impact
          : existing.impact,
      recommendation: mergeRationale(
        existing.recommendation,
        priority.recommendation,
      ),
      reason: mergeRationale(existing.reason, priority.reason),
      evidence: uniqueEvidence([...existing.evidence, ...priority.evidence]),
    });
  }

  const completenessWithImpact = completenessRecommendations.map(
    (recommendation) => ({
      ...recommendation,
      impact: recommendationImpact(recommendation.section, scores, weights),
    }),
  );

  return [...deduplicated.values(), ...completenessWithImpact]
    .map((recommendation, originalIndex) => ({
      recommendation,
      originalIndex,
      rankingScore: recommendationRankingScore(
        recommendation.section,
        scores,
        weights,
      ),
    }))
    .sort(
      (left, right) =>
        right.rankingScore - left.rankingScore ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ recommendation }, index) => ({
      ...recommendation,
      rank: index + 1,
    }));
}

export function topRecommendations(
  recommendations: RankedRecommendation[],
  limit = 3,
): RankedRecommendation[] {
  return recommendations.slice(0, limit);
}

/**
 * Grounding is enforced structurally, not by string identity.
 *
 * `priority.section` is a schema enum, so which section a priority belongs to is
 * never in doubt. What the earlier check tried to prove — that the priority is
 * justified by material from that same section — cannot be proved by comparing
 * two independently generated string arrays. The model labels its citations
 * ("Portfolio project: 'x' description.") rather than copying the criterion
 * evidence byte for byte, so set membership fails on essentially every live
 * response, and the throw sits outside the model retry loop: one paraphrase and
 * the entire analysis returns AI_EVALUATION_FAILED.
 *
 * So instead of rejecting, union the priority's own citations with the evidence
 * the model returned for that section's criteria. The user then always sees
 * verifiable material drawn from the section that was actually scored, which is
 * the guarantee that mattered. An empty citation list is still a real contract
 * violation and still throws.
 */
function groundPriorityEvidence(
  priorities: EvaluationPriority[],
  sectionScores: SectionScore[],
): EvaluationPriority[] {
  const evidenceBySection = new Map(
    sectionScores.map((section) => [
      section.id,
      section.criteria.flatMap((criterion) => criterion.evidence),
    ]),
  );

  return priorities.map((priority) => {
    if (priority.evidence.length === 0) {
      throw new InvalidRecommendationEvidenceError(priority.section);
    }

    const sectionEvidence = evidenceBySection.get(priority.section) ?? [];
    const cited = new Set(priority.evidence.map(normalizeEvidence));
    const supporting = sectionEvidence.filter(
      (evidence) => !cited.has(normalizeEvidence(evidence)),
    );

    return {
      ...priority,
      evidence: uniqueEvidence([...priority.evidence, ...supporting]).slice(
        0,
        MAX_PRIORITY_EVIDENCE,
      ),
    };
  });
}

function recommendationImpact(
  section: ProfileSectionId,
  scores: Map<ProfileSectionId, number>,
  weights: ScoringWeights,
): RecommendationImpact {
  const opportunity = recommendationRankingScore(section, scores, weights);
  if (opportunity >= 10) return 'high';
  if (opportunity >= 5) return 'medium';
  return 'low';
}

function recommendationRankingScore(
  section: ProfileSectionId,
  scores: Map<ProfileSectionId, number>,
  weights: ScoringWeights,
): number {
  const score = scores.get(section);
  if (score === undefined) {
    throw new Error(`Section scores are missing ${section}.`);
  }
  return weights[section] * (100 - score);
}

function mergeRationale(existing: string, next: string): string {
  return existing === next ? existing : `${existing} ${next}`;
}

function uniqueEvidence(evidence: string[]): string[] {
  return [...new Set(evidence)];
}

function normalizeEvidence(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
}
