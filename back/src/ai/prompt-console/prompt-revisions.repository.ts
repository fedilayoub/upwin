import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { AiCapability } from '../capabilities';
import type { AnalyzerTemplateContent } from '../prompts/prompt-template.schema';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  promptRevisions,
  type PromptRevision,
} from '../../database/schema';

export interface CreatePromptDraftInput {
  capability: AiCapability;
  content: AnalyzerTemplateContent;
  notes: string | null;
  createdByUserId: string;
}

@Injectable()
export class PromptRevisionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findActive(capability: AiCapability): Promise<PromptRevision | null> {
    const [revision] = await this.db
      .select()
      .from(promptRevisions)
      .where(
        and(
          eq(promptRevisions.capability, capability),
          eq(promptRevisions.status, 'active'),
        ),
      )
      .limit(1);

    return revision ?? null;
  }

  async findById(id: string): Promise<PromptRevision | null> {
    const [revision] = await this.db
      .select()
      .from(promptRevisions)
      .where(eq(promptRevisions.id, id))
      .limit(1);

    return revision ?? null;
  }

  listByCapability(capability: AiCapability): Promise<PromptRevision[]> {
    return this.db
      .select()
      .from(promptRevisions)
      .where(eq(promptRevisions.capability, capability))
      .orderBy(
        desc(promptRevisions.revisionNumber),
        desc(promptRevisions.createdAt),
      );
  }

  createDraft(input: CreatePromptDraftInput): Promise<PromptRevision> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${input.capability}))`,
      );
      const [latest] = await tx
        .select({ revisionNumber: promptRevisions.revisionNumber })
        .from(promptRevisions)
        .where(eq(promptRevisions.capability, input.capability))
        .orderBy(desc(promptRevisions.revisionNumber))
        .limit(1);
      const [created] = await tx
        .insert(promptRevisions)
        .values({
          capability: input.capability,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          status: 'draft',
          content: input.content,
          notes: input.notes,
          createdByUserId: input.createdByUserId,
        })
        .returning();

      if (!created) throw new Error('Prompt revision insert returned no row.');
      return created;
    });
  }

  async updateDraft(
    id: string,
    content: AnalyzerTemplateContent,
    notes: string | null,
  ): Promise<PromptRevision | null> {
    const [updated] = await this.db
      .update(promptRevisions)
      .set({ content, notes })
      .where(
        and(
          eq(promptRevisions.id, id),
          eq(promptRevisions.status, 'draft'),
        ),
      )
      .returning();

    return updated ?? null;
  }

  activate(id: string, capability: AiCapability): Promise<PromptRevision | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${capability}))`,
      );
      const [target] = await tx
        .select()
        .from(promptRevisions)
        .where(
          and(
            eq(promptRevisions.id, id),
            eq(promptRevisions.capability, capability),
          ),
        )
        .limit(1);
      if (!target) return null;
      if (target.status === 'active') return target;

      const now = new Date();
      await tx
        .update(promptRevisions)
        .set({ status: 'retired', retiredAt: now })
        .where(
          and(
            eq(promptRevisions.capability, capability),
            eq(promptRevisions.status, 'active'),
            ne(promptRevisions.id, id),
          ),
        );
      const [activated] = await tx
        .update(promptRevisions)
        .set({ status: 'active', activatedAt: now, retiredAt: null })
        .where(
          and(
            eq(promptRevisions.id, id),
            eq(promptRevisions.capability, capability),
            ne(promptRevisions.status, 'active'),
          ),
        )
        .returning();

      return activated ?? null;
    });
  }

  retireActive(capability: AiCapability): Promise<PromptRevision | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${capability}))`,
      );
      const [retired] = await tx
        .update(promptRevisions)
        .set({ status: 'retired', retiredAt: new Date() })
        .where(
          and(
            eq(promptRevisions.capability, capability),
            eq(promptRevisions.status, 'active'),
          ),
        )
        .returning();

      return retired ?? null;
    });
  }
}
