import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { proposalService } from './proposals';

const ANALYSIS_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa11';
const DRAFT_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa13';

const draft = {
  id: DRAFT_ID,
  jobAnalysisId: ANALYSIS_ID,
  proposal: {
    blockId: 'proposal',
    text: 'A tailored proposal.',
    wordCount: 3,
    variantIndex: 0,
  },
  answers: [
    {
      blockId: 'answer:0',
      position: 0,
      question: 'Which design systems have you used?',
      text: 'A tailored answer.',
      wordCount: 3,
      variantIndex: 0,
    },
  ],
  versions: {
    prompt: 'proposal-writer-v1',
    requestedModel: 'gpt-4.1-mini',
    gateway: 'llmgateway',
    provider: 'openai',
    model: 'openai/gpt-4.1-mini',
  },
  createdAt: '2026-08-23T12:00:03.000Z',
};

afterEach(() => vi.restoreAllMocks());

describe('real proposal API methods', () => {
  it('generates one draft carrying the proposal and all answers', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue(draft);
    const getToken = vi.fn().mockResolvedValue('token');

    await expect(
      proposalService.generateDraft(ANALYSIS_ID, getToken),
    ).resolves.toEqual(draft);
    expect(request).toHaveBeenCalledWith(
      `/job-analyses/${ANALYSIS_ID}/draft`,
      expect.objectContaining({
        body: '{}',
        getToken,
        method: 'POST',
      }),
    );
  });

  it('refines exactly one named block through the analysis draft route', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({
      ...draft,
      answers: [
        { ...draft.answers[0], text: 'Short answer.', variantIndex: 1 },
      ],
    });
    const getToken = vi.fn().mockResolvedValue('token');

    await proposalService.refine(
      ANALYSIS_ID,
      'answer:0',
      'shorter',
      getToken,
    );

    expect(request).toHaveBeenCalledWith(
      `/job-analyses/${ANALYSIS_ID}/draft/refine`,
      expect.objectContaining({
        getToken,
        method: 'POST',
        operation: 'POST /job-analyses/:id/draft/refine',
      }),
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1].body))).toEqual({
      blockId: 'answer:0',
      refinement: 'shorter',
    });
  });

  it('records Copy through the draft status endpoint', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue(draft);
    const getToken = vi.fn().mockResolvedValue('token');

    await proposalService.markBlock(DRAFT_ID, 'proposal', 'copied', getToken);

    expect(request).toHaveBeenCalledWith(
      `/proposal-drafts/${DRAFT_ID}`,
      expect.objectContaining({
        getToken,
        method: 'PATCH',
        operation: 'PATCH /proposal-drafts/:id',
      }),
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1].body))).toEqual({
      blockId: 'proposal',
      status: 'copied',
    });
  });
});
