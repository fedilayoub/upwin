import type {
  Proposal,
  ProposalBlockId,
  ProposalBlockStatus,
  ProposalRefinement,
} from '@/types/proposal';
import { z } from 'zod';
import { apiClient, type TokenProvider } from './api';

const blockIdSchema = z.union([
  z.literal('proposal'),
  z.string().regex(/^answer:\d+$/u),
]);
const proposalBlockSchema = z
  .object({
    blockId: z.literal('proposal'),
    text: z.string().min(1),
    wordCount: z.number().int().nonnegative(),
    variantIndex: z.number().int().nonnegative(),
  })
  .strict();
const answerBlockSchema = z
  .object({
    blockId: z.string().regex(/^answer:\d+$/u),
    position: z.number().int().nonnegative(),
    question: z.string().min(1),
    text: z.string().min(1),
    wordCount: z.number().int().nonnegative(),
    variantIndex: z.number().int().nonnegative(),
  })
  .strict();
const draftSchema = z
  .object({
    id: z.uuid(),
    jobAnalysisId: z.uuid(),
    proposal: proposalBlockSchema,
    answers: z.array(answerBlockSchema),
    versions: z
      .object({
        prompt: z.string().trim().min(1),
        requestedModel: z.string().trim().min(1),
        gateway: z.string().trim().min(1).optional(),
        provider: z.string().trim().min(1),
        model: z.string().trim().min(1),
      })
      .strict(),
    createdAt: z.iso.datetime(),
  })
  .strict();
const refinementSchema = z.enum([
  'regenerate',
  'shorter',
  'more-technical',
  'more-conversational',
]);

function parseDraft(value: unknown): Proposal {
  const parsed = draftSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('The backend returned an invalid proposal draft response.');
  }
  return parsed.data as Proposal;
}

function validateAnalysisId(analysisId: string): string {
  const parsed = z.uuid().safeParse(analysisId);
  if (!parsed.success) throw new Error('The selected job analysis is invalid.');
  return parsed.data;
}

function validateBlockId(blockId: ProposalBlockId): ProposalBlockId {
  const parsed = blockIdSchema.safeParse(blockId);
  if (!parsed.success) throw new Error('The selected draft block is invalid.');
  return parsed.data as ProposalBlockId;
}

export const proposalService = {
  async generateDraft(
    analysisId: string,
    getToken: TokenProvider,
  ): Promise<Proposal> {
    const id = validateAnalysisId(analysisId);
    const response = await apiClient.request<unknown>(
      `/job-analyses/${id}/draft`,
      {
        body: JSON.stringify({}),
        getToken,
        method: 'POST',
        operation: 'POST /job-analyses/:id/draft',
      },
    );
    const draft = parseDraft(response);
    if (draft.jobAnalysisId !== id) {
      throw new Error('The backend returned a draft for another analysis.');
    }
    return draft;
  },

  async refine(
    analysisId: string,
    blockId: ProposalBlockId,
    refinement: ProposalRefinement,
    getToken: TokenProvider,
  ): Promise<Proposal> {
    const id = validateAnalysisId(analysisId);
    const parsedRefinement = refinementSchema.safeParse(refinement);
    if (!parsedRefinement.success) {
      throw new Error('The selected refinement is invalid.');
    }
    const response = await apiClient.request<unknown>(
      `/job-analyses/${id}/draft/refine`,
      {
        body: JSON.stringify({
          blockId: validateBlockId(blockId),
          refinement: parsedRefinement.data,
        }),
        getToken,
        method: 'POST',
        operation: 'POST /job-analyses/:id/draft/refine',
      },
    );
    const draft = parseDraft(response);
    if (draft.jobAnalysisId !== id) {
      throw new Error('The backend returned a draft for another analysis.');
    }
    return draft;
  },

  async markBlock(
    draftId: string,
    blockId: ProposalBlockId,
    status: ProposalBlockStatus,
    getToken: TokenProvider,
  ): Promise<Proposal> {
    const parsedDraftId = z.uuid().safeParse(draftId);
    const parsedStatus = z.enum(['copied', 'dismissed']).safeParse(status);
    if (!parsedDraftId.success || !parsedStatus.success) {
      throw new Error('The selected draft action is invalid.');
    }
    const response = await apiClient.request<unknown>(
      `/proposal-drafts/${parsedDraftId.data}`,
      {
        body: JSON.stringify({
          blockId: validateBlockId(blockId),
          status: parsedStatus.data,
        }),
        getToken,
        method: 'PATCH',
        operation: 'PATCH /proposal-drafts/:id',
      },
    );
    const draft = parseDraft(response);
    if (draft.id !== parsedDraftId.data) {
      throw new Error('The backend returned another proposal draft.');
    }
    return draft;
  },
};
