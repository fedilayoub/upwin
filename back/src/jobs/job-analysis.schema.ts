import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { jobSnapshotSchema } from '../job-snapshots/job-snapshot.schema';
import {
  isProfileAnalysisCursor,
} from '../profile/analysis/profile-analysis.cursor';
import { JOB_MATCH_DIMENSION_IDS } from './job-match-dimension';

export const jobCriterionEvidenceSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    evidence: z.array(z.string()),
  })
  .strict();

export const jobDimensionScoreSchema = z
  .object({
    id: z.enum(JOB_MATCH_DIMENSION_IDS),
    score: z.number().int().min(0).max(100),
    criteria: z.array(jobCriterionEvidenceSchema),
  })
  .strict();

export const jobDimensionScoresSchema = z
  .array(jobDimensionScoreSchema)
  .length(JOB_MATCH_DIMENSION_IDS.length)
  .superRefine((dimensions, context) => {
    const ids = new Set(dimensions.map((dimension) => dimension.id));
    for (const id of JOB_MATCH_DIMENSION_IDS) {
      if (!ids.has(id)) {
        context.addIssue({ code: 'custom', message: `Missing dimension: ${id}.` });
      }
    }
  });

export const createJobAnalysisSchema = z
  .object({
    snapshot: jobSnapshotSchema,
    goalId: z.uuid().optional(),
  })
  .strict();

export const listJobAnalysesQuerySchema = z
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

export const createProposalDraftSchema = z.object({}).strict();

export const proposalRefinements = [
  'regenerate',
  'shorter',
  'more-technical',
  'more-conversational',
] as const;
export const proposalRefinementSchema = z.enum(proposalRefinements);
export const draftBlockIdSchema = z.union([
  z.literal('proposal'),
  z.string().regex(/^answer:\d+$/u),
]);

export const refineProposalDraftSchema = z
  .object({
    blockId: draftBlockIdSchema,
    refinement: proposalRefinementSchema,
  })
  .strict();

export const updateProposalDraftStatusSchema = z
  .object({
    blockId: draftBlockIdSchema,
    status: z.enum(['copied', 'dismissed']),
  })
  .strict();

export const proposalBlockSchema = z
  .object({
    blockId: z.literal('proposal'),
    text: z.string().min(1),
    wordCount: z.number().int().nonnegative(),
    variantIndex: z.number().int().nonnegative(),
  })
  .strict();

export const proposalAnswerBlockSchema = z
  .object({
    blockId: z.string().regex(/^answer:\d+$/u),
    position: z.number().int().nonnegative(),
    question: z.string().min(1),
    text: z.string().min(1),
    wordCount: z.number().int().nonnegative(),
    variantIndex: z.number().int().nonnegative(),
  })
  .strict();

export const proposalAnswerBlocksSchema = z.array(proposalAnswerBlockSchema);
export const proposalBlockStatusesSchema = z.record(
  z.string(),
  z.enum(['copied', 'dismissed']),
);

export type PersistedJobDimensionScore = z.output<
  typeof jobDimensionScoreSchema
>;
export type PersistedProposalBlock = z.output<typeof proposalBlockSchema>;
export type PersistedProposalAnswer = z.output<
  typeof proposalAnswerBlockSchema
>;
export type ProposalBlockStatuses = z.output<
  typeof proposalBlockStatusesSchema
>;
export type ListJobAnalysesQuery = z.output<
  typeof listJobAnalysesQuerySchema
>;
export type RefineProposalDraftRequest = z.output<
  typeof refineProposalDraftSchema
>;
export type UpdateProposalDraftStatusRequest = z.output<
  typeof updateProposalDraftStatusSchema
>;

export class ListJobAnalysesQueryDto extends createZodDto(
  listJobAnalysesQuerySchema,
) {}
