import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  type Certification,
  type Education,
  type Employment,
  type Language,
  type PortfolioItem,
  type ProfileCompleteness,
  type ProfileSnapshot,
} from '../../profile-snapshots/profile-snapshot.schema';
import { users } from './users';

export const profileSnapshots = pgTable(
  'profile_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').$type<ProfileSnapshot['source']>().notNull(),
    completeness: jsonb('completeness').$type<ProfileCompleteness>().notNull(),
    name: text('name'),
    title: text('title'),
    overview: text('overview'),
    hourlyRate: doublePrecision('hourly_rate'),
    skills: jsonb('skills').$type<string[]>().notNull(),
    portfolio: jsonb('portfolio').$type<PortfolioItem[]>().notNull(),
    employment: jsonb('employment').$type<Employment[]>().notNull(),
    education: jsonb('education').$type<Education[]>().notNull(),
    certifications: jsonb('certifications').$type<Certification[]>().notNull(),
    languages: jsonb('languages').$type<Language[]>().notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('profile_snapshots_user_captured_idx').on(
      table.userId,
      table.capturedAt.desc(),
    ),
  ],
);

export type ProfileSnapshotRow = typeof profileSnapshots.$inferSelect;
