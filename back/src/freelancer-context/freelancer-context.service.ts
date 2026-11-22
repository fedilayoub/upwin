import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { freelancerContexts, type FreelancerContext } from '../database/schema';
import {
  freelancerContextFieldsSchema,
  type FreelancerContextFields,
} from './freelancer-context.schema';

export interface FreelancerContextResponse extends FreelancerContextFields {
  id: string;
  source: FreelancerContext['source'];
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerContextSaveResponse
  extends FreelancerContextResponse {
  replaced: boolean;
}

@Injectable()
export class FreelancerContextService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async get(
    authenticatedUserId: string,
  ): Promise<FreelancerContextResponse | null> {
    const row = await this.findByUserId(authenticatedUserId);
    return row === null ? null : toResponse(row);
  }

  createManual(
    authenticatedUserId: string,
    fields: FreelancerContextFields,
  ): Promise<FreelancerContextSaveResponse> {
    return this.saveDraft(authenticatedUserId, fields, 'manual');
  }

  saveCvDraft(
    authenticatedUserId: string,
    fields: FreelancerContextFields,
  ): Promise<FreelancerContextSaveResponse> {
    return this.saveDraft(authenticatedUserId, fields, 'cv');
  }

  async delete(authenticatedUserId: string): Promise<void> {
    await this.db
      .delete(freelancerContexts)
      .where(eq(freelancerContexts.userId, authenticatedUserId));
  }

  async update(
    authenticatedUserId: string,
    fields: Partial<FreelancerContextFields>,
  ): Promise<FreelancerContextResponse> {
    const updated = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(freelancerContexts)
        .where(eq(freelancerContexts.userId, authenticatedUserId))
        .limit(1)
        .for('update');
      if (!existing) throw contextNotFound();

      const [row] = await tx
        .update(freelancerContexts)
        .set({
          ...fields,
          source: existing.source === 'manual' ? 'manual' : 'mixed',
          // Editing any extracted field invalidates the previous confirmation.
          confirmedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(freelancerContexts.userId, authenticatedUserId))
        .returning();

      if (!row) throw contextNotFound();
      return row;
    });

    return toResponse(updated);
  }

  async confirm(
    authenticatedUserId: string,
  ): Promise<FreelancerContextResponse> {
    const confirmed = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(freelancerContexts)
        .where(eq(freelancerContexts.userId, authenticatedUserId))
        .limit(1)
        .for('update');
      if (!existing || !hasMeaningfulContext(parseFields(existing))) {
        throw new ConflictException({
          code: 'CONTEXT_INCOMPLETE',
          message: 'Add freelancer details before confirming this context.',
        });
      }

      const [row] = await tx
        .update(freelancerContexts)
        .set({ confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(freelancerContexts.userId, authenticatedUserId))
        .returning();

      if (!row) throw contextNotFound();
      return row;
    });

    return toResponse(confirmed);
  }

  /** The only context reader the analyzers should use. */
  async findConfirmedByUserId(
    authenticatedUserId: string,
  ): Promise<FreelancerContextFields | null> {
    const [row] = await this.db
      .select()
      .from(freelancerContexts)
      .where(
        and(
          eq(freelancerContexts.userId, authenticatedUserId),
          isNotNull(freelancerContexts.confirmedAt),
        ),
      )
      .limit(1);

    return row ? parseFields(row) : null;
  }

  private async saveDraft(
    authenticatedUserId: string,
    fields: FreelancerContextFields,
    source: 'cv' | 'manual',
  ): Promise<FreelancerContextSaveResponse> {
    const { replaced, saved } = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: freelancerContexts.id })
        .from(freelancerContexts)
        .where(eq(freelancerContexts.userId, authenticatedUserId))
        .limit(1)
        .for('update');

      const [row] = await tx
        .insert(freelancerContexts)
        .values({
          userId: authenticatedUserId,
          ...fields,
          source,
          confirmedAt: null,
        })
        .onConflictDoUpdate({
          target: freelancerContexts.userId,
          set: { ...fields, source, confirmedAt: null, updatedAt: new Date() },
        })
        .returning();

      if (!row) throw new Error('Freelancer context upsert returned no row.');
      return { replaced: existing !== undefined, saved: row };
    });

    return { ...toResponse(saved), replaced };
  }

  private async findByUserId(
    userId: string,
  ): Promise<FreelancerContext | null> {
    const [row] = await this.db
      .select()
      .from(freelancerContexts)
      .where(eq(freelancerContexts.userId, userId))
      .limit(1);

    return row ?? null;
  }
}

function parseFields(row: FreelancerContext): FreelancerContextFields {
  return freelancerContextFieldsSchema.parse({
    experience: row.experience,
    skills: row.skills,
    portfolio: row.portfolio,
    preferences: row.preferences,
    positioning: row.positioning,
  });
}

function toResponse(row: FreelancerContext): FreelancerContextResponse {
  return {
    id: row.id,
    ...parseFields(row),
    source: row.source,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function hasMeaningfulContext(fields: FreelancerContextFields): boolean {
  return (
    fields.experience.years !== undefined ||
    fields.experience.roles.length > 0 ||
    fields.skills.length > 0 ||
    fields.portfolio.length > 0 ||
    fields.preferences.tone !== undefined ||
    (fields.preferences.services?.length ?? 0) > 0 ||
    fields.positioning.targetRole !== undefined ||
    (fields.positioning.targetClients?.length ?? 0) > 0 ||
    (fields.positioning.targetIndustries?.length ?? 0) > 0 ||
    fields.positioning.targetRate !== undefined
  );
}

function contextNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Freelancer context not found.',
  });
}
