import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PROPOSAL_LENGTHS = ['short', 'medium', 'long'] as const;
export const PROPOSAL_TONES = [
  'professional',
  'technical',
  'conversational',
  'friendly',
] as const;
export const ANSWER_LENGTHS = ['brief', 'standard', 'detailed'] as const;
/**
 * The languages a draft can be written in, as ISO 639-1 codes. The prompt
 * passes the code through as is. Each one needs a stopword list in
 * `src/ai/validation/output-language.ts`, which the type system enforces.
 */
export const OUTPUT_LANGUAGES = [
  'en',
  'fr',
  'de',
  'es',
  'it',
  'nl',
  'pt',
] as const;

export const proposalLengthSchema = z.enum(PROPOSAL_LENGTHS);
export const proposalToneSchema = z.enum(PROPOSAL_TONES);
export const answerLengthSchema = z.enum(ANSWER_LENGTHS);
export const outputLanguageSchema = z.enum(OUTPUT_LANGUAGES);

export const putProposalPreferencesSchema = z
  .object({
    proposalLength: proposalLengthSchema,
    proposalTone: proposalToneSchema,
    answerLength: answerLengthSchema,
    language: outputLanguageSchema,
    signOffName: z.string().trim().max(120).optional(),
    customInstructions: z.string().trim().max(2_000).optional(),
  })
  .strict();

export type ProposalLength = z.output<typeof proposalLengthSchema>;
export type ProposalTone = z.output<typeof proposalToneSchema>;
export type AnswerLength = z.output<typeof answerLengthSchema>;
export type OutputLanguage = z.output<typeof outputLanguageSchema>;
export type ProposalPreferences = z.output<typeof putProposalPreferencesSchema>;

export const DEFAULT_PROPOSAL_PREFERENCES = {
  proposalLength: 'medium',
  proposalTone: 'professional',
  answerLength: 'standard',
  language: 'en',
} as const satisfies ProposalPreferences;

export class PutProposalPreferencesDto extends createZodDto(
  putProposalPreferencesSchema,
) {}
