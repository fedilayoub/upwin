import type { ProfileFacts } from '../analysis/deterministic/profile-facts';

export const PROFILE_COMPLETENESS_CHECK_IDS = [
  'introVideo',
  'profilePhoto',
  'availabilityBadge',
  'hoursPerWeek',
  'idVerification',
  'licenses',
  'linkedAccounts',
  'eligibleVerification',
] as const;

export type ProfileCompletenessCheckId =
  (typeof PROFILE_COMPLETENESS_CHECK_IDS)[number];
export type ProfileCompletenessCheckStatus =
  'complete' | 'missing' | 'unreadable';

export interface ProfileCompletenessCheck {
  id: ProfileCompletenessCheckId;
  status: ProfileCompletenessCheckStatus;
  weight: number;
}

export interface ProfileCompletenessScore {
  checks: ProfileCompletenessCheck[];
  score: number | null;
}

const CHECK_WEIGHTS = {
  introVideo: 20,
  profilePhoto: 20,
  availabilityBadge: 10,
  hoursPerWeek: 15,
  idVerification: 15,
  licenses: 5,
  linkedAccounts: 10,
  eligibleVerification: 5,
} as const satisfies Record<ProfileCompletenessCheckId, number>;

export function scoreProfileCompleteness(
  facts: Pick<ProfileFacts, 'completeness'>,
): ProfileCompletenessScore {
  const completeness = facts.completeness;
  const checks: ProfileCompletenessCheck[] = [
    check('introVideo', completeness.hasIntroVideo),
    check('profilePhoto', completeness.hasProfilePhoto),
    check('availabilityBadge', completeness.availabilityBadge),
    check(
      'hoursPerWeek',
      completeness.hoursPerWeek === null
        ? null
        : completeness.hoursPerWeek !== undefined,
    ),
    check('idVerification', completeness.idVerified),
    check(
      'licenses',
      completeness.licenses === null ? null : completeness.licenses > 0,
    ),
    check(
      'linkedAccounts',
      completeness.linkedAccounts === null
        ? null
        : completeness.linkedAccounts.length > 0,
    ),
    check(
      'eligibleVerification',
      completeness.verifications === null
        ? null
        : completeness.verifications.some(
            (label) => label.replace(/:\s*$/u, '').toLowerCase() !== 'id',
          ),
    ),
  ];
  const readable = checks.filter(({ status }) => status !== 'unreadable');
  const readableWeight = readable.reduce(
    (total, current) => total + current.weight,
    0,
  );
  if (readableWeight === 0) return { checks, score: null };

  const completedWeight = readable.reduce(
    (total, current) =>
      total + (current.status === 'complete' ? current.weight : 0),
    0,
  );

  return {
    checks,
    score: Math.round((completedWeight / readableWeight) * 100),
  };
}

function check(
  id: ProfileCompletenessCheckId,
  value: boolean | null,
): ProfileCompletenessCheck {
  return {
    id,
    status: value === null ? 'unreadable' : value ? 'complete' : 'missing',
    weight: CHECK_WEIGHTS[id],
  };
}
