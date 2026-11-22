import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  FreelancerExperience,
  FreelancerPortfolio,
  FreelancerPositioning,
  FreelancerPreferences,
  FreelancerSkills,
} from '../../freelancer-context/freelancer-context.schema';
import { users } from './users';

export const FREELANCER_CONTEXT_SOURCES = ['cv', 'manual', 'mixed'] as const;
export type FreelancerContextSource =
  (typeof FREELANCER_CONTEXT_SOURCES)[number];

export const freelancerContexts = pgTable(
  'freelancer_contexts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    experience: jsonb('experience').$type<FreelancerExperience>().notNull(),
    skills: jsonb('skills').$type<FreelancerSkills>().notNull(),
    portfolio: jsonb('portfolio').$type<FreelancerPortfolio>().notNull(),
    preferences: jsonb('preferences').$type<FreelancerPreferences>().notNull(),
    positioning: jsonb('positioning').$type<FreelancerPositioning>().notNull(),
    source: text('source').$type<FreelancerContextSource>().notNull(),
    // This nullable timestamp is the sole trust marker. Null always means draft.
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('freelancer_contexts_user_uidx').on(table.userId)],
);

export type FreelancerContext = typeof freelancerContexts.$inferSelect;
