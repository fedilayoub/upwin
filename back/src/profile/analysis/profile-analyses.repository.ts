import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { Goal } from '../../database/schema';
import {
  profileAnalyses,
  profileRecommendations,
  profileSnapshots,
  goals,
  type ProfileAnalysisRow,
  type ProfileRecommendationRow,
  type ProfileSnapshotRow,
} from '../../database/schema';
import { DRIZZLE, type Database } from '../../database/database.module';
import type { ProfileSnapshot } from '../../profile-snapshots/profile-snapshot.schema';
import type { RankedRecommendationWithOutcome } from '../recommendations/previous-priority-outcomes';
import type { PreviousPriority } from '../recommendations/verify-previous-priorities';
import type { SectionScore } from '../scoring/profile-scoring';
import {
  analysisUsageSchema,
  sectionScoresWriteSchema,
  type AnalysisUsage,
} from './profile-analysis.schema';
import {
  decodeProfileAnalysisCursor,
  encodeProfileAnalysisCursor,
} from './profile-analysis.cursor';

export interface PersistAnalysisInput {
  userId: string;
  goalId: string;
  snapshot: ProfileSnapshot;
  winningScore: number;
  completenessScore: number | null;
  sectionScores: SectionScore[];
  summary: string;
  promptVersion: string;
  promptRevisionId?: string | null;
  rubricVersion: string;
  scoringVersion: string;
  requestedModel: string;
  gateway: string | null;
  provider: string;
  model: string;
  usage: AnalysisUsage;
  recommendations: RankedRecommendationWithOutcome[];
}

export interface PreviousAnalysisRecord {
  analysisId: string;
  snapshot: ProfileSnapshotRow;
  priorities: PreviousPriority[];
}

export interface PersistedAnalysis {
  analysis: ProfileAnalysisRow;
  recommendations: ProfileRecommendationRow[];
  previousWinningScore: number | null;
}

export interface AnalysisDetailRecord extends PersistedAnalysis {
  goal: Goal;
}

export interface AnalysisListRecord {
  analysis: ProfileAnalysisRow;
  goal: Goal;
  cursorCreatedAt: string;
}

export interface AnalysisProgressRecord {
  id: string;
  createdAt: Date;
  winningScore: number;
  sectionScores: ProfileAnalysisRow['sectionScores'];
}

