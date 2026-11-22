import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { GoalObjective } from '../../goals/goal.schema';
import { users } from './users';

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    objective: text('objective').$type<GoalObjective>().notNull(),
    targetRole: text('target_role').notNull(),
    targetProjectTypes: jsonb('target_project_types')
      .$type<string[]>()
      .notNull(),
    targetClients: jsonb('target_clients').$type<string[]>().notNull(),
    preferredSkills: jsonb('preferred_skills').$type<string[]>().notNull(),
    targetRateMin: doublePrecision('target_rate_min'),
    targetRateMax: doublePrecision('target_rate_max'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('goals_user_active_idx').on(table.userId, table.isActive),
    uniqueIndex('goals_one_active_per_user_uidx')
      .on(table.userId)
      .where(sql`${table.isActive}`),
  ],
);

export type Goal = typeof goals.$inferSelect;
