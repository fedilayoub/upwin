import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  proposalDrafts,
  type ProposalDraftRow,
} from '../../database/schema';
import type { AnalysisUsage } from '../../profile/analysis/profile-analysis.schema';
import {
  proposalAnswerBlocksSchema,
  proposalBlockSchema,
  proposalBlockStatusesSchema,
  type PersistedProposalAnswer,
  type PersistedProposalBlock,
  type ProposalBlockStatuses,
} from '../job-analysis.schema';

export interface PersistProposalDraftInput {
  userId: string;
  jobAnalysisId: string;
  proposal: PersistedProposalBlock;
  answers: PersistedProposalAnswer[];
  promptVersion: string;
  wordBudgetVersion: string;
  requestedModel: string;
  gateway: string | null;
  provider: string;
  model: string;
  usage: AnalysisUsage;
}

export interface ReplaceProposalDraftInput {
  proposal: PersistedProposalBlock;
  answers: PersistedProposalAnswer[];
  promptVersion: string;
  wordBudgetVersion: string;
  requestedModel: string;
  gateway: string | null;
  provider: string;
  model: string;
  usage: AnalysisUsage;
}

@Injectable()
export class ProposalDraftsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async persist(input: PersistProposalDraftInput): Promise<ProposalDraftRow> {
    const [draft] = await this.db
      .insert(proposalDrafts)
      .values({
        ...input,
        proposal: proposalBlockSchema.parse(input.proposal),
        answers: proposalAnswerBlocksSchema.parse(input.answers),
        blockStatuses: {},
      })
      .returning();
    if (!draft) throw new Error('Proposal draft insert returned no row.');
    return draft;
  }

  async findLatestByAnalysis(
    userId: string,
    analysisId: string,
  ): Promise<ProposalDraftRow | null> {
    const [draft] = await this.db
      .select()
      .from(proposalDrafts)
      .where(
        and(
          eq(proposalDrafts.userId, userId),
          eq(proposalDrafts.jobAnalysisId, analysisId),
        ),
      )
      .orderBy(desc(proposalDrafts.createdAt), desc(proposalDrafts.id))
      .limit(1);
    return draft ?? null;
  }

  async findById(
    userId: string,
    draftId: string,
  ): Promise<ProposalDraftRow | null> {
    const [draft] = await this.db
      .select()
      .from(proposalDrafts)
      .where(
        and(
          eq(proposalDrafts.userId, userId),
          eq(proposalDrafts.id, draftId),
        ),
      )
      .limit(1);
    return draft ?? null;
  }

  async replaceGeneratedContent(
    userId: string,
    draftId: string,
    input: ReplaceProposalDraftInput,
  ): Promise<ProposalDraftRow | null> {
    const [draft] = await this.db
      .update(proposalDrafts)
      .set({
        ...input,
        proposal: proposalBlockSchema.parse(input.proposal),
        answers: proposalAnswerBlocksSchema.parse(input.answers),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(proposalDrafts.userId, userId),
          eq(proposalDrafts.id, draftId),
        ),
      )
      .returning();
    return draft ?? null;
  }

  async updateStatuses(
    userId: string,
    draftId: string,
    blockStatuses: ProposalBlockStatuses,
  ): Promise<ProposalDraftRow | null> {
    const [draft] = await this.db
      .update(proposalDrafts)
      .set({
        blockStatuses: proposalBlockStatusesSchema.parse(blockStatuses),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(proposalDrafts.userId, userId),
          eq(proposalDrafts.id, draftId),
        ),
      )
      .returning();
    return draft ?? null;
  }
}
