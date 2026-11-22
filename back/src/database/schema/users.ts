import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The community edition is single-user: one row, created on first request
 * with the fixed id below. Every owned table still keys on `users.id`, so a
 * future multi-user mode needs no data migration of its own.
 */
export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