@Injectable()
export class ProfileAnalysesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The analysis whose priorities a new analysis should judge.
   *
   * Scoped to the same goal on purpose: priorities are derived from goal
   * weights, so advice given under a different goal is not advice the user
   * failed to follow.
   */
  async findPreviousForOutcomes(
    userId: string,
    goalId: string,
  ): Promise<PreviousAnalysisRecord | null> {
    const [previous] = await this.db
      .select({ id: profileAnalyses.id, snapshot: profileSnapshots })
      .from(profileAnalyses)
      .innerJoin(
        profileSnapshots,
        eq(profileAnalyses.profileSnapshotId, profileSnapshots.id),
      )
      .where(
        and(
          eq(profileAnalyses.userId, userId),
          eq(profileAnalyses.goalId, goalId),
        ),
      )
      .orderBy(desc(profileAnalyses.createdAt), desc(profileAnalyses.id))
      .limit(1);
    if (!previous) return null;

    const rows = await this.db
      .select({
        id: profileRecommendations.id,
        section: profileRecommendations.section,
        signal: profileRecommendations.signal,
        recommendation: profileRecommendations.recommendation,
        reason: profileRecommendations.reason,
      })
      .from(profileRecommendations)
      .where(
        and(
          eq(profileRecommendations.analysisId, previous.id),
          // Analyzer priorities only. Generated suggestion variants are not
          // advice in their own right.
          isNull(profileRecommendations.variantIndex),
        ),
      )
      .orderBy(profileRecommendations.rank);

    return {
      analysisId: previous.id,
      snapshot: previous.snapshot,
      priorities: rows,
    };
  }

  async persist(input: PersistAnalysisInput): Promise<PersistedAnalysis> {
    const sectionScores = sectionScoresWriteSchema.parse(input.sectionScores);
    const usage = analysisUsageSchema.parse(input.usage);

    return this.db.transaction(async (tx) => {
      const [previous] = await tx
        .select({ winningScore: profileAnalyses.winningScore })
        .from(profileAnalyses)
        .where(eq(profileAnalyses.userId, input.userId))
        .orderBy(desc(profileAnalyses.createdAt), desc(profileAnalyses.id))
        .limit(1);

      const [snapshot] = await tx
        .insert(profileSnapshots)
        .values(snapshotInsertValues(input.userId, input.snapshot))
        .returning({ id: profileSnapshots.id });
      if (!snapshot)
        throw new Error('Profile snapshot insert returned no row.');

      const [analysis] = await tx
        .insert(profileAnalyses)
        .values({
          userId: input.userId,
          goalId: input.goalId,
          profileSnapshotId: snapshot.id,
          winningScore: input.winningScore,
          completenessScore: input.completenessScore,
          sectionScores,
          summary: input.summary,
          promptVersion: input.promptVersion,
          promptRevisionId: input.promptRevisionId ?? null,
          rubricVersion: input.rubricVersion,
          scoringVersion: input.scoringVersion,
          requestedModel: input.requestedModel,
          gateway: input.gateway,
          provider: input.provider,
          model: input.model,
          usage,
        })
        .returning();
      if (!analysis)
        throw new Error('Profile analysis insert returned no row.');

      const recommendations =
        input.recommendations.length === 0
          ? []
          : await tx
              .insert(profileRecommendations)
              .values(
                input.recommendations.map((recommendation) => {
                  const fill =
                    'kind' in recommendation && recommendation.kind === 'fill'
                      ? recommendation
                      : null;

                  return {
                    analysisId: analysis.id,
                    section: recommendation.section,
                    rank: recommendation.rank,
                    impact: recommendation.impact,
                    estimatedMinutes: recommendation.estimatedMinutes,
                    reason: recommendation.reason,
                    evidence: recommendation.evidence,
                    recommendation: recommendation.recommendation,
                    kind: fill?.kind ?? null,
                    signal:
                      'signal' in recommendation ? recommendation.signal : null,
                    field: fill?.field ?? null,
                    itemIndex: fill?.itemIndex ?? null,
                    guidance: fill?.guidance ?? null,
                    items: fill?.items ?? null,
                    outcomeStatus: recommendation.outcome?.outcomeStatus ?? null,
                    outcomeNote: recommendation.outcome?.outcomeNote ?? null,
                    outcomeAnalysisId:
                      recommendation.outcome?.outcomeAnalysisId ?? null,
                  };
                }),
              )
              .returning();

      return {
        analysis,
        recommendations,
        previousWinningScore: previous?.winningScore ?? null,
      };
    });
  }

  async list(
    userId: string,
    cursor: string | undefined,
    pageSize: number,
  ): Promise<{
    records: AnalysisListRecord[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const decodedCursor =
      cursor === undefined ? null : decodeProfileAnalysisCursor(cursor);
    if (cursor !== undefined && decodedCursor === null) {
      throw new Error('Validated analysis cursor could not be decoded.');
    }

    const cursorCondition =
      decodedCursor === null
        ? undefined
        : (() => {
            const cursorTimestamp = sql`${decodedCursor.createdAt}::timestamptz`;
            return or(
              lt(profileAnalyses.createdAt, cursorTimestamp),
              and(
                eq(profileAnalyses.createdAt, cursorTimestamp),
                lt(profileAnalyses.id, decodedCursor.id),
              ),
            );
          })();
    const rows = await this.db
      .select({
        analysis: profileAnalyses,
        goal: goals,
        cursorCreatedAt: exactAnalysisCreatedAt,
      })
      .from(profileAnalyses)
      .innerJoin(goals, eq(profileAnalyses.goalId, goals.id))
      .where(and(eq(profileAnalyses.userId, userId), cursorCondition))
      .orderBy(desc(profileAnalyses.createdAt), desc(profileAnalyses.id))
      .limit(pageSize + 1);

    const records = rows.slice(0, pageSize);
    const lastRecord = records.at(-1);
    const hasMore = rows.length > pageSize;

    return {
      records,
      hasMore,
      nextCursor:
        hasMore && lastRecord
          ? encodeProfileAnalysisCursor({
              createdAt: lastRecord.cursorCreatedAt,
              id: lastRecord.analysis.id,
            })
          : null,
    };
  }

  async listForProgress(userId: string): Promise<AnalysisProgressRecord[]> {
    return this.db
      .select({
        id: profileAnalyses.id,
        createdAt: profileAnalyses.createdAt,
        winningScore: profileAnalyses.winningScore,
        sectionScores: profileAnalyses.sectionScores,
      })
      .from(profileAnalyses)
      .where(eq(profileAnalyses.userId, userId))
      .orderBy(asc(profileAnalyses.createdAt), asc(profileAnalyses.id));
  }

  async findById(
    userId: string,
    analysisId: string,
  ): Promise<AnalysisDetailRecord | null> {
    const [record] = await this.db
      .select({
        analysis: profileAnalyses,
        goal: goals,
        cursorCreatedAt: exactAnalysisCreatedAt,
      })
      .from(profileAnalyses)
      .innerJoin(goals, eq(profileAnalyses.goalId, goals.id))
      .where(
        and(
          eq(profileAnalyses.id, analysisId),
          eq(profileAnalyses.userId, userId),
        ),
      )
      .limit(1);
    if (!record) return null;

    const recommendationRows = await this.db
      .select({ recommendation: profileRecommendations })
      .from(profileRecommendations)
      .innerJoin(
        profileAnalyses,
        eq(profileRecommendations.analysisId, profileAnalyses.id),
      )
      .where(
        and(
          eq(profileRecommendations.analysisId, record.analysis.id),
          eq(profileAnalyses.userId, userId),
          // Generated alternatives have a variant index. Analyzer priorities may
          // now be deterministic fills, so kind=null is no longer the boundary.
          isNull(profileRecommendations.variantIndex),
        ),
      )
      .orderBy(profileRecommendations.rank);

    const recordTimestamp = sql`${record.cursorCreatedAt}::timestamptz`;
    const [previous] = await this.db
      .select({ winningScore: profileAnalyses.winningScore })
      .from(profileAnalyses)
      .where(
        and(
          eq(profileAnalyses.userId, userId),
          or(
            lt(profileAnalyses.createdAt, recordTimestamp),
            and(
              eq(profileAnalyses.createdAt, recordTimestamp),
              lt(profileAnalyses.id, record.analysis.id),
            ),
          ),
        ),
      )
      .orderBy(desc(profileAnalyses.createdAt), desc(profileAnalyses.id))
      .limit(1);

    return {
      analysis: record.analysis,
      goal: record.goal,
      recommendations: recommendationRows.map((row) => row.recommendation),
      previousWinningScore: previous?.winningScore ?? null,
    };
  }
}

const exactAnalysisCreatedAt = sql<string>`to_char(
  ${profileAnalyses.createdAt} at time zone 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
)`;

function snapshotInsertValues(
  userId: string,
  snapshot: ProfileSnapshot,
): typeof profileSnapshots.$inferInsert {
  return {
    userId,
    source: snapshot.source,
    completeness: snapshot.completeness,
    name: snapshot.profile.name,
    title: snapshot.profile.title,
    overview: snapshot.profile.overview,
    hourlyRate: snapshot.profile.hourlyRate,
    skills: snapshot.profile.skills,
    portfolio: snapshot.profile.portfolio,
    employment: snapshot.profile.employment,
    education: snapshot.profile.education,
    certifications: snapshot.profile.certifications,
    languages: snapshot.profile.languages,
    capturedAt: new Date(snapshot.capturedAt),
  };
}
