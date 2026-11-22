import type { GoalObjective } from '../../goals/goal.schema';
import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import type { ProfileSectionId } from '../profile-section';
import {
  scoreProfileCompleteness,
  type ProfileCompletenessCheckId,
} from '../scoring/profile-completeness';

export type CompletenessGuidanceId =
  ProfileCompletenessCheckId | 'avgResponseTime';

export interface CompletenessGoal {
  objective: GoalObjective;
  targetRole: string;
}

export interface CompletenessFillRecommendation {
  signal: CompletenessGuidanceId;
  section: ProfileSectionId;
  estimatedMinutes: number;
  recommendation: string;
  reason: string;
  evidence: string[];
  kind: 'fill';
  field: null;
  itemIndex: null;
  guidance: string;
  items: string[];
}

interface CompletenessRecommendationConfig {
  section: ProfileSectionId;
  estimatedMinutes: number;
  recommendation: string;
  evidence: string;
  guidance: (goal: CompletenessGoal) => string;
  reason: (goal: CompletenessGoal) => string;
  items: (goal: CompletenessGoal) => string[];
}

const CHECK_RECOMMENDATION_CONFIG = {
  introVideo: {
    section: 'positioning',
    estimatedMinutes: 15,
    recommendation: 'Add a concise introduction video.',
    evidence: 'Introduction video: not present.',
    guidance: (goal) =>
      `Record a short introduction for your ${goal.targetRole} service. Name the client problem you solve, the deliverable you provide, and one profile example that supports it.`,
    reason: (goal) =>
      `A direct introduction gives clients another concrete signal while ${goalOutcome(goal.objective)}.`,
    items: (goal) => [
      `Name the client problem your ${goal.targetRole} service solves.`,
      'Point to one project or role already visible on the profile.',
    ],
  },
  profilePhoto: {
    section: 'trust',
    estimatedMinutes: 10,
    recommendation: 'Add a clear professional profile photo.',
    evidence: 'Profile photo: not present.',
    guidance: (goal) =>
      `Use a current, well-lit head-and-shoulders photo so the person behind your ${goal.targetRole} service is immediately recognizable.`,
    reason: (goal) =>
      `A recognizable photo removes an avoidable trust gap while ${goalOutcome(goal.objective)}.`,
    items: () => [
      'Use a simple background and make sure your face is clearly visible.',
    ],
  },
  availabilityBadge: {
    section: 'goalAlignment',
    estimatedMinutes: 5,
    recommendation: 'Review your availability badge setting.',
    evidence: 'Availability badge: off.',
    guidance: (goal) =>
      `Enable the availability badge only when it accurately reflects your readiness for the ${goal.targetRole} work you are targeting.`,
    reason: (goal) =>
      `An accurate availability signal helps clients judge timing while ${goalOutcome(goal.objective)}.`,
    items: () => ['Keep the setting aligned with your actual capacity.'],
  },
  hoursPerWeek: {
    section: 'goalAlignment',
    estimatedMinutes: 5,
    recommendation: 'Set your weekly availability.',
    evidence: 'Hours per week: not set.',
    guidance: (goal) =>
      `Add the weekly capacity you can reliably commit to ${goal.targetRole} projects.`,
    reason: (goal) =>
      `Specific capacity reduces scheduling uncertainty while ${goalOutcome(goal.objective)}.`,
    items: () => [
      'Choose the availability range that matches your real schedule.',
    ],
  },
  idVerification: {
    section: 'trust',
    estimatedMinutes: 10,
    recommendation: 'Complete identity verification.',
    evidence: 'Identity verification: not present.',
    guidance: () =>
      'Complete the identity-verification steps available in your profile settings.',
    reason: (goal) =>
      `Verified identity adds a concrete trust signal while ${goalOutcome(goal.objective)}.`,
    items: () => [
      'Follow the verification flow shown in your profile settings.',
    ],
  },
  licenses: {
    section: 'trust',
    estimatedMinutes: 15,
    recommendation: 'Add any relevant professional license you hold.',
    evidence: 'Licenses: none listed.',
    guidance: (goal) =>
      `If you hold a current license relevant to ${goal.targetRole} work or the industries you target, add it without implying credentials you do not have.`,
    reason: (goal) =>
      `A relevant, verifiable license can support credibility while ${goalOutcome(goal.objective)}.`,
    items: () => ['Add only a current license that clients can verify.'],
  },
  linkedAccounts: {
    section: 'trust',
    estimatedMinutes: 10,
    recommendation: 'Link a relevant professional account.',
    evidence: 'Linked accounts: none listed.',
    guidance: (goal) =>
      `Link a maintained professional account that shows evidence of your ${goal.targetRole} work.`,
    reason: (goal) =>
      `An inspectable professional footprint can reinforce your profile while ${goalOutcome(goal.objective)}.`,
    items: () => [
      'Connect only an account with work you are comfortable showing clients.',
    ],
  },
  eligibleVerification: {
    section: 'trust',
    estimatedMinutes: 5,
    recommendation: 'Add any verification badge that truthfully applies.',
    evidence: 'Additional verification badges: none listed.',
    guidance: () =>
      'Review the available verification categories and add a badge only if you can truthfully satisfy its requirements.',
    reason: (goal) =>
      `An applicable verification adds another checkable signal while ${goalOutcome(goal.objective)}.`,
    items: () => [
      'Skip every category that does not apply to your actual credentials.',
    ],
  },
} as const satisfies Record<
  ProfileCompletenessCheckId,
  CompletenessRecommendationConfig
