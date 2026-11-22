import { describe, expect, it } from 'vitest';
import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import { scoreProfileCompleteness } from './profile-completeness';

describe('scoreProfileCompleteness', () => {
  it('scores readable facts independently and excludes unreadable checks', () => {
    const result = scoreProfileCompleteness({
      completeness: facts({
        hasIntroVideo: true,
        hasProfilePhoto: false,
        availabilityBadge: null,
        hoursPerWeek: 'As Needed - Open to Offers',
        idVerified: true,
        verifications: ['ID'],
        licenses: 0,
        linkedAccounts: ['GitHub'],
      }),
    });

    expect(result.checks).toContainEqual({
      id: 'availabilityBadge',
      status: 'unreadable',
      weight: 10,
    });
    expect(result.score).toBe(67);
  });

  it('returns null rather than a misleading zero when every fact is unreadable', () => {
    expect(
      scoreProfileCompleteness({ completeness: facts() }).score,
    ).toBeNull();
  });
});

function facts(
  overrides: Partial<ProfileFacts['completeness']> = {},
): ProfileFacts['completeness'] {
  return {
    hasIntroVideo: null,
    hasProfilePhoto: null,
    availabilityBadge: null,
    hoursPerWeek: null,
    avgResponseTime: null,
    idVerified: null,
    verifications: null,
    licenses: null,
    linkedAccounts: null,
    avgResponseTimeIsSlow: null,
    ...overrides,
  };
}
