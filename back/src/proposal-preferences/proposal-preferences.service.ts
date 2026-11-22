import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  proposalPreferences,
  type ProposalPreference,
} from '../database/schema';
import {
  DEFAULT_PROPOSAL_PREFERENCES,
  type ProposalPreferences,
} from './proposal-preferences.schema';

export interface ProposalPreferencesResponse extends ProposalPreferences {
  updatedAt?: string;
}

@Injectable()
export class ProposalPreferencesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async get(userId: string): Promise<ProposalPreferencesResponse> {
    const [row] = await this.db
      .select()
      .from(proposalPreferences)
      .where(eq(proposalPreferences.userId, userId))
      .limit(1);

    return row ? toResponse(row) : { ...DEFAULT_PROPOSAL_PREFERENCES };
  }

  async put(
    userId: string,
    input: ProposalPreferences,
  ): Promise<ProposalPreferencesResponse> {
    const values = {
      proposalLength: input.proposalLength,
      proposalTone: input.proposalTone,
      answerLength: input.answerLength,
      language: input.language,
      signOffName: optionalText(input.signOffName),
      customInstructions: optionalText(input.customInstructions),
    };

    const [row] = await this.db
      .insert(proposalPreferences)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: proposalPreferences.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();

    if (!row) throw new Error('Proposal preferences upsert returned no row.');
    return toResponse(row);
  }
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toResponse(row: ProposalPreference): ProposalPreferencesResponse {
  return {
    proposalLength: row.proposalLength,
    proposalTone: row.proposalTone,
    answerLength: row.answerLength,
    language: row.language,
    ...(row.signOffName ? { signOffName: row.signOffName } : {}),
    ...(row.customInstructions
      ? { customInstructions: row.customInstructions }
      : {}),
    updatedAt: row.updatedAt.toISOString(),
  };
}
