import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnalysisUsage } from '../../profile/analysis/profile-analysis.schema';
import type { ProfileSectionId } from '../../profile/profile-section';
import type { CompletenessGuidanceId } from '../../profile/recommendations/completeness-recommendations';
import type { PriorityOutcomeStatus } from '../../profile/recommendations/verify-previous-priorities';
import type { RecommendationImpact } from '../../profile/recommendations/rank-recommendations';
import type {
  PersistedSuggestionStyle,
  ProfileSuggestionField,
  ProfileSuggestionKind,
} from '../../profile/suggestions/profile-suggestion.schema';
import { profileAnalyses } from './profile-analyses';

export const RECOMMENDATION_STATUSES = [
  'pending',
  'copied',
  'inserted',
  'dismissed',
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const profileRecommendations = pgTable(
  'profile_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => profileAnalyses.id, { onDelete: 'cascade' }),
    section: text('section').$type<ProfileSectionId>().notNull(),
    rank: integer('rank').notNull(),
    impact: text('impact').$type<RecommendationImpact>().notNull(),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    reason: text('reason').notNull(),
    evidence: jsonb('evidence').$type<string[]>().notNull().default([]),
    recommendation: text('recommendation').notNull(),
    kind: text('kind').$type<ProfileSuggestionKind>(),
    // Which completeness fact a fill is about. Null for an AI rewrite priority.
    // This is the only thing that distinguishes two fills in the same section,
    // so it belongs in the uniqueness key below as well as on the row.
    signal: text('signal').$type<CompletenessGuidanceId>(),
    field: text('field').$type<ProfileSuggestionField>(),
    itemIndex: integer('item_index'),
    originalValue: text('original_value'),
    suggestedValue: text('suggested_value'),
    guidance: text('guidance'),
    items: jsonb('items').$type<string[]>(),
    suggestionStyle: text('suggestion_style').$type<PersistedSuggestionStyle>(),
    variantIndex: integer('variant_index'),
    promptVersion: text('prompt_version'),
    requestedModel: text('requested_model'),
    gateway: text('gateway'),
    provider: text('provider'),
    model: text('model'),
    usage: jsonb('usage').$type<AnalysisUsage>(),
    status: text('status')
      .$type<RecommendationStatus>()
      .notNull()
      .default('pending'),
    // Whether a later analysis found this priority acted on. Distinct from
    // `status`, which records what the user did inside the extension (copied,
    // dismissed) rather than what reached the live Upwork profile.
    outcomeStatus: text('outcome_status').$type<PriorityOutcomeStatus>(),
    outcomeNote: text('outcome_note'),
    // The analysis that reached the verdict. `set null` so deleting a newer
    // analysis cannot delete the older priorities it judged.
    outcomeAnalysisId: uuid('outcome_analysis_id').references(
      () => profileAnalyses.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('profile_recommendations_analysis_rank_idx').on(
      table.analysisId,
      table.rank,
    ),
    unique('profile_recommendations_suggestion_variant_uidx')
      .on(
        table.analysisId,
        table.section,
        table.signal,
        table.itemIndex,
        table.suggestionStyle,
        table.variantIndex,
      )
      .nullsNotDistinct(),
  ],
);

export type ProfileRecommendationRow =
  typeof profileRecommendations.$inferSelect;
