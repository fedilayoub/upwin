import { describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/services/api';
import type { ProfileSuggestion } from '@/types/profile';
import {
  copyProfileSuggestion,
  requestSuggestionKeepingCurrent,
} from './suggestion-actions';

const current: ProfileSuggestion = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
  section: 'overview',
  kind: 'rewrite',
  field: 'overview',
  itemIndex: null,
  originalValue: 'I build interfaces.',
  suggestedValue: 'I help teams build dependable product interfaces.',
  explanation: 'Leads with the client benefit.',
  impact: 'high',
};

describe('suggestion actions', () => {
  it('copies the suggested value and reports copied status', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const markCopied = vi.fn().mockResolvedValue(undefined);

    await copyProfileSuggestion(current, { writeText }, markCopied);

    expect(writeText).toHaveBeenCalledWith(current.suggestedValue);
    expect(markCopied).toHaveBeenCalledWith(current.id);
  });

  it('returns a genuinely new suggestion from Try another', async () => {
    const replacement = {
      ...current,
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1b',
      suggestedValue: 'I turn product needs into clear, reliable interfaces.',
    };
    const request = vi.fn().mockResolvedValue(replacement);

    await expect(
      requestSuggestionKeepingCurrent(current, request),
    ).resolves.toEqual({
      suggestion: replacement,
      error: null,
      errorCode: null,
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it('keeps the previous suggestion visible when Try another fails', async () => {
    const request = vi.fn().mockRejectedValue(new Error('Gateway unavailable'));

    await expect(
      requestSuggestionKeepingCurrent(current, request),
    ).resolves.toEqual({
      suggestion: current,
      error: 'Gateway unavailable',
      errorCode: null,
    });
  });

  it('keeps the error code with a failed suggestion request', async () => {
    const request = vi.fn().mockRejectedValue(
      new ApiClientError(
        'The model did not return a usable suggestion.',
        'POST /profile-analyses/:analysisId/suggestions/:section',
        502,
        'AI_EVALUATION_FAILED',
      ),
    );

    await expect(
      requestSuggestionKeepingCurrent(null, request),
    ).resolves.toEqual({
      suggestion: null,
      error: 'The model did not return a usable suggestion.',
      errorCode: 'AI_EVALUATION_FAILED',
    });
    expect(request).toHaveBeenCalledOnce();
  });
});
