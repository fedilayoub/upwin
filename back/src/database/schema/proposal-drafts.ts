import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  PersistedProposalAnswer,
  PersistedProposalBlock,
  ProposalBlockStatuses,
} from '../../jobs/job-analysis.schema';
import type { AnalysisUsage } from '../../profile/analysis/profile-analysis.schema';
import { jobAnalyses } from './job-analyses';
import { users } from './users';

export const proposalDrafts = pgTable(
  'proposal_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobAnalysisId: uuid('job_analysis_id')
      .notNull()
      .references(() => jobAnalyses.id, { onDelete: 'cascade' }),
    proposal: jsonb('proposal').$type<PersistedProposalBlock>().notNull(),
    answers: jsonb('answers').$type<PersistedProposalAnswer[]>().notNull(),
    promptVersion: text('prompt_version').notNull(),
    wordBudgetVersion: text('word_budget_version').notNull(),
    requestedModel: text('requested_model').notNull(),
    gateway: text('gateway'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    usage: jsonb('usage').$type<AnalysisUsage>().notNull(),
    blockStatuses: jsonb('block_statuses')
      .$type<ProposalBlockStatuses>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('proposal_drafts_analysis_created_idx').on(
      table.userId,
      table.jobAnalysisId,
      table.createdAt.desc(),
    ),
  ],
);

export type ProposalDraftRow = typeof proposalDrafts.$inferSelect;
