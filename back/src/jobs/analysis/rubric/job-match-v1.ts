import type { JobMatchDimensionId } from '../../job-match-dimension';

export const jobMatchRubricVersion = 'job-match-rubric-v1' as const;
export const JOB_MATCH_ANCHOR_SCORES = [0, 25, 50, 75, 100] as const;

export type JobMatchAnchorScore =
  (typeof JOB_MATCH_ANCHOR_SCORES)[number];
export type JobDeterministicMetric =
  | 'skillCoverage'
  | 'evidenceDepth'
  | 'budgetFit';

export interface JobMatchAiCriterion {
  id: string;
  label: string;
  source: 'ai';
  weight: number;
  anchors: Record<JobMatchAnchorScore, string>;
}

export interface JobMatchDeterministicCriterion {
  id: string;
  label: string;
  source: 'deterministic';
  weight: number;
  metric: JobDeterministicMetric;
}

export type JobMatchCriterion =
  | JobMatchAiCriterion
  | JobMatchDeterministicCriterion;

export interface JobMatchDimensionRubric {
  label: string;
  criteria: readonly JobMatchCriterion[];
}

const anchored = (
  id: string,
  label: string,
  weight: number,
  anchors: Record<JobMatchAnchorScore, string>,
): JobMatchAiCriterion => ({
  id,
  label,
  source: 'ai',
  weight,
  anchors,
});

const deterministic = (
  id: string,
  label: string,
  weight: number,
  metric: JobDeterministicMetric,
): JobMatchDeterministicCriterion => ({
  id,
  label,
  source: 'deterministic',
  weight,
  metric,
});

export const jobMatchRubricV1 = {
  skills: {
    label: 'Skills',
    criteria: [
      deterministic('skillCoverage', 'Skill coverage', 0.5, 'skillCoverage'),
      anchored('skillDepth', 'Skill depth', 0.5, {
        0: "No supplied role or project shows use of any skill named by the job.",
        25: 'A job skill appears only in a freelancer skill list, with no supplied role or project showing its use.',
        50: 'One supplied role or project shows use of at least one job skill, but the responsibility or deliverable is not specific.',
        75: 'A named role or project shows specific use of multiple job skills in a relevant responsibility or deliverable.',
        100: 'Multiple named roles or projects show repeated use of the core job skills in specific responsibilities, deliverables, or results.',
      }),
    ],
  },
  domain: {
    label: 'Domain',
    criteria: [
      anchored('domainFit', 'Domain fit', 1, {
        0: "Nothing in the freelancer's context relates to this job's domain or product type.",
        25: 'Adjacent at best; the overlap is a shared tool, not shared problems.',
        50: 'Same broad field, different product type or user; transferable but not proven here.',
        75: 'Same product type or industry, with at least one named project in it.',
        100: 'Repeated, specific work on this exact product type for comparable users.',
      }),
    ],
  },
  experience: {
    label: 'Experience',
    criteria: [
      anchored('experienceRelevance', 'Experience relevance', 0.6, {
        0: 'No supplied role or project relates to the work, responsibility, or deliverable requested by the job.',
        25: 'A role is in the same broad field, but no supplied responsibility or deliverable matches the job.',
        50: 'One role or project is relevant to the requested work, but its supplied description gives only generic duties.',
        75: 'A named role or project includes a responsibility or deliverable that directly matches the job.',
        100: 'Multiple roles or projects form a repeated track record of directly matching responsibilities or deliverables, with supplied results or constraints handled.',
      }),
      deterministic(
        'evidenceDepth',
        'Relevant portfolio evidence',
        0.4,
        'evidenceDepth',
      ),
    ],
  },
  budget: {
    label: 'Budget',
    criteria: [deterministic('budgetFit', 'Budget fit', 1, 'budgetFit')],
  },
  goalAlignment: {
    label: 'Goal alignment',
    criteria: [
      anchored('goalFit', 'Goal fit', 1, {
        0: "The job's role and project type are outside the user's stated target work.",
        25: 'The job and goal share only a broad field, with no matching target role, project type, client type, or preferred skill.',
        50: 'The job matches either the target role or one target project type, but no second stated goal signal.',
        75: 'The job matches the target role or project type plus at least one stated client type or preferred skill.',
        100: 'The job directly matches the target role, project type, and at least two additional stated goal signals such as client type or preferred skills.',
      }),
    ],
  },
} as const satisfies Record<JobMatchDimensionId, JobMatchDimensionRubric>;
