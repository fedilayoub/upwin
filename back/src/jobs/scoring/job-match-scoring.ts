import { AiEvaluationError } from '../../ai/model-registry.service';
import type { JobMatchEvaluation } from '../../ai/schemas/job-match.schema';
import type { JobFacts } from '../analysis/deterministic/job-facts';
import {
  jobMatchRubricV1,
  type JobDeterministicMetric,
  type JobMatchAiCriterion,
} from '../analysis/rubric/job-match-v1';
import {
  JOB_MATCH_DIMENSION_IDS,
  type JobMatchDimensionId,
} from '../job-match-dimension';
import type { JobMatchWeights } from './weights/job-match-weights';

export interface JobCriterionEvidence {
  id: string;
  label: string;
  evidence: string[];
}

export interface JobDimensionScore {
  id: JobMatchDimensionId;
  score: number;
  criteria: JobCriterionEvidence[];
}

export interface JobMatchScore {
  dimensionScores: JobDimensionScore[];
  matchScore: number;
}

export class InvalidJobMatchCriterionScoreError extends Error {
  constructor(
    dimensionId: JobMatchDimensionId,
    criterionName: string,
    score: number,
  ) {
    super(
      `AI criterion ${dimensionId}.${criterionName} must be an integer from 0 through 100; received ${score}.`,
    );
    this.name = 'InvalidJobMatchCriterionScoreError';
  }
}

export function scoreJobMatch(
  evaluation: Pick<JobMatchEvaluation, 'dimensions'>,
  facts: JobFacts,
  weights: JobMatchWeights,
): JobMatchScore {
  validateAiEvaluation(evaluation);
  const dimensionScores = JOB_MATCH_DIMENSION_IDS.map((dimensionId) => ({
    id: dimensionId,
    score: scoreDimension(dimensionId, evaluation, facts),
    criteria: criterionEvidence(dimensionId, evaluation, facts),
  }));
  const unavailable = facts.budgetFit.score === null ? ['budget'] as const : [];
  const resolvedWeights = redistributeUnavailableWeights(weights, unavailable);
  const matchScore = Math.round(
    dimensionScores.reduce(
      (total, dimension) =>
        total + dimension.score * resolvedWeights[dimension.id],
      0,
    ),
  );

  return { dimensionScores, matchScore };
}

export function redistributeUnavailableWeights(
  weights: JobMatchWeights,
  unavailableDimensions: readonly JobMatchDimensionId[],
): JobMatchWeights {
  const unavailable = new Set(unavailableDimensions);
  const available = JOB_MATCH_DIMENSION_IDS.filter(
    (dimensionId) => !unavailable.has(dimensionId),
  );
  const availableWeight = available.reduce(
    (total, dimensionId) => total + weights[dimensionId],
    0,
  );
  if (availableWeight <= 0) {
    throw new Error('At least one job-match dimension must remain available.');
  }

  const redistributed = Object.fromEntries(
    JOB_MATCH_DIMENSION_IDS.map((dimensionId) => [dimensionId, 0]),
  ) as JobMatchWeights;
  let assigned = 0;
  available.forEach((dimensionId, index) => {
    const value =
      index === available.length - 1
        ? 1 - assigned
        : weights[dimensionId] / availableWeight;
    redistributed[dimensionId] = value;
    assigned += value;
  });
  return redistributed;
}

function scoreDimension(
  dimensionId: JobMatchDimensionId,
  evaluation: Pick<JobMatchEvaluation, 'dimensions'>,
  facts: JobFacts,
): number {
  if (dimensionId === 'budget' && facts.budgetFit.score === null) {
    // The contract requires all five dimension ids and integer scores. Fifty is
    // an explicit display-neutral value; its redistributed match weight is zero.
    return 50;
  }
  const modelDimension = evaluation.dimensions.find(
    (dimension) => dimension.id === dimensionId,
  );
  const weightedScore = jobMatchRubricV1[dimensionId].criteria.reduce(
    (total, criterion) => {
      const criterionScore =
        criterion.source === 'deterministic'
          ? deterministicScore(criterion.metric, facts)
          : requiredAiScore(modelDimension, dimensionId, criterion.id);
      return total + criterionScore * criterion.weight;
    },
    0,
  );
  return clampScore(Math.round(weightedScore));
}

