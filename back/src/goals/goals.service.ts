import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  goals,
  jobAnalyses,
  profileAnalyses,
  users,
  type Goal,
} from '../database/schema';
import type { CreateGoal, UpdateGoal } from './goal.schema';

export interface GoalResponse {
  id: string;
  objective: Goal['objective'];
  targetRole: string;
  targetProjectTypes: string[];
  targetClients: string[];
  preferredSkills: string[];
  targetRate: { min?: number; max?: number } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class GoalsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(authenticatedUserId: string): Promise<GoalResponse[]> {
    const rows = await this.db
      .select()
      .from(goals)
      .where(eq(goals.userId, authenticatedUserId))
      .orderBy(desc(goals.createdAt));

    return rows.map(toGoalResponse);
  }

  async getActive(authenticatedUserId: string): Promise<GoalResponse> {
    const [goal] = await this.db
      .select()
      .from(goals)
      .where(
        and(eq(goals.userId, authenticatedUserId), eq(goals.isActive, true)),
      )
      .limit(1);

    if (!goal) throw goalNotFound();
    return toGoalResponse(goal);
  }

  async findForAnalysis(
    authenticatedUserId: string,
    goalId?: string,
  ): Promise<GoalResponse | null> {
    const ownership = eq(goals.userId, authenticatedUserId);
    const selector =
      goalId === undefined
        ? and(ownership, eq(goals.isActive, true))
        : and(ownership, eq(goals.id, goalId));
    const [goal] = await this.db.select().from(goals).where(selector).limit(1);

    return goal ? toGoalResponse(goal) : null;
  }

  async create(
    authenticatedUserId: string,
    input: CreateGoal,
  ): Promise<GoalResponse> {
    const created = await this.db.transaction(async (tx) => {
      // Lock the user's goal set so concurrent activations serialize. The partial
      // unique index remains the final database-level invariant.
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, authenticatedUserId))
        .for('update');

      await tx
        .update(goals)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(eq(goals.userId, authenticatedUserId), eq(goals.isActive, true)),
        );

      const [row] = await tx
        .insert(goals)
        .values({
          userId: authenticatedUserId,
          objective: input.objective,
          targetRole: input.targetRole,
          targetProjectTypes: input.targetProjectTypes,
          targetClients: input.targetClients,
          preferredSkills: input.preferredSkills,
          targetRateMin: input.targetRate?.min,
          targetRateMax: input.targetRate?.max,
          isActive: true,
        })
        .returning();

      if (!row) throw new Error('Goal insert returned no row.');
      return row;
    });

    return toGoalResponse(created);
  }

  async update(
    authenticatedUserId: string,
    goalId: string,
    input: UpdateGoal,
  ): Promise<GoalResponse> {
    const updated = await this.db.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, authenticatedUserId))
        .for('update');

      const [ownedGoal] = await tx
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.id, goalId), eq(goals.userId, authenticatedUserId)))
        .limit(1);

      if (!ownedGoal) throw goalNotFound();

      if (input.isActive) {
        await tx
          .update(goals)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(goals.userId, authenticatedUserId),
              eq(goals.isActive, true),
            ),
          );
      }

      const values = goalUpdateValues(input);
      const [row] = await tx
        .update(goals)
        .set(values)
        .where(and(eq(goals.id, goalId), eq(goals.userId, authenticatedUserId)))
        .returning();

      if (!row) throw goalNotFound();
      return row;
    });

    return toGoalResponse(updated);
  }

  /**
   * Deletes an owned goal. Goals referenced by a stored analysis are kept: the
   * analysis rows carry `ON DELETE RESTRICT` so history never loses the goal it
   * was scored against. Deleting the active goal promotes the newest remaining
   * goal so the account never ends up with goals but no active one.
   */
  async delete(authenticatedUserId: string, goalId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, authenticatedUserId))
        .for('update');

      const [ownedGoal] = await tx
        .select({ id: goals.id, isActive: goals.isActive })
        .from(goals)
        .where(and(eq(goals.id, goalId), eq(goals.userId, authenticatedUserId)))
        .limit(1);

      if (!ownedGoal) throw goalNotFound();

      const [profileReference] = await tx
        .select({ id: profileAnalyses.id })
        .from(profileAnalyses)
        .where(eq(profileAnalyses.goalId, goalId))
        .limit(1);
      const [jobReference] = await tx
        .select({ id: jobAnalyses.id })
        .from(jobAnalyses)
        .where(eq(jobAnalyses.goalId, goalId))
        .limit(1);

      if (profileReference || jobReference) throw goalInUse();

      await tx
        .delete(goals)
        .where(and(eq(goals.id, goalId), eq(goals.userId, authenticatedUserId)));

      if (!ownedGoal.isActive) return;

      const [successor] = await tx
        .select({ id: goals.id })
        .from(goals)
        .where(eq(goals.userId, authenticatedUserId))
        .orderBy(desc(goals.createdAt))
        .limit(1);

      if (!successor) return;

      await tx
        .update(goals)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(goals.id, successor.id));
    });
  }
}

function goalUpdateValues(
  input: UpdateGoal,
): Partial<typeof goals.$inferInsert> {
  const values: Partial<typeof goals.$inferInsert> = { updatedAt: new Date() };

  if (input.objective !== undefined) values.objective = input.objective;
  if (input.targetRole !== undefined) values.targetRole = input.targetRole;
  if (input.targetProjectTypes !== undefined) {
    values.targetProjectTypes = input.targetProjectTypes;
  }
  if (input.targetClients !== undefined)
    values.targetClients = input.targetClients;
  if (input.preferredSkills !== undefined) {
    values.preferredSkills = input.preferredSkills;
  }
  if (input.targetRate !== undefined) {
    values.targetRateMin = input.targetRate?.min ?? null;
    values.targetRateMax = input.targetRate?.max ?? null;
  }
  if (input.isActive) values.isActive = true;

  return values;
}

function toGoalResponse(goal: Goal): GoalResponse {
  const targetRate =
    goal.targetRateMin === null && goal.targetRateMax === null
      ? null
      : {
          ...(goal.targetRateMin === null ? {} : { min: goal.targetRateMin }),
          ...(goal.targetRateMax === null ? {} : { max: goal.targetRateMax }),
        };

  return {
    id: goal.id,
    objective: goal.objective,
    targetRole: goal.targetRole,
    targetProjectTypes: goal.targetProjectTypes,
    targetClients: goal.targetClients,
    preferredSkills: goal.preferredSkills,
    targetRate,
    isActive: goal.isActive,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

function goalInUse(): ConflictException {
  return new ConflictException({
    code: 'GOAL_IN_USE',
    message:
      'This goal is referenced by saved analyses and cannot be deleted. Switch to another goal instead.',
  });
}

function goalNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Goal not found.',
  });
}
