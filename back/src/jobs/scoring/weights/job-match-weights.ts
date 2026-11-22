import type { GoalObjective } from '../../../goals/goal.schema';
import type { JobMatchDimensionId } from '../../job-match-dimension';

export const jobMatchScoringVersion = 'job-match-scoring-v1' as const;

export type JobMatchWeights = Record<JobMatchDimensionId, number>;

export const JOB_MATCH_WEIGHTS = {
  'first-client': {
    skills: 0.35,
    domain: 0.25,
    experience: 0.15,
    budget: 0.1,
    goalAlignment: 0.15,
  },
  'more-clients': {
    skills: 0.3,
    domain: 0.25,
    experience: 0.2,
    budget: 0.1,
    goalAlignment: 0.15,
  },
  'more-responses': {
    skills: 0.3,
    domain: 0.3,
    experience: 0.15,
    budget: 0.1,
    goalAlignment: 0.15,
  },
  'higher-paying-projects': {
    skills: 0.25,
    domain: 0.25,
    experience: 0.2,
    budget: 0.2,
    goalAlignment: 0.1,
  },
  scale: {
    skills: 0.25,
    domain: 0.25,
    experience: 0.25,
    budget: 0.15,
    goalAlignment: 0.1,
  },
} as const satisfies Record<GoalObjective, JobMatchWeights>;

export function getJobMatchWeights(objective: GoalObjective): JobMatchWeights {
  return JOB_MATCH_WEIGHTS[objective];
}
