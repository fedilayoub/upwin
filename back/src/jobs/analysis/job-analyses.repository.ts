import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { LanguageModelUsage } from 'ai';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  goals,
  jobAnalyses,
  jobSnapshots,
  type Goal,
  type JobAnalysisRow,
  type JobSnapshotRow,
} from '../../database/schema';
import {
  analysisUsageSchema,
  type AnalysisUsage,
} from '../../profile/analysis/profile-analysis.schema';
import {
  decodeProfileAnalysisCursor,
  encodeProfileAnalysisCursor,
} from '../../profile/analysis/profile-analysis.cursor';
import {
  jobDimensionScoresSchema,
  type PersistedJobDimensionScore,
} from '../job-analysis.schema';

export interface PersistJobAnalysisInput {
  userId: string;
  goalId: string;
  jobSnapshotId: string;
  matchScore: number;
  dimensionScores: PersistedJobDimensionScore[];
  summary: string;
  strengths: string[];
  concerns: string[];
  questionCount: number;
  promptVersion: string;
  rubricVersion: string;
  scoringVersion: string;
  requestedModel: string;
  gateway: string | null;
  provider: string;
  model: string;
  usage: AnalysisUsage;
}

export interface JobAnalysisDetailRecord {
  analysis: JobAnalysisRow;
  goal: Goal;
  snapshot: JobSnapshotRow;
  cursorCreatedAt: string;
}

@Injectable()
export class JobAnalysesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async persist(input: PersistJobAnalysisInput): Promise<JobAnalysisRow> {
    const dimensionScores = jobDimensionScoresSchema.parse(
      input.dimensionScores,
    );
    const usage = analysisUsageSchema.parse(input.usage);
    const [analysis] = await this.db
      .insert(jobAnalyses)
      .values({ ...input, dimensionScores, usage })
      .returning();
    if (!analysis) throw new Error('Job analysis insert returned no row.');
    return analysis;
  }

  async findById(
    userId: string,
    analysisId: string,
  ): Promise<JobAnalysisDetailRecord | null> {
    const [record] = await this.baseQuery()
      .where(
        and(eq(jobAnalyses.userId, userId), eq(jobAnalyses.id, analysisId)),
      )
      .limit(1);
    return record ?? null;
  }

  async list(
    userId: string,
    cursor: string | undefined,
    pageSize: number,
  ): Promise<{
    records: JobAnalysisDetailRecord[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const decoded =
      cursor === undefined ? null : decodeProfileAnalysisCursor(cursor);
    if (cursor !== undefined && decoded === null) {
      throw new Error('Validated job analysis cursor could not be decoded.');
    }
    const condition =
      decoded === null
        ? undefined
        : (() => {
            const timestamp = sql`${decoded.createdAt}::timestamptz`;
            return or(
              lt(jobAnalyses.createdAt, timestamp),
              and(
                eq(jobAnalyses.createdAt, timestamp),
                lt(jobAnalyses.id, decoded.id),
              ),
            );
          })();
    const rows = await this.baseQuery()
      .where(and(eq(jobAnalyses.userId, userId), condition))
      .orderBy(desc(jobAnalyses.createdAt), desc(jobAnalyses.id))
      .limit(pageSize + 1);
    const records = rows.slice(0, pageSize);
    const last = records.at(-1);
    const hasMore = rows.length > pageSize;

    return {
      records,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeProfileAnalysisCursor({
              createdAt: last.cursorCreatedAt,
              id: last.analysis.id,
            })
          : null,
    };
  }

  private baseQuery() {
    return this.db
      .select({
        analysis: jobAnalyses,
        goal: goals,
        snapshot: jobSnapshots,
        cursorCreatedAt: exactJobAnalysisCreatedAt,
      })
      .from(jobAnalyses)
      .innerJoin(goals, eq(jobAnalyses.goalId, goals.id))
      .innerJoin(
        jobSnapshots,
        eq(jobAnalyses.jobSnapshotId, jobSnapshots.id),
      );
  }
}

export function normalizeJobAnalysisUsage(
  usage: LanguageModelUsage,
): AnalysisUsage {
  return analysisUsageSchema.parse({
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
  });
}

const exactJobAnalysisCreatedAt = sql<string>`to_char(
  ${jobAnalyses.createdAt} at time zone 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
)`;
