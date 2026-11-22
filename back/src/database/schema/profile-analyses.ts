import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  AnalysisUsage,
  PersistedSectionScore,
} from '../../profile/analysis/profile-analysis.schema';
import { goals } from './goals';
import { promptRevisions } from './prompt-revisions';
import { profileSnapshots } from './profile-snapshots';
import { users } from './users';

export const profileAnalyses = pgTable(
  'profile_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'restrict' }),
    profileSnapshotId: uuid('profile_snapshot_id')
      .notNull()
      .references(() => profileSnapshots.id, { onDelete: 'cascade' }),
    promptRevisionId: uuid('prompt_revision_id').references(
      () => promptRevisions.id,
      { onDelete: 'restrict' },
    ),
    winningScore: integer('winning_score').notNull(),
    // Nullable only for legacy/manual snapshots where every completeness fact
    // was unreadable; unknown data must not be presented as a zero score.
    completenessScore: integer('completeness_score'),
    sectionScores: jsonb('section_scores')
      .$type<PersistedSectionScore[]>()
      .notNull(),
    summary: text('summary').notNull(),
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
    index('profile_analyses_user_created_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

export type ProfileAnalysisRow = typeof profileAnalyses.$inferSelect;
