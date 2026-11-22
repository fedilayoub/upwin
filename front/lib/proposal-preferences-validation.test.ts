import { describe, expect, it } from 'vitest';
import {
  validateProposalPreferencesInput,
  type RawProposalPreferencesInput,
} from '@/lib/proposal-preferences-validation';

const VALID_INPUT: RawProposalPreferencesInput = {
  proposalLength: 'medium',
  proposalTone: 'professional',
  answerLength: 'standard',
  language: 'en',
  signOffName: '  Alex  ',
  customInstructions: '  Lead with outcomes.  ',
};

describe('proposal preferences form validation', () => {
  it('normalizes every field into the wholesale PUT payload', () => {
    expect(validateProposalPreferencesInput(VALID_INPUT)).toEqual({
      success: true,
      data: {
        proposalLength: 'medium',
        proposalTone: 'professional',
        answerLength: 'standard',
        language: 'en',
        signOffName: 'Alex',
        customInstructions: 'Lead with outcomes.',
      },
    });
  });

  it('rejects unknown enum values and over-length instructions', () => {
    expect(
      validateProposalPreferencesInput({
        ...VALID_INPUT,
        proposalTone: 'aggressive',
        customInstructions: 'x'.repeat(2_001),
      }),
    ).toMatchObject({
      success: false,
      errors: {
        proposalTone: 'invalidChoice',
        customInstructions: 'tooLong',
      },
    });
  });
});
