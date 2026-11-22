import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  modelSelections,
  type ModelSelectionRow,
} from '../database/schema';
import type { ModelSelectableCapability } from './capabilities';

export interface UpsertModelSelectionInput {
  capability: ModelSelectableCapability;
  primaryModelId: string;
  fallbackModelId: string;
  notes: string | null;
  updatedByUserId: string;
}

@Injectable()
export class ModelSelectionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByCapability(
    capability: ModelSelectableCapability,
  ): Promise<ModelSelectionRow | null> {
    const [selection] = await this.db
      .select()
      .from(modelSelections)
      .where(eq(modelSelections.capability, capability))
      .limit(1);
    return selection ?? null;
  }

  listAll(): Promise<ModelSelectionRow[]> {
    return this.db.select().from(modelSelections);
  }

  async upsert(
    input: UpsertModelSelectionInput,
  ): Promise<ModelSelectionRow> {
    const [selection] = await this.db
      .insert(modelSelections)
      .values(input)
      .onConflictDoUpdate({
        target: modelSelections.capability,
        set: {
          primaryModelId: input.primaryModelId,
          fallbackModelId: input.fallbackModelId,
          notes: input.notes,
          updatedByUserId: input.updatedByUserId,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!selection) throw new Error('Model selection upsert returned no row.');
    return selection;
  }

  async clear(
    capability: ModelSelectableCapability,
  ): Promise<ModelSelectionRow | null> {
    const [deleted] = await this.db
      .delete(modelSelections)
      .where(eq(modelSelections.capability, capability))
      .returning();
    return deleted ?? null;
  }
}
