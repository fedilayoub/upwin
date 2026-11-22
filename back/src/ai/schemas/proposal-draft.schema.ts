import { z } from 'zod';

export const proposalDraftSchema = z
  .object({
    proposal: z.string(),
    answers: z.array(
      z
        .object({
          // This is intentionally a plain number for gateway compatibility.
          // Position fidelity is enforced after structured generation.
          position: z.number(),
          answer: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export type ModelProposalDraft = z.output<typeof proposalDraftSchema>;
