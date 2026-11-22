import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { jobAnalyses } from './job-analyses';
import { proposalDrafts } from './proposal-drafts';
import { users } from './users';

/** Pipeline order. The applications board renders lanes in this order. */
export const PROPOSAL_OUTCOME_STATUSES = [
  'in-progress',
  'sent',
  'viewed',
  'messaged',
  'interviewing',
  'hired',
  'declined',
  'no-response',
] as const;

export type ProposalOutcomeStatus = (typeof PROPOSAL_OUTCOME_STATUSES)[number];

export const proposalOutcomes = pgTable(
  'proposal_outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobAnalysisId: uuid('job_analysis_id')
      .notNull()
      .references(() => jobAnalyses.id, { onDelete: 'cascade' }),
    proposalDraftId: uuid('proposal_draft_id').references(
      () => proposalDrafts.id,
      { onDelete: 'set null' },
    ),
    status: text('status').$type<ProposalOutcomeStatus>().notNull(),
    connectsSpent: integer('connects_spent'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('proposal_outcomes_job_analysis_uidx').on(table.jobAnalysisId),
    index('proposal_outcomes_user_sent_idx').on(
      table.userId,
      table.sentAt.desc(),
    ),
    index('proposal_outcomes_user_created_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),
    index('proposal_outcomes_user_status_idx').on(table.userId, table.status),
  ],
);

export type ProposalOutcomeRow = typeof proposalOutcomes.$inferSelect;
