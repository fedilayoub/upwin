import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { JobSnapshot } from '../../job-snapshots/job-snapshot.schema';
import { users } from './users';

export const jobSnapshots = pgTable(
  'job_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ciphertext: text('ciphertext').notNull(),
    url: text('url').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    source: text('source').$type<JobSnapshot['source']>().notNull(),
    snapshot: jsonb('snapshot').$type<JobSnapshot>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('job_snapshots_user_created_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),
  ],
);

export type JobSnapshotRow = typeof jobSnapshots.$inferSelect;
