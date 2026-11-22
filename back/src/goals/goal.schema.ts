import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GOAL_OBJECTIVES = [
  'first-client',
  'more-clients',
  'more-responses',
  'higher-paying-projects',
  'scale',
] as const;

export const goalObjectiveSchema = z.enum(GOAL_OBJECTIVES);

const nonEmptyText = z.string().trim().min(1).max(500);
const stringList = z.array(nonEmptyText).max(50);
const targetRateSchema = z
  .object({
    min: z.number().finite().nonnegative().max(1_000_000).optional(),
    max: z.number().finite().nonnegative().max(1_000_000).optional(),
  })
  .strict()
  .refine(
    ({ min, max }) => min === undefined || max === undefined || min <= max,
    'Target rate minimum cannot exceed the maximum.',
  );

export const createGoalSchema = z
  .object({
    objective: goalObjectiveSchema,
    targetRole: nonEmptyText,
    targetProjectTypes: stringList.min(1),
    targetClients: stringList.optional().default([]),
    preferredSkills: stringList.optional().default([]),
    targetRate: targetRateSchema.nullable().optional(),
  })
  .strict();

export const updateGoalSchema = z
  .object({
    objective: goalObjectiveSchema.optional(),
    targetRole: nonEmptyText.optional(),
    targetProjectTypes: stringList.min(1).optional(),
    targetClients: stringList.optional(),
    preferredSkills: stringList.optional(),
    targetRate: targetRateSchema.nullable().optional(),
    // Deactivating an active goal directly could leave the user with no active goal.
    // Activating another goal performs the switch transactionally.
    isActive: z.literal(true).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required.',
  );

export type CreateGoal = z.output<typeof createGoalSchema>;
export type UpdateGoal = z.output<typeof updateGoalSchema>;
export type GoalObjective = z.output<typeof goalObjectiveSchema>;

export class CreateGoalDto extends createZodDto(createGoalSchema) {}
export class UpdateGoalDto extends createZodDto(updateGoalSchema) {}
