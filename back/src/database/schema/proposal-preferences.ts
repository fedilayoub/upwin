import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  AnswerLength,
  OutputLanguage,
  ProposalLength,
  ProposalTone,
} from '../../proposal-preferences/proposal-preferences.schema';
import { users } from './users';

export const proposalPreferences = pgTable(
  'proposal_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    proposalLength: text('proposal_length').$type<ProposalLength>().notNull(),
    proposalTone: text('proposal_tone').$type<ProposalTone>().notNull(),
    answerLength: text('answer_length').$type<AnswerLength>().notNull(),
    language: text('language').$type<OutputLanguage>().notNull(),
    signOffName: text('sign_off_name'),
    customInstructions: text('custom_instructions'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('proposal_preferences_user_uidx').on(table.userId),
  ],
);

export type ProposalPreference = typeof proposalPreferences.$inferSelect;
