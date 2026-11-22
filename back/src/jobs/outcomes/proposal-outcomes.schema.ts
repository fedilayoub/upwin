import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PROPOSAL_OUTCOME_STATUSES } from '../../database/schema';
import { funnelWindowSchema } from '../../insights/insights.schema';
import { isProfileAnalysisCursor } from '../../profile/analysis/profile-analysis.cursor';

const countSchema = z.number().int().nonnegative();
const proposalOutcomeStatusFilterSchema = z
  .string()
  .transform((value) => [
    ...new Set(value.split(',').map((status) => status.trim())),
  ])
  .pipe(z.array(z.enum(PROPOSAL_OUTCOME_STATUSES)).min(1).max(8));

export const putProposalOutcomeSchema = z
  .object({
    status: z.enum(PROPOSAL_OUTCOME_STATUSES),
    connectsSpent: z.number().int().nonnegative().nullable().optional(),
    sentAt: z.iso.datetime().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();

export const listProposalOutcomesQuerySchema = z
  .object({
    cursor: z
      .string()
      .min(1)
      .max(512)
      .refine(isProfileAnalysisCursor, 'The outcome cursor is invalid.')
      .optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: proposalOutcomeStatusFilterSchema.optional(),
  })
  .strict();

export const proposalOutcomeStatsQuerySchema = z
  .object({ window: funnelWindowSchema.default('30d') })
  .strict();

export const proposalOutcomeResponseSchema = z
  .object({
    id: z.uuid(),
    jobAnalysisId: z.uuid(),
    status: z.enum(PROPOSAL_OUTCOME_STATUSES),
    connectsSpent: z.number().int().nonnegative().nullable(),
    sentAt: z.iso.datetime().nullable(),
    respondedAt: z.iso.datetime().nullable(),
    decidedAt: z.iso.datetime().nullable(),
    note: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const proposalOutcomeListResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.uuid(),
          jobAnalysisId: z.uuid(),
          jobTitle: z.string().min(1),
          jobUrl: z.string().min(1),
          matchScore: z.number().int().min(0).max(100),
          status: z.enum(PROPOSAL_OUTCOME_STATUSES),
          connectsSpent: z.number().int().nonnegative().nullable(),
          sentAt: z.iso.datetime().nullable(),
          respondedAt: z.iso.datetime().nullable(),
          decidedAt: z.iso.datetime().nullable(),
          note: z.string().nullable(),
          createdAt: z.iso.datetime(),
          updatedAt: z.iso.datetime(),
        })
        .strict(),
    ),
    pageSize: z.number().int().min(1).max(100),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const proposalOutcomeStatsResponseSchema = z
  .object({
    window: funnelWindowSchema,
    from: z.iso.datetime().nullable(),
    to: z.iso.datetime(),
    total: countSchema,
    applied: countSchema,
    counts: z
      .object({
        'in-progress': countSchema,
        sent: countSchema,
        viewed: countSchema,
        messaged: countSchema,
        interviewing: countSchema,
        hired: countSchema,
        declined: countSchema,
        'no-response': countSchema,
      })
      .strict(),
  })
  .strict();

export type PutProposalOutcome = z.output<typeof putProposalOutcomeSchema>;
export type ListProposalOutcomesQuery = z.output<
  typeof listProposalOutcomesQuerySchema
>;
export type ProposalOutcomeResponse = z.output<
  typeof proposalOutcomeResponseSchema
>;
export type ProposalOutcomeListResponse = z.output<
  typeof proposalOutcomeListResponseSchema
>;
export type ProposalOutcomeStatsQuery = z.output<
  typeof proposalOutcomeStatsQuerySchema
>;
export type ProposalOutcomeStatsResponse = z.output<
  typeof proposalOutcomeStatsResponseSchema
>;

export class PutProposalOutcomeDto extends createZodDto(
  putProposalOutcomeSchema,
) {}
export class ListProposalOutcomesQueryDto extends createZodDto(
  listProposalOutcomesQuerySchema,
) {}
export class ProposalOutcomeStatsQueryDto extends createZodDto(
  proposalOutcomeStatsQuerySchema,
) {}
