import { z } from 'zod';
import { JOB_MATCH_DIMENSION_IDS } from '../../jobs/job-match-dimension';

const jobMatchCriterionSchema = z
  .object({
    name: z.string(),
    // Model-facing numeric fields must stay unconstrained. The pure scoring
    // layer validates finite integer values in the 0..100 range.
    score: z.number(),
    reasoning: z.string(),
    evidence: z.array(z.string()),
  })
  .strict();

const jobMatchDimensionSchema = z
  .object({
    id: z.enum(JOB_MATCH_DIMENSION_IDS),
    criteria: z.array(jobMatchCriterionSchema).min(1),
  })
  .strict();

export const jobMatchSchema = z
  .object({
    summary: z.string(),
    dimensions: z.array(jobMatchDimensionSchema).min(1),
    strengths: z.array(z.string()),
    concerns: z.array(z.string()),
  })
  .strict();

export type JobMatchEvaluation = z.output<typeof jobMatchSchema>;
