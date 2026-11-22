import { describe, expect, it } from 'vitest';
import {
  rawProposalOutcomeInput,
  validateProposalOutcomeInput,
} from '@/lib/proposal-outcome-validation';

describe('proposal outcome validation', () => {
  it('accepts every frozen outcome status', () => {
    expect(validateProposalOutcomeInput('sent')).toEqual({
      success: true,
      data: { status: 'sent' },
    });
    expect(validateProposalOutcomeInput('no-response')).toEqual({
      success: true,
      data: { status: 'no-response' },
    });
  });

  it('rejects missing and unknown outcome statuses', () => {
    expect(validateProposalOutcomeInput('won')).toEqual({
      success: false,
      errors: { status: 'invalidChoice' },
    });

    expect(rawProposalOutcomeInput(new FormData())).toBe('');
  });
});
