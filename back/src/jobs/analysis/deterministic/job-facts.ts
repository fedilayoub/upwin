import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';
import type { GoalResponse } from '../../../goals/goals.service';
import type { JobSnapshot } from '../../../job-snapshots/job-snapshot.schema';
import {
  containsToken,
  normalize,
} from '../../../profile/analysis/deterministic/profile-facts';
import { depthScore } from '../../../profile/scoring/profile-scoring';

export interface JobFacts {
  skillCoverage: {
    score: number;
    matchedSkills: string[];
    unmatchedSkills: string[];
  };
  evidenceDepth: {
    score: number;
    matchingProjects: string[];
  };
  budgetFit: {
    score: number | null;
    evidence: string[];
  };
}

const JOB_TOKEN_STOP_WORDS = new Set([
  'and',
  'for',
  'from',
  'the',
  'with',
  'your',
  'this',
  'that',
  'into',
  'our',
  'you',
  'developer',
  'engineer',
  'specialist',
]);

export function inspectJob(
  snapshot: JobSnapshot,
  context: FreelancerContextFields,
  goal: Pick<GoalResponse, 'targetRate'>,
  newestProfileSkills: readonly string[] = [],
): JobFacts {
  return {
    skillCoverage: computeSkillCoverage(
      snapshot,
      context.skills,
      newestProfileSkills,
    ),
    evidenceDepth: computeEvidenceDepth(snapshot, context),
    budgetFit: computeBudgetFit(snapshot, context, goal),
  };
}

function computeSkillCoverage(
  snapshot: JobSnapshot,
  contextSkills: readonly string[],
  profileSkills: readonly string[],
): JobFacts['skillCoverage'] {
  const freelancerSkills = [...new Set([...contextSkills, ...profileSkills])]
    .map(normalize)
    .filter((skill) => skill.length > 0);
  let matchedWeight = 0;
  let totalWeight = 0;
  const matchedSkills: string[] = [];
  const unmatchedSkills: string[] = [];

  for (const skill of snapshot.job.skills) {
    const weight = skill.relevance === 'mandatory' ? 2 : 1;
    const normalizedJobSkill = normalize(skill.name);
    const matched = freelancerSkills.some(
      (candidate) =>
        candidate === normalizedJobSkill ||
        containsToken(candidate, normalizedJobSkill) ||
        containsToken(normalizedJobSkill, candidate),
    );

    totalWeight += weight;
    if (matched) {
      matchedWeight += weight;
      matchedSkills.push(skill.name);
    } else {
      unmatchedSkills.push(skill.name);
    }
  }

  return {
    score:
      totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100),
    matchedSkills,
    unmatchedSkills,
  };
}

function computeEvidenceDepth(
  snapshot: JobSnapshot,
  context: FreelancerContextFields,
): JobFacts['evidenceDepth'] {
  const jobTokens = extractJobTokens(snapshot);
  const matchingProjects = context.portfolio.flatMap((project, index) => {
    const projectText = normalize(
      [project.title, project.description, ...project.skills]
        .filter((value): value is string => value !== undefined)
        .join(' '),
    );
    const matches = jobTokens.some((token) =>
      containsToken(projectText, token),
    );
    if (!matches) return [];
    return [project.title ?? `Portfolio project ${index + 1}`];
  });

  return {
    score: depthScore(matchingProjects.length, [1, 2, 3, 5]),
    matchingProjects,
  };
}

function extractJobTokens(snapshot: JobSnapshot): string[] {
  const tokens = new Set<string>();
  const source = [snapshot.job.title, ...snapshot.job.skills.map((skill) => skill.name)];

  for (const value of source) {
    for (const token of normalize(value).split(/[^a-z0-9+#.]+/u)) {
      if (token.length < 2 || JOB_TOKEN_STOP_WORDS.has(token)) continue;
      tokens.add(token);
    }
  }

  return [...tokens];
}

function computeBudgetFit(
  snapshot: JobSnapshot,
  context: FreelancerContextFields,
  goal: Pick<GoalResponse, 'targetRate'>,
): JobFacts['budgetFit'] {
  const publishedBudget = readPublishedBudget(snapshot);
  if (!publishedBudget) {
    return {
      score: null,
      evidence: ['The job does not publish a usable budget.'],
    };
  }

  const targets = [
    context.positioning.targetRate,
    goal.targetRate?.min ?? goal.targetRate?.max,
  ].filter((value): value is number => value !== undefined);
  if (targets.length === 0) {
    return {
      score: 50,
      evidence: [
        `${publishedBudget.label}; no target rate is configured, so budget fit is neutral.`,
      ],
    };
  }

  // Conflicting targets should not silently lower the user's floor. The active
  // goal and confirmed positioning must both be respected, so use the stricter
  // published target.
  const targetMinimum = Math.max(...targets);
  const score =
    publishedBudget.maximum >= targetMinimum || targetMinimum === 0
      ? 100
      : Math.round((publishedBudget.maximum / targetMinimum) * 100);

  return {
    score: clampScore(score),
    evidence: [
      publishedBudget.label,
      `Configured target floor: ${targetMinimum}.`,
    ],
  };
}

function readPublishedBudget(
  snapshot: JobSnapshot,
): { maximum: number; label: string } | null {
  const { engagement } = snapshot.job;
  if (engagement.budgetType === 'fixed' && engagement.fixedBudget) {
    return {
      maximum: engagement.fixedBudget.amount,
      label: `Published fixed budget: ${engagement.fixedBudget.amount} ${engagement.fixedBudget.currency}.`,
    };
  }
  if (engagement.budgetType === 'hourly' && engagement.hourlyBudget) {
    const maximum = engagement.hourlyBudget.max ?? engagement.hourlyBudget.min;
    if (maximum === undefined) return null;
    const minimum = engagement.hourlyBudget.min ?? maximum;
    return {
      maximum,
      label: `Published hourly budget: ${minimum}-${maximum} ${engagement.hourlyBudget.currency}.`,
    };
  }
  return null;
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}
