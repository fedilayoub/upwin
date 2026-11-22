import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveProposalPreferencesAction } from '@/app/[lang]/(app)/actions';
import { ApiError } from '@/lib/api';
import { INITIAL_FORM_ACTION_STATE } from '@/lib/form-action-state';

const mocks = vi.hoisted(() => ({
  getBackendApiClient: vi.fn(),
  putProposalPreferences: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getBackendApiClient: mocks.getBackendApiClient,
}));
vi.mock('@/i18n/dictionaries', () => ({
  getDictionary: vi.fn(async () => ({
    proposals: {
      validation: { checkFields: 'Check the fields.' },
      messages: {
        saved: 'Preferences saved.',
        genericError: 'Could not save preferences.',
      },
    },
  })),
}));

describe('saveProposalPreferencesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBackendApiClient.mockResolvedValue({
      putProposalPreferences: mocks.putProposalPreferences,
    });
    mocks.putProposalPreferences.mockResolvedValue({});
  });

  it('submits every form-owned field in one wholesale PUT', async () => {
    const formData = proposalPreferencesFormData();

    await expect(
      saveProposalPreferencesAction(
        'en',
        INITIAL_FORM_ACTION_STATE,
        formData,
      ),
    ).resolves.toEqual({ status: 'success', message: 'Preferences saved.' });
    expect(mocks.putProposalPreferences).toHaveBeenCalledWith({
      proposalLength: 'long',
      proposalTone: 'technical',
      answerLength: 'detailed',
      language: 'fr',
      signOffName: 'Alex',
      customInstructions: 'Lead with delivery outcomes.',
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/proposal-style');
  });

  it('returns an API validation message so the form can display it', async () => {
    mocks.putProposalPreferences.mockRejectedValue(
      new ApiError(
        'The custom instructions exceed the allowed length.',
        'UNPROCESSABLE_ENTITY',
        422,
      ),
    );

    await expect(
      saveProposalPreferencesAction(
        'en',
        INITIAL_FORM_ACTION_STATE,
        proposalPreferencesFormData(),
      ),
    ).resolves.toEqual({
      status: 'error',
      message: 'The custom instructions exceed the allowed length.',
    });
  });
});

function proposalPreferencesFormData(): FormData {
  const formData = new FormData();
  formData.set('proposalLength', 'long');
  formData.set('proposalTone', 'technical');
  formData.set('answerLength', 'detailed');
  formData.set('language', 'fr');
  formData.set('signOffName', '  Alex  ');
  formData.set('customInstructions', '  Lead with delivery outcomes.  ');
  return formData;
}
