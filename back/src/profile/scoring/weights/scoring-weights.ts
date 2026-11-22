import type { GoalObjective } from '../../../goals/goal.schema';
import type { ProfileSectionId } from '../../profile-section';

export const scoringVersion = 'scoring-v1' as const;

export type ScoringWeights = Record<ProfileSectionId, number>;

export const SCORING_WEIGHTS = {
  'first-client': {
    positioning: 0.15,
    overview: 0.2,
    title: 0.05,
    skills: 0.15,
    portfolio: 0.2,
    experience: 0.1,
    trust: 0.1,
    goalAlignment: 0.05,
  },
  'more-clients': {
    positioning: 0.15,
    overview: 0.2,
    title: 0.05,
    skills: 0.1,
    portfolio: 0.2,
    experience: 0.1,
    trust: 0.1,
    goalAlignment: 0.1,
  },
  'more-responses': {
    positioning: 0.2,
    overview: 0.2,
    title: 0.1,
    skills: 0.1,
    portfolio: 0.15,
    experience: 0.05,
    trust: 0.05,
    goalAlignment: 0.15,
  },
  'higher-paying-projects': {
    positioning: 0.2,
    overview: 0.15,
    title: 0.05,
    skills: 0.1,
    portfolio: 0.2,
    experience: 0.1,
    trust: 0.1,
    goalAlignment: 0.1,
  },
  scale: {
    positioning: 0.15,
    overview: 0.15,
    title: 0.05,
    skills: 0.1,
    portfolio: 0.2,
    experience: 0.15,
    trust: 0.1,
    goalAlignment: 0.1,
  },
} as const satisfies Record<GoalObjective, ScoringWeights>;

export function getScoringWeights(objective: string): ScoringWeights {
  return isGoalObjective(objective)
    ? SCORING_WEIGHTS[objective]
    : SCORING_WEIGHTS['first-client'];
}

function isGoalObjective(value: string): value is GoalObjective {
  return Object.hasOwn(SCORING_WEIGHTS, value);
}