>;

const RESPONSE_TIME_CONFIG = {
  section: 'trust',
  estimatedMinutes: 5,
  recommendation: 'Build a faster client-response habit.',
  evidence: 'Average response time: slower than the target window.',
  guidance: (goal) =>
    `Choose regular message-check windows so relevant ${goal.targetRole} inquiries receive a timely reply.`,
  reason: (goal) =>
    `A consistent reply routine reduces avoidable friction while ${goalOutcome(goal.objective)}.`,
  items: () => [
    'Choose message-check windows that fit your actual working day.',
  ],
} as const satisfies CompletenessRecommendationConfig;

export function buildCompletenessRecommendations(
  facts: Pick<ProfileFacts, 'completeness'>,
  goal: CompletenessGoal,
): CompletenessFillRecommendation[] {
  const recommendations = scoreProfileCompleteness(facts).checks.flatMap(
    (check) => {
      if (check.status !== 'missing') return [];
      return [
        toRecommendation(check.id, CHECK_RECOMMENDATION_CONFIG[check.id], goal),
      ];
    },
  );

  const capturedResponseTime = facts.completeness.avgResponseTime;
  if (
    facts.completeness.avgResponseTimeIsSlow === true &&
    typeof capturedResponseTime === 'string'
  ) {
    const recommendation = toRecommendation(
      'avgResponseTime',
      RESPONSE_TIME_CONFIG,
      goal,
      `Average response time: ${capturedResponseTime}.`,
    );
    recommendations.push({
      ...recommendation,
      guidance: `Your captured average response is ${capturedResponseTime}. ${recommendation.guidance}`,
    });
  }

  return recommendations;
}

function toRecommendation(
  signal: CompletenessGuidanceId,
  config: CompletenessRecommendationConfig,
  goal: CompletenessGoal,
  evidence = config.evidence,
): CompletenessFillRecommendation {
  return {
    signal,
    section: config.section,
    estimatedMinutes: config.estimatedMinutes,
    recommendation: config.recommendation,
    reason: `${evidence} ${config.reason(goal)}`,
    evidence: [evidence],
    kind: 'fill',
    field: null,
    itemIndex: null,
    guidance: config.guidance(goal),
    items: config.items(goal),
  };
}

function goalOutcome(objective: GoalObjective): string {
  switch (objective) {
    case 'first-client':
      return 'earning a first client’s confidence';
    case 'more-clients':
      return 'winning more well-matched clients';
    case 'more-responses':
      return 'making the profile easier for target clients to act on';
    case 'higher-paying-projects':
      return 'competing for higher-value projects';
    case 'scale':
      return 'presenting a focused service that can scale';
  }
}
