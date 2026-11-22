import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  jobAnalyses,
  jobSnapshots,
  proposalDrafts,
  proposalOutcomes,
  type ProposalOutcomeRow,
  type ProposalOutcomeStatus,
} from '../../database/schema';
import {
  decodeProfileAnalysisCursor,
  encodeProfileAnalysisCursor,
} from '../../profile/analysis/profile-analysis.cursor';

export interface UpsertProposalOutcomeInput {
  userId: string;
  jobAnalysisId: string;
  proposalDraftId: string | null;
  status: ProposalOutcomeStatus;
  connectsSpent?: number | null;
  sentAt?: Date;
  note?: string | null;
  now: Date;
}

export interface ProposalOutcomeListRecord {
  outcome: ProposalOutcomeRow;
  jobTitle: string;
  jobUrl: string;
  matchScore: number;
  cursorCreatedAt: string;
}

export interface ProposalOutcomeStatsRecord extends Record<string, unknown> {
  total: number;
  applied: number;
  inProgress: number;
  sent: number;
  viewed: number;
  messaged: number;
  interviewing: number;
  hired: number;
  declined: number;
  noResponse: number;
}

@Injectable()
export class ProposalOutcomesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findLatestDraftId(
    userId: string,
    jobAnalysisId: string,
  ): Promise<string | null> {
    const [draft] = await this.db
      .select({ id: proposalDrafts.id })
      .from(proposalDrafts)
      .where(
        and(
          eq(proposalDrafts.userId, userId),
          eq(proposalDrafts.jobAnalysisId, jobAnalysisId),
        ),
      )
      .orderBy(desc(proposalDrafts.createdAt), desc(proposalDrafts.id))
      .limit(1);
    return draft?.id ?? null;
  }

  async upsert(input: UpsertProposalOutcomeInput): Promise<ProposalOutcomeRow> {
    const respondedAt = isReplyStatus(input.status) ? input.now : null;
    const decidedAt = isDecisionStatus(input.status) ? input.now : null;
    const [outcome] = await this.db
      .insert(proposalOutcomes)
      .values({
        userId: input.userId,
        jobAnalysisId: input.jobAnalysisId,
        proposalDraftId: input.proposalDraftId,
        status: input.status,
        connectsSpent: input.connectsSpent,
        sentAt:
          input.sentAt ?? (input.status === 'in-progress' ? null : input.now),
        respondedAt,
        decidedAt,
        note: input.note,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoUpdate({
        target: proposalOutcomes.jobAnalysisId,
        set: {
          status: input.status,
          ...(input.connectsSpent !== undefined
            ? { connectsSpent: input.connectsSpent }
            : {}),
          sentAt:
            input.sentAt !== undefined
              ? input.sentAt
              : sql`coalesce(
                  ${proposalOutcomes.sentAt},
                  excluded.sent_at
                )`,
          ...(input.note !== undefined ? { note: input.note } : {}),
          proposalDraftId: sql`coalesce(
            ${proposalOutcomes.proposalDraftId},
            excluded.proposal_draft_id
          )`,
          respondedAt: sql`coalesce(
            ${proposalOutcomes.respondedAt},
            excluded.responded_at
          )`,
          decidedAt: sql`coalesce(
            ${proposalOutcomes.decidedAt},
            excluded.decided_at
          )`,
          updatedAt: input.now,
        },
      })
      .returning();
    if (!outcome) throw new Error('Proposal outcome upsert returned no row.');
    return outcome;
  }

  async ensureTracked(input: {
    userId: string;
    jobAnalysisId: string;
    proposalDraftId: string;
    now: Date;
  }): Promise<void> {
    await this.db
      .insert(proposalOutcomes)
      .values({
        userId: input.userId,
        jobAnalysisId: input.jobAnalysisId,
        proposalDraftId: input.proposalDraftId,
        status: 'in-progress',
        sentAt: null,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoNothing({ target: proposalOutcomes.jobAnalysisId });
  }

  async list(
    userId: string,
    cursor: string | undefined,
    pageSize: number,
    statuses: ProposalOutcomeStatus[] | undefined,
  ): Promise<{
    records: ProposalOutcomeListRecord[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const decoded =
      cursor === undefined ? null : decodeProfileAnalysisCursor(cursor);
    if (cursor !== undefined && decoded === null) {
      throw new Error('Validated outcome cursor could not be decoded.');
    }
    const condition =
      decoded === null
        ? undefined
        : (() => {
            const timestamp = sql`${decoded.createdAt}::timestamptz`;
            return or(
              lt(proposalOutcomes.createdAt, timestamp),
              and(
                eq(proposalOutcomes.createdAt, timestamp),
                lt(proposalOutcomes.id, decoded.id),
              ),
            );
          })();
    const rows = await this.db
      .select({
        outcome: proposalOutcomes,
        jobTitle: sql<string>`${jobSnapshots.snapshot}->'job'->>'title'`,
        jobUrl: jobSnapshots.url,
        matchScore: jobAnalyses.matchScore,
        cursorCreatedAt: exactOutcomeCreatedAt,
      })
      .from(proposalOutcomes)
      .innerJoin(
        jobAnalyses,
        eq(proposalOutcomes.jobAnalysisId, jobAnalyses.id),
      )
      .innerJoin(jobSnapshots, eq(jobAnalyses.jobSnapshotId, jobSnapshots.id))
      .where(
        and(
          eq(proposalOutcomes.userId, userId),
          statuses === undefined
            ? undefined
            : inArray(proposalOutcomes.status, statuses),
          condition,
        ),
      )
      .orderBy(desc(proposalOutcomes.createdAt), desc(proposalOutcomes.id))
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
              id: last.outcome.id,
            })
          : null,
    };
  }

  async stats(
    userId: string,
    since: Date | null,
  ): Promise<ProposalOutcomeStatsRecord> {
    const result = await this.db.execute<ProposalOutcomeStatsRecord>(sql`
      select
        count(*) filter (
          where ${since}::timestamptz is null
            or ${proposalOutcomes.createdAt} >= ${since}
        )::int as total,
        count(*) filter (
          where ${proposalOutcomes.sentAt} is not null
            and (
              ${since}::timestamptz is null
              or ${proposalOutcomes.sentAt} >= ${since}
            )
        )::int as applied,
        count(*) filter (
          where (${since}::timestamptz is null or ${proposalOutcomes.createdAt} >= ${since})
            and ${proposalOutcomes.status} = 'in-progress'
        )::int as "inProgress",
        count(*) filter (
          where (${since}::timestamptz is null or ${proposalOutcomes.createdAt} >= ${since})
            and ${proposalOutcomes.status} = 'sent'
        )::int as sent,
        count(*) filter (
          where (${since}::timestamptz is null or ${proposalOutcomes.createdAt} >= ${since})
            and ${proposalOutcomes.status} = 'viewed'
        )::int as viewed,
        count(*) filter (
          where (${since}::timestamptz is null or ${proposalOutcomes.createdAt} >= ${since})
            and ${proposalOutcomes.status} = 'messaged'
        )::int as messaged,
        count(*) filter (
          where (${since}::timestamptz is null or ${proposalOutcomes.createdAt} >= ${since})
            and ${proposalOutcomes.status} = 'interviewing'
        )::int as interviewing,
        count(*) filter (
          where (${since}::timestamptz is null or ${proposalOutcomes.createdAt} >= ${since})
            and ${proposalOutcomes.status} = 'hired'
        )::int as hired,
        count(*) filter (
          where (${since}::timestamptz is null or ${proposalOutcomes.createdAt} >= ${since})
            and ${proposalOutcomes.status} = 'declined'
        )::int as declined,
        count(*) filter (
          where (${since}::timestamptz is null or ${proposalOutcomes.createdAt} >= ${since})
            and ${proposalOutcomes.status} = 'no-response'
        )::int as "noResponse"
      from ${proposalOutcomes}
      where ${proposalOutcomes.userId} = ${userId}
    `);
    const row = result.rows[0];
    if (!row) throw new Error('Proposal outcome stats query returned no row.');
    return row;
  }
}

const exactOutcomeCreatedAt = sql<string>`to_char(
  ${proposalOutcomes.createdAt} at time zone 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
)`;

function isReplyStatus(status: ProposalOutcomeStatus): boolean {
  return (
    status === 'viewed' ||
    status === 'messaged' ||
    status === 'interviewing' ||
    status === 'hired'
  );
}

function isDecisionStatus(status: ProposalOutcomeStatus): boolean {
  return status === 'hired' || status === 'declined';
}
