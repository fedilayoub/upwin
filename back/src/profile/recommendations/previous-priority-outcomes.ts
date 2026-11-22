import { Logger } from '@nestjs/common';
import type { PreviousPriorityReview } from '../../ai/schemas/profile-evaluation.schema';
import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import { priorityKey } from './priority-identity';
import type { RankedRecommendation } from './rank-recommendations';
import type {
  PreviousPriority,
  PriorityOutcome,
} from './verify-previous-priorities';

const logger = new Logger('PreviousPriorityOutcomes');

export interface RecommendationOutcome {
  outcomeStatus: PriorityOutcome['status'];
  outcomeNote: string;
  /** The earlier analysis that already raised this same priority. */
  outcomeAnalysisId: string;
}

export type RankedRecommendationWithOutcome = RankedRecommendation & {
  outcome?: RecommendationOutcome;
};

export interface PreviousPriorityRef {
  ref: number;
  recommendationId: string;
}

/**
 * Folds the model's reviews in behind the deterministic verdicts.
 *
 * Deliberately non-throwing. A verdict drives a badge, nothing more, while the
 * throw would sit outside `generateObject`'s retry loop — one unusable review
 * would then fail an entire analysis and discard the model call that produced
 * the scores. An unusable review simply yields no badge.
 */
export function mergePreviousPriorityOutcomes(
  decided: ReadonlyMap<string, PriorityOutcome>,
  reviews: readonly PreviousPriorityReview[] | undefined,
  refs: readonly PreviousPriorityRef[],
): Map<string, PriorityOutcome> {
  const merged = new Map(decided);
  if (!reviews) return merged;

  const byRef = new Map(refs.map(({ ref, recommendationId }) => [ref, recommendationId]));
  const seen = new Set<number>();

  for (const review of reviews) {
    const recommendationId = byRef.get(review.ref);
    if (recommendationId === undefined) {
      logger.warn(`Ignoring a review for unknown previous priority ref ${review.ref}.`);
      continue;
    }
    if (seen.has(review.ref)) {
      logger.warn(`Ignoring a duplicate review for previous priority ref ${review.ref}.`);
      continue;
    }
    seen.add(review.ref);
    // A deterministic verdict is proof, not opinion, and always wins.
    if (merged.has(recommendationId)) continue;
    merged.set(recommendationId, { status: review.status, note: review.note });
  }

  return merged;
}

/**
 * Marks the new priorities that repeat advice the previous analysis already
 * gave, so the card can say whether the freelancer acted on it.
 *
 * Keys are computed against the facts of the snapshot each side was raised
 * from: a priority's suggestion target depends on the profile it was derived
 * from, so keying old rows with new facts would silently mismatch.
 */
export function attachPreviousOutcomes(
  recommendations: readonly RankedRecommendation[],
  currentFacts: Pick<ProfileFacts, 'counts'>,
  previous: {
    analysisId: string;
    priorities: readonly PreviousPriority[];
    facts: Pick<ProfileFacts, 'counts'>;
    outcomes: ReadonlyMap<string, PriorityOutcome>;
  } | null,
): RankedRecommendationWithOutcome[] {
  if (previous === null) return [...recommendations];

  const outcomeByKey = new Map<string, PriorityOutcome>();
  for (const priority of previous.priorities) {
    const outcome = previous.outcomes.get(priority.id);
    if (outcome) outcomeByKey.set(priorityKey(priority, previous.facts), outcome);
  }

  return recommendations.map((recommendation) => {
    const outcome = outcomeByKey.get(
      priorityKey(
        {
          section: recommendation.section,
          signal: 'signal' in recommendation ? recommendation.signal : null,
        },
        currentFacts,
      ),
    );
    if (!outcome) return recommendation;

    return {
      ...recommendation,
      outcome: {
        outcomeStatus: outcome.status,
        outcomeNote: outcome.note,
        outcomeAnalysisId: previous.analysisId,
      },
    };
  });
}
