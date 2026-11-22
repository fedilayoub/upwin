import { describe, expect, it } from 'vitest';
import { priorityKey } from './priority-identity';

const counts = {
  skills: 4,
  portfolio: 2,
  employment: 1,
  education: 0,
  certifications: 0,
  languages: 1,
};

describe('priorityKey', () => {
  it('keys a completeness fill by its signal, so two fills in one section stay distinct', () => {
    const photo = priorityKey({ section: 'trust', signal: 'profilePhoto' }, { counts });
    const licenses = priorityKey({ section: 'trust', signal: 'licenses' }, { counts });

    expect(photo).toBe('fill:profilePhoto');
    expect(licenses).toBe('fill:licenses');
    expect(photo).not.toBe(licenses);
  });

  it('collapses the section pairs that share a suggestion target', () => {
    // rankRecommendations deduplicates by target, so whichever of the pair
    // survives ranking must still match the other across analyses.
    expect(priorityKey({ section: 'positioning', signal: null }, { counts })).toBe(
      priorityKey({ section: 'title', signal: null }, { counts }),
    );
    expect(priorityKey({ section: 'overview', signal: null }, { counts })).toBe(
      priorityKey({ section: 'goalAlignment', signal: null }, { counts }),
    );
    expect(priorityKey({ section: 'portfolio', signal: null }, { counts })).toBe(
      priorityKey({ section: 'trust', signal: null }, { counts }),
    );
  });

  it('keeps unrelated targets apart', () => {
    expect(priorityKey({ section: 'skills', signal: null }, { counts })).not.toBe(
      priorityKey({ section: 'overview', signal: null }, { counts }),
    );
  });

  it('tracks the employment item index, which depends on the snapshot it was raised from', () => {
    const populated = priorityKey({ section: 'experience', signal: null }, { counts });
    const empty = priorityKey(
      { section: 'experience', signal: null },
      { counts: { ...counts, employment: 0 } },
    );

    expect(populated).toBe('ai:employment:0');
    expect(empty).toBe('ai:employment:none');
  });
});
