import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AiCapability } from '../../ai/capabilities';
import { users } from './users';

export const modelSelections = pgTable(
  'model_selections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capability: text('capability').$type<AiCapability>().notNull(),
    primaryModelId: text('primary_model_id').notNull(),
    fallbackModelId: text('fallback_model_id').notNull(),
    notes: text('notes'),
    updatedByUserId: uuid('updated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('model_selections_capability_uidx').on(table.capability),
  ],
);

export type ModelSelectionRow = typeof modelSelections.$inferSelect;
