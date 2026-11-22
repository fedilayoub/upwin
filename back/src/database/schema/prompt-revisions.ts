import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AiCapability } from '../../ai/capabilities';
import type { AnalyzerTemplateContent } from '../../ai/prompts/prompt-template.schema';
import { users } from './users';

export type PromptRevisionStatus = 'draft' | 'active' | 'retired';

export const promptRevisions = pgTable(
  'prompt_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capability: text('capability').$type<AiCapability>().notNull(),
    revisionNumber: integer('revision_number').notNull(),
    status: text('status').$type<PromptRevisionStatus>().notNull(),
    content: jsonb('content').$type<AnalyzerTemplateContent>().notNull(),
    notes: text('notes'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('prompt_revisions_capability_revision_uidx').on(
      table.capability,
      table.revisionNumber,
    ),
    uniqueIndex('prompt_revisions_one_active_capability_uidx')
      .on(table.capability)
      .where(sql`${table.status} = 'active'`),
  ],
);

export type PromptRevision = typeof promptRevisions.$inferSelect;
