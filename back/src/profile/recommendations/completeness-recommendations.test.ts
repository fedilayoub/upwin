import { describe, expect, it } from 'vitest';
import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import {
  buildCompletenessRecommendations,
  type CompletenessGoal,
  type CompletenessGuidanceId,
} from './completeness-recommendations';

const goal: CompletenessGoal = {
  objective: 'first-client',
  targetRole: 'React Developer',
};

describe('buildCompletenessRecommendations', () => {
  it('emits a fill for every readable missing completeness signal', () => {
    const cases: Array<{
      signal: CompletenessGuidanceId;
      overrides: Partial<ProfileFacts['completeness']>;
    }> = [
      { signal: 'introVideo', overrides: { hasIntroVideo: false } },
      { signal: 'profilePhoto', overrides: { hasProfilePhoto: false } },
      {
        signal: 'availabilityBadge',
        overrides: { availabilityBadge: false },
      },
      { signal: 'hoursPerWeek', overrides: { hoursPerWeek: undefined } },
      { signal: 'idVerification', overrides: { idVerified: false } },
      { signal: 'licenses', overrides: { licenses: 0 } },
      { signal: 'linkedAccounts', overrides: { linkedAccounts: [] } },
      {
        signal: 'eligibleVerification',
        overrides: { verifications: [] },
      },
    ];

    for (const { signal, overrides } of cases) {
      const recommendations = buildCompletenessRecommendations(
        facts(overrides),
        goal,
      );

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          signal,
          kind: 'fill',
          field: null,
          itemIndex: null,
        }),
      );
    }
  });

  it('recommends a readable missing video but never an unreadable one', () => {
    const missing = buildCompletenessRecommendations(
      facts({ hasIntroVideo: false }),
      goal,
    );
    const unreadable = buildCompletenessRecommendations(facts(), goal);

    expect(missing).toContainEqual(
      expect.objectContaining({
        signal: 'introVideo',
        kind: 'fill',
        field: null,
        itemIndex: null,
      }),
    );
    expect(
      missing.find(({ signal }) => signal === 'introVideo')?.guidance,
    ).toContain('React Developer');
    expect(unreadable).toEqual([]);
  });

  it('creates a behavioural fill only for a genuinely slow response', () => {
    const slow = buildCompletenessRecommendations(
      facts({
        avgResponseTime: '12-24 hours',
        avgResponseTimeIsSlow: true,
      }),
      goal,
    );
    const fast = buildCompletenessRecommendations(
      facts({
        avgResponseTime: 'within an hour',
        avgResponseTimeIsSlow: false,
      }),
      goal,
    );

    const responseRecommendation = slow.find(
      ({ signal }) => signal === 'avgResponseTime',
    );
    expect(responseRecommendation).toMatchObject({
      kind: 'fill',
      field: null,
      itemIndex: null,
    });
    expect(responseRecommendation?.guidance).toContain('12-24 hours');
    expect(responseRecommendation).not.toHaveProperty('suggestedValue');
    expect(fast.some(({ signal }) => signal === 'avgResponseTime')).toBe(false);
  });

  it('renders deterministic wording from the missing fact and active goal', () => {
    const firstClient = buildCompletenessRecommendations(
      facts({ hasIntroVideo: false }),
      goal,
    );
    const higherPaying = buildCompletenessRecommendations(
      facts({ hasIntroVideo: false }),
      {
        objective: 'higher-paying-projects',
        targetRole: 'Data Engineer',
      },
    );

    expect(firstClient[0]?.guidance).toContain('React Developer');
    expect(firstClient[0]?.reason).toContain('first client');
    expect(higherPaying[0]?.guidance).toContain('Data Engineer');
    expect(higherPaying[0]?.reason).toContain('higher-value projects');
    expect(higherPaying).toEqual(
      buildCompletenessRecommendations(facts({ hasIntroVideo: false }), {
        objective: 'higher-paying-projects',
        targetRole: 'Data Engineer',
      }),
    );
  });
});

function facts(
  overrides: Partial<ProfileFacts['completeness']> = {},
): Pick<ProfileFacts, 'completeness'> {
  return {
    completeness: {
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
    },
  };
}
