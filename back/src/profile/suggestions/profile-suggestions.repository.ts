import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  profileAnalyses,
  profileRecommendations,
  profileSnapshots,
  type ProfileRecommendationRow,
  type ProfileSnapshotRow,
} from '../../database/schema';
import type { AnalysisUsage } from '../analysis/profile-analysis.schema';
import type { ProfileSectionId } from '../profile-section';
import type {
  PersistedSuggestionStyle,
  ProfileSuggestionField,
  ProfileSuggestionKind,
  RecommendationActionStatus,
} from './profile-suggestion.schema';

export interface SuggestionSourceRecord {
  snapshot: ProfileSnapshotRow;
  goalId: string;
}

/**
 * A suggestion is generated once per (analysis, section, item, style) and then
 * reused, so there is only ever one variant. The column stays non-null because
 * `variant_index IS NULL` is the repo-wide discriminator that separates a
 * generated suggestion from an analyzer priority on the shared table.
 */
export const SUGGESTION_VARIANT_INDEX = 0;

export interface PersistProfileSuggestionInput {
  userId: string;
  analysisId: string;
  section: ProfileSectionId;
  impact: 'high' | 'medium' | 'low';
  kind: ProfileSuggestionKind;
  field: ProfileSuggestionField;
  itemIndex: number | null;
  originalValue: string | null;
  suggestedValue: string | null;
  guidance: string | null;
  items: string[] | null;
  explanation: string;
  suggestionStyle: PersistedSuggestionStyle;
  promptVersion: string;
  requestedModel: string;
  gateway: string | null;
  provider: string;
  model: string;
  usage: AnalysisUsage;
}

@Injectable()
export class ProfileSuggestionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findSource(
    userId: string,
    analysisId: string,
  ): Promise<SuggestionSourceRecord | null> {
    const [owned] = await this.db
      .select({ snapshot: profileSnapshots, goalId: profileAnalyses.goalId })
      .from(profileAnalyses)
      .innerJoin(
        profileSnapshots,
        eq(profileAnalyses.profileSnapshotId, profileSnapshots.id),
      )
      .where(
        and(
          eq(profileAnalyses.id, analysisId),
          eq(profileAnalyses.userId, userId),
          eq(profileSnapshots.userId, userId),
        ),
      )
      .limit(1);
    if (!owned) return null;

    return owned;
  }

  /**
   * The saved suggestion for this target, if one was already generated for this
   * analysis. Reopening a priority must show the same advice it showed the
   * first time, so this is checked before any AI call is made.
   */
  async findExistingSuggestion(
    userId: string,
    analysisId: string,
    section: ProfileSectionId,
    itemIndex: number | null,
    suggestionStyle: PersistedSuggestionStyle,
  ): Promise<ProfileRecommendationRow | null> {
    const [existing] = await this.db
      .select({ recommendation: profileRecommendations })
      .from(profileRecommendations)
      .innerJoin(
        profileAnalyses,
        eq(profileRecommendations.analysisId, profileAnalyses.id),
      )
      .where(
        and(
          eq(profileAnalyses.userId, userId),
          suggestionMatch(analysisId, section, itemIndex, suggestionStyle),
        ),
      )
      .orderBy(asc(profileRecommendations.variantIndex))
      .limit(1);

    return existing?.recommendation ?? null;
  }

  async persistSuggestion(
    input: PersistProfileSuggestionInput,
  ): Promise<ProfileRecommendationRow | null> {
    return this.db.transaction(async (tx) => {
      const [ownedAnalysis] = await tx
        .select({ id: profileAnalyses.id })
        .from(profileAnalyses)
        .where(
          and(
            eq(profileAnalyses.id, input.analysisId),
            eq(profileAnalyses.userId, input.userId),
          ),
        )
        .limit(1)
        .for('update');
      if (!ownedAnalysis) return null;

      const [lastRanked] = await tx
        .select({ rank: profileRecommendations.rank })
        .from(profileRecommendations)
        .where(eq(profileRecommendations.analysisId, input.analysisId))
        .orderBy(desc(profileRecommendations.rank))
        .limit(1);

      const [suggestion] = await tx
        .insert(profileRecommendations)
        .values({
          analysisId: input.analysisId,
          section: input.section,
          rank: (lastRanked?.rank ?? 0) + 1,
          impact: input.impact,
          estimatedMinutes: 0,
          reason: input.explanation,
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
          status: 'pending',
        })
        .onConflictDoNothing()
        .returning();

      if (suggestion) return suggestion;

      // Two first opens of the same priority raced. The analysis row lock above
      // serializes them, so the loser reads back the winner's suggestion rather
      // than failing the request or writing a second variant.
      const [winner] = await tx
        .select()
        .from(profileRecommendations)
        .where(
          suggestionMatch(
            input.analysisId,
            input.section,
            input.itemIndex,
            input.suggestionStyle,
          ),
        )
        .orderBy(asc(profileRecommendations.variantIndex))
        .limit(1);
      if (!winner) {
        throw new Error('Profile suggestion insert returned no row.');
      }
      return winner;
    });
  }

  async updateStatus(
    userId: string,
    recommendationId: string,
    status: RecommendationActionStatus,
  ): Promise<ProfileRecommendationRow | null> {
    return this.db.transaction(async (tx) => {
      const generatedSuggestionCondition =
        status === 'copied'
          ? and(
              isNotNull(profileRecommendations.variantIndex),
              isNotNull(profileRecommendations.suggestedValue),
            )
          : isNotNull(profileRecommendations.variantIndex);
      const [owned] = await tx
        .select({
          id: profileRecommendations.id,
          analysisId: profileRecommendations.analysisId,
        })
        .from(profileRecommendations)
        .innerJoin(
          profileAnalyses,
          eq(profileRecommendations.analysisId, profileAnalyses.id),
        )
        .where(
          and(
            eq(profileRecommendations.id, recommendationId),
            eq(profileAnalyses.userId, userId),
            generatedSuggestionCondition,
          ),
        )
        .limit(1)
        .for('update');
      if (!owned) return null;

      const [updated] = await tx
        .update(profileRecommendations)
        .set({ status })
        .where(
          and(
            eq(profileRecommendations.id, owned.id),
            eq(profileRecommendations.analysisId, owned.analysisId),
          ),
        )
        .returning();

      return updated ?? null;
    });
  }
}

/**
 * Identifies the one generated suggestion for a target. Mirrors the columns of
 * `profile_recommendations_suggestion_variant_uidx` minus `variant_index`, so
 * the lookup and the insert conflict agree on what "already generated" means.
 */
function suggestionMatch(
  analysisId: string,
  section: ProfileSectionId,
  itemIndex: number | null,
  suggestionStyle: PersistedSuggestionStyle,
) {
  return and(
    eq(profileRecommendations.analysisId, analysisId),
    eq(profileRecommendations.section, section),
    itemIndex === null
      ? isNull(profileRecommendations.itemIndex)
      : eq(profileRecommendations.itemIndex, itemIndex),
    eq(profileRecommendations.suggestionStyle, suggestionStyle),
    isNotNull(profileRecommendations.variantIndex),
  );
}
