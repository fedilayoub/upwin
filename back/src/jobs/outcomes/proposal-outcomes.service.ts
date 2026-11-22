import { Injectable, NotFoundException } from '@nestjs/common';
import { JobAnalysesRepository } from '../analysis/job-analyses.repository';
import {
  proposalOutcomeListResponseSchema,
  proposalOutcomeResponseSchema,
  proposalOutcomeStatsResponseSchema,
  type ListProposalOutcomesQuery,
  type ProposalOutcomeListResponse,
  type ProposalOutcomeResponse,
  type ProposalOutcomeStatsQuery,
  type ProposalOutcomeStatsResponse,
  type PutProposalOutcome,
} from './proposal-outcomes.schema';
import { ProposalOutcomesRepository } from './proposal-outcomes.repository';

const DAY_MS = 86_400_000;

@Injectable()
export class ProposalOutcomesService {
  constructor(
    private readonly outcomes: ProposalOutcomesRepository,
    private readonly analyses: JobAnalysesRepository,
  ) {}

  async put(
    userId: string,
    jobAnalysisId: string,
    input: PutProposalOutcome,
    now = new Date(),
  ): Promise<ProposalOutcomeResponse> {
    const analysis = await this.analyses.findById(userId, jobAnalysisId);
    if (!analysis) throw jobAnalysisNotFound();
    const proposalDraftId = await this.outcomes.findLatestDraftId(
      userId,
      jobAnalysisId,
    );
    const row = await this.outcomes.upsert({
      userId,
      jobAnalysisId,
      proposalDraftId,
      status: input.status,
      connectsSpent: input.connectsSpent,
      sentAt: input.sentAt === undefined ? undefined : new Date(input.sentAt),
      note: input.note,
      now,
    });

    return proposalOutcomeResponseSchema.parse({
      id: row.id,
      jobAnalysisId: row.jobAnalysisId,
      status: row.status,
      connectsSpent: row.connectsSpent,
      sentAt: row.sentAt?.toISOString() ?? null,
      respondedAt: row.respondedAt?.toISOString() ?? null,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async list(
    userId: string,
    query: ListProposalOutcomesQuery,
  ): Promise<ProposalOutcomeListResponse> {
    const page = await this.outcomes.list(
      userId,
      query.cursor,
      query.pageSize,
      query.status,
    );
    return proposalOutcomeListResponseSchema.parse({
      items: page.records.map(({ outcome, jobTitle, jobUrl, matchScore }) => ({
        id: outcome.id,
        jobAnalysisId: outcome.jobAnalysisId,
        jobTitle,
        jobUrl,
        matchScore,
        status: outcome.status,
        connectsSpent: outcome.connectsSpent,
        sentAt: outcome.sentAt?.toISOString() ?? null,
        respondedAt: outcome.respondedAt?.toISOString() ?? null,
        decidedAt: outcome.decidedAt?.toISOString() ?? null,
        note: outcome.note,
        createdAt: outcome.createdAt.toISOString(),
        updatedAt: outcome.updatedAt.toISOString(),
      })),
      pageSize: query.pageSize,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    });
  }

  async stats(
    userId: string,
    query: ProposalOutcomeStatsQuery,
    now = new Date(),
  ): Promise<ProposalOutcomeStatsResponse> {
    const from = outcomeStatsSince(query.window, now);
    const row = await this.outcomes.stats(userId, from);
    return proposalOutcomeStatsResponseSchema.parse({
      window: query.window,
      from: from?.toISOString() ?? null,
      to: now.toISOString(),
      total: row.total,
      applied: row.applied,
      counts: {
        'in-progress': row.inProgress,
        sent: row.sent,
        viewed: row.viewed,
        messaged: row.messaged,
        interviewing: row.interviewing,
        hired: row.hired,
        declined: row.declined,
        'no-response': row.noResponse,
      },
    });
  }
}

function outcomeStatsSince(
  window: ProposalOutcomeStatsQuery['window'],
  now: Date,
): Date | null {
  if (window === 'all') return null;
  const days = window === '30d' ? 30 : window === '90d' ? 90 : 365;
  return new Date(now.getTime() - days * DAY_MS);
}

function jobAnalysisNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Job analysis not found.',
  });
}
