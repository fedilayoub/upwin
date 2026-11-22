import { describe, expect, it } from 'vitest';
import {
  CONTEXT_DELETE_CONFIRMATION_FIELD,
  CONTEXT_DELETE_CONFIRMATION_VALUE,
  isContextDeletionConfirmed,
} from '@/lib/context-reset';

describe('context deletion confirmation', () => {
  it('rejects an accidental or incomplete delete submission', () => {
    expect(isContextDeletionConfirmed(new FormData())).toBe(false);

    const wrongConfirmation = new FormData();
    wrongConfirmation.set(CONTEXT_DELETE_CONFIRMATION_FIELD, 'delete');
    expect(isContextDeletionConfirmed(wrongConfirmation)).toBe(false);
  });

  it('accepts only the explicit context deletion confirmation', () => {
    const confirmed = new FormData();
    confirmed.set(
      CONTEXT_DELETE_CONFIRMATION_FIELD,
      CONTEXT_DELETE_CONFIRMATION_VALUE,
    );

    expect(isContextDeletionConfirmed(confirmed)).toBe(true);
  });
});
