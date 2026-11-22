import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import type { ProfileSectionId } from '../profile-section';
import {
  resolveSuggestionTarget,
  suggestionTargetKey,
} from '../suggestions/suggestion-target';
import type { CompletenessGuidanceId } from './completeness-recommendations';

export interface PriorityIdentity {
  section: ProfileSectionId;
  signal: CompletenessGuidanceId | null;
}

/**
 * A stable identity for a priority across analyses.
 *
 * Section alone does not work. `rankRecommendations` deduplicates AI priorities
 * by suggestion target, and `SECTION_TARGET_FIELDS` collapses eight sections
 * into five targets — `positioning`/`title` both resolve to `title`, and
 * `portfolio`/`trust` both to `portfolio`. Which of the two candidate sections
 * survives ranking varies run to run, so the same underlying advice can be
 * persisted under either label.
 *
 * Completeness fills are appended without deduplication and several can share a
 * section, so they are identified by the signal that raised them — the same
 * reason `signal` sits in the row's uniqueness key.
 */
export function priorityKey(
  priority: PriorityIdentity,
  facts: Pick<ProfileFacts, 'counts'>,
): string {
  if (priority.signal !== null) return `fill:${priority.signal}`;

  return `ai:${suggestionTargetKey(resolveSuggestionTarget(priority.section, facts))}`;
}
