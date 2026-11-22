import { describe, expect, it } from 'vitest';
import { UNREADABLE_PROFILE_COMPLETENESS } from '../../profile-snapshots/profile-snapshot.schema';
import {
  verifyPreviousPriorities,
  type PreviousPriority,
} from './verify-previous-priorities';

function priority(
  id: string,
  overrides: Partial<PreviousPriority> = {},
): PreviousPriority {
  return {
    id,
    section: 'trust',
    signal: null,
    recommendation: 'Do the thing.',
    reason: 'Because.',
    ...overrides,
  };
}

const completeProfile = {
  completeness: {
    hasIntroVideo: true,
    hasProfilePhoto: true,
    availabilityBadge: true,
    hoursPerWeek: '30',
    avgResponseTime: '2 hours',
    avgResponseTimeIsSlow: false,
    idVerified: true,
    verifications: ['Id', 'Military'],
    licenses: 1,
    linkedAccounts: ['github'],
  },
};

const bareProfile = {
  completeness: {
    hasIntroVideo: false,
    hasProfilePhoto: false,
    availabilityBadge: false,
    hoursPerWeek: undefined,
    avgResponseTime: '3 days',
    avgResponseTimeIsSlow: true,
    idVerified: false,
    verifications: [],
    licenses: 0,
    linkedAccounts: [],
  },
};

describe('verifyPreviousPriorities', () => {
  it('reports a completeness priority as implemented once its check passes', () => {
    const { decided, undecided } = verifyPreviousPriorities(
      [priority('a', { signal: 'profilePhoto' })],
      completeProfile,
    );

    expect(decided.get('a')?.status).toBe('implemented');
    expect(undecided).toEqual([]);
  });

  it('reports a completeness priority as not implemented while its check still fails', () => {
    const { decided } = verifyPreviousPriorities(
      [priority('a', { signal: 'profilePhoto' })],
      bareProfile,
    );

    expect(decided.get('a')?.status).toBe('not-implemented');
  });

  it('leaves an unreadable anchor undecided rather than calling it inaction', () => {
    const { decided, undecided } = verifyPreviousPriorities(
      [priority('a', { signal: 'profilePhoto' })],
      {
        completeness: {
          ...UNREADABLE_PROFILE_COMPLETENESS,
          avgResponseTimeIsSlow: null,
        },
      },
    );

    expect(decided.size).toBe(0);
    expect(undecided).toHaveLength(1);
  });

  it('answers the response-time signal from the recomputed fact', () => {
    expect(
      verifyPreviousPriorities(
        [priority('a', { signal: 'avgResponseTime' })],
        completeProfile,
      ).decided.get('a')?.status,
    ).toBe('implemented');
    expect(
      verifyPreviousPriorities(
        [priority('a', { signal: 'avgResponseTime' })],
        bareProfile,
      ).decided.get('a')?.status,
    ).toBe('not-implemented');
  });

  it('hands every AI priority to the caller, since writing quality is not a fact', () => {
    const { decided, undecided } = verifyPreviousPriorities(
      [priority('a', { section: 'overview' }), priority('b', { signal: 'licenses' })],
      completeProfile,
    );

    expect(undecided.map(({ id }) => id)).toEqual(['a']);
    expect(decided.has('b')).toBe(true);
  });
});