function criterionEvidence(
  dimensionId: JobMatchDimensionId,
  evaluation: Pick<JobMatchEvaluation, 'dimensions'>,
  facts: JobFacts,
): JobCriterionEvidence[] {
  const modelDimension = evaluation.dimensions.find(
    (dimension) => dimension.id === dimensionId,
  );

  return jobMatchRubricV1[dimensionId].criteria.map((criterion) => {
    if (criterion.source === 'ai') {
      const modelCriterion = modelDimension?.criteria.find(
        (candidate) => candidate.name === criterion.id,
      );
      if (!modelCriterion) {
        throw incompleteEvaluation(
          `Missing criterion for ${dimensionId}: ${criterion.id}.`,
        );
      }
      return {
        id: criterion.id,
        label: criterion.label,
        evidence: [...modelCriterion.evidence],
      };
    }

    return {
      id: criterion.id,
      label: criterion.label,
      evidence: deterministicEvidence(criterion.metric, facts),
    };
  });
}

function validateAiEvaluation(
  evaluation: Pick<JobMatchEvaluation, 'dimensions'>,
): void {
  const seenDimensions = new Set<JobMatchDimensionId>();

  for (const dimension of evaluation.dimensions) {
    const expected = expectedAiCriteria(dimension.id);
    if (expected.length === 0) {
      throw incompleteEvaluation(
        `Dimension ${dimension.id} has no AI criteria and must not be returned by the model.`,
      );
    }
    if (seenDimensions.has(dimension.id)) {
      throw incompleteEvaluation(`Duplicate dimension: ${dimension.id}.`);
    }
    seenDimensions.add(dimension.id);
    const expectedNames = new Set(expected.map((criterion) => criterion.id));
    const seenNames = new Set<string>();

    for (const criterion of dimension.criteria) {
      if (!expectedNames.has(criterion.name)) {
        throw incompleteEvaluation(
          `Unknown criterion for ${dimension.id}: ${criterion.name}.`,
        );
      }
      if (seenNames.has(criterion.name)) {
        throw incompleteEvaluation(
          `Duplicate criterion for ${dimension.id}: ${criterion.name}.`,
        );
      }
      seenNames.add(criterion.name);
      if (
        !Number.isFinite(criterion.score) ||
        !Number.isInteger(criterion.score) ||
        criterion.score < 0 ||
        criterion.score > 100
      ) {
        throw new InvalidJobMatchCriterionScoreError(
          dimension.id,
          criterion.name,
          criterion.score,
        );
      }
    }

    for (const expectedCriterion of expected) {
      if (!seenNames.has(expectedCriterion.id)) {
        throw incompleteEvaluation(
          `Missing criterion for ${dimension.id}: ${expectedCriterion.id}.`,
        );
      }
    }
  }

  for (const dimensionId of JOB_MATCH_DIMENSION_IDS) {
    if (
      expectedAiCriteria(dimensionId).length > 0 &&
      !seenDimensions.has(dimensionId)
    ) {
      throw incompleteEvaluation(`Missing dimension: ${dimensionId}.`);
    }
  }
}

function expectedAiCriteria(
  dimensionId: JobMatchDimensionId,
): readonly JobMatchAiCriterion[] {
  return jobMatchRubricV1[dimensionId].criteria.flatMap(
    (criterion) => (criterion.source === 'ai' ? [criterion] : []),
  );
}

function requiredAiScore(
  modelDimension: JobMatchEvaluation['dimensions'][number] | undefined,
  dimensionId: JobMatchDimensionId,
  criterionId: string,
): number {
  const criterion = modelDimension?.criteria.find(
    (candidate) => candidate.name === criterionId,
  );
  if (!criterion) {
    throw incompleteEvaluation(
      `Missing criterion for ${dimensionId}: ${criterionId}.`,
    );
  }
  return criterion.score;
}

function deterministicScore(
  metric: JobDeterministicMetric,
  facts: JobFacts,
): number {
  switch (metric) {
    case 'skillCoverage':
      return facts.skillCoverage.score;
    case 'evidenceDepth':
      return facts.evidenceDepth.score;
    case 'budgetFit':
      return facts.budgetFit.score ?? 50;
  }
}

function deterministicEvidence(
  metric: JobDeterministicMetric,
  facts: JobFacts,
): string[] {
  switch (metric) {
    case 'skillCoverage':
      return facts.skillCoverage.matchedSkills.length > 0
        ? facts.skillCoverage.matchedSkills
        : ['No published job skill matched the confirmed context or latest profile snapshot.'];
    case 'evidenceDepth':
      return facts.evidenceDepth.matchingProjects.length > 0
        ? facts.evidenceDepth.matchingProjects
        : ['No confirmed portfolio project shares a job title or skill token.'];
    case 'budgetFit':
      return facts.budgetFit.evidence;
  }
}

function incompleteEvaluation(message: string): AiEvaluationError {
  return new AiEvaluationError(new Error(message));
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}
