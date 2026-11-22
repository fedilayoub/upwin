import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AnalysisUsage } from '../../profile/analysis/profile-analysis.schema';
import type { PersistedJobDimensionScore } from '../../jobs/job-analysis.schema';
import { goals } from './goals';
import { jobSnapshots } from './job-snapshots';
import { users } from './users';

export const jobAnalyses = pgTable(
  'job_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'restrict' }),
    jobSnapshotId: uuid('job_snapshot_id')
      .notNull()
      .references(() => jobSnapshots.id, { onDelete: 'cascade' }),
    matchScore: integer('match_score').notNull(),
    dimensionScores: jsonb('dimension_scores')
      .$type<PersistedJobDimensionScore[]>()
      .notNull(),
    summary: text('summary').notNull(),
    strengths: jsonb('strengths').$type<string[]>().notNull(),
    concerns: jsonb('concerns').$type<string[]>().notNull(),
    questionCount: integer('question_count').notNull(),
    promptVersion: text('prompt_version').notNull(),
    rubricVersion: text('rubric_version').notNull(),
    scoringVersion: text('scoring_version').notNull(),
    requestedModel: text('requested_model').notNull(),
    gateway: text('gateway'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    usage: jsonb('usage').$type<AnalysisUsage>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('job_analyses_user_created_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

export type JobAnalysisRow = typeof jobAnalyses.$inferSelect;
