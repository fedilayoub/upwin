import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { profileSnapshotSchema } from '../../profile-snapshots/profile-snapshot.schema';
import { PROFILE_SECTION_IDS } from '../profile-section';
import { isProfileAnalysisCursor } from './profile-analysis.cursor';

export const sectionScoreSchema = z
  .object({
    id: z.enum(PROFILE_SECTION_IDS),
    score: z.number().int().min(0).max(100),
    criteria: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            evidence: z.array(z.string().min(1)),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const sectionScoreWriteSchema = sectionScoreSchema.extend({
  criteria: sectionScoreSchema.shape.criteria.unwrap(),
});

export const sectionScoresSchema = z
  .array(sectionScoreSchema)
  .length(PROFILE_SECTION_IDS.length);

export const sectionScoresWriteSchema = z
  .array(sectionScoreWriteSchema)
  .length(PROFILE_SECTION_IDS.length);

export const analysisUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    totalTokens: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const createProfileAnalysisSchema = z
  .object({
    snapshot: profileSnapshotSchema,
    goalId: z.uuid().optional(),
  })
  .strict();

export const listProfileAnalysesQuerySchema = z
  .object({
    cursor: z
      .string()
      .min(1)
      .max(512)
      .refine(isProfileAnalysisCursor, 'The analysis cursor is invalid.')
      .optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AnalysisUsage = z.output<typeof analysisUsageSchema>;
export type PersistedSectionScore = z.output<typeof sectionScoreSchema>;
export type CreateProfileAnalysis = z.output<
  typeof createProfileAnalysisSchema
>;
export type ListProfileAnalysesQuery = z.output<
  typeof listProfileAnalysesQuerySchema
>;

export class ListProfileAnalysesQueryDto extends createZodDto(
  listProfileAnalysesQuerySchema,
) {}
