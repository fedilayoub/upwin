import type { ProfileEvaluation } from '../../ai/schemas/profile-evaluation.schema';
import { AiEvaluationError } from '../../ai/model-registry.service';
import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import {
  profileRubricV1,
  type DeterministicMetric,
} from '../analysis/rubric/upwork-profile-v1';
import { PROFILE_SECTION_IDS, type ProfileSectionId } from '../profile-section';
import type { ScoringWeights } from './weights/scoring-weights';

export interface SectionScore {
  id: ProfileSectionId;
  score: number;
  criteria: CriterionEvidence[];
}

export interface CriterionEvidence {
  id: string;
  label: string;
  evidence: string[];
}

export interface ProfileScore {
  sectionScores: SectionScore[];
  winningScore: number;
}

export class InvalidAiCriterionScoreError extends Error {
  constructor(
    sectionId: ProfileSectionId,
    criterionName: string,
    score: number,
  ) {
    super(
      `AI criterion ${sectionId}.${criterionName} must be an integer from 0 through 100; received ${score}.`,
    );
    this.name = 'InvalidAiCriterionScoreError';
  }
}

export function scoreProfile(
  evaluation: Pick<ProfileEvaluation, 'sections'>,
  facts: ProfileFacts,
  weights: ScoringWeights,
): ProfileScore {
  validateAiScores(evaluation);

  const sectionScores = PROFILE_SECTION_IDS.map((sectionId) => ({
    id: sectionId,
    score: scoreSection(sectionId, evaluation, facts),
    criteria: criterionEvidence(sectionId, evaluation),
  }));
  const winningScore = Math.round(
    sectionScores.reduce(
      (total, section) => total + section.score * weights[section.id],
      0,
    ),
  );

  return { sectionScores, winningScore };
}

function criterionEvidence(
  sectionId: ProfileSectionId,
  evaluation: Pick<ProfileEvaluation, 'sections'>,
): CriterionEvidence[] {
  const modelSection = evaluation.sections.find(
    (section) => section.id === sectionId,
  );
  if (!modelSection) {
    throw incompleteAiEvaluation(`Missing section: ${sectionId}.`);
  }

  return profileRubricV1[sectionId].criteria.flatMap((criterion) => {
    if (criterion.source !== 'ai') return [];
    const modelCriterion = modelSection.criteria.find(
      (item) => item.name === criterion.id,
    );
    if (!modelCriterion) {
      throw incompleteAiEvaluation(
        `Missing criterion for ${sectionId}: ${criterion.id}.`,
      );
    }
    return [
      {
        id: criterion.id,
        label: criterion.label,
        evidence: [...modelCriterion.evidence],
      },
    ];
  });
}

function scoreSection(
  sectionId: ProfileSectionId,
  evaluation: Pick<ProfileEvaluation, 'sections'>,
  facts: ProfileFacts,
): number {
  if (!isSectionApplicable(sectionId, facts)) return 0;

  const modelSection = evaluation.sections.find(
    (section) => section.id === sectionId,
  );
  if (!modelSection) {
    throw incompleteAiEvaluation(`Missing section: ${sectionId}.`);
  }
  const criteria = profileRubricV1[sectionId].criteria;

  const weightedScore = criteria.reduce((total, criterion) => {
    const score =
      criterion.source === 'deterministic'
        ? deterministicScore(criterion.metric, sectionId, facts)
        : requiredCriterionScore(modelSection, criterion.id);
    return total + score * criterion.weight;
  }, 0);

  return clampScore(Math.round(weightedScore));
}

function validateAiScores(
  evaluation: Pick<ProfileEvaluation, 'sections'>,
): void {
  const sectionsById = new Map<
    ProfileSectionId,
    ProfileEvaluation['sections'][number]
  >();

  for (const section of evaluation.sections) {
    if (sectionsById.has(section.id)) {
      throw incompleteAiEvaluation(`Duplicate section: ${section.id}.`);
    }
    sectionsById.set(section.id, section);

    const expectedCriteria = new Set(
      profileRubricV1[section.id].criteria
        .filter((criterion) => criterion.source === 'ai')
        .map((criterion) => criterion.id),
    );
    const seenCriteria = new Set<string>();

    for (const criterion of section.criteria) {
      if (!expectedCriteria.has(criterion.name)) {
        throw incompleteAiEvaluation(
          `Unknown criterion for ${section.id}: ${criterion.name}.`,
        );
      }
      if (seenCriteria.has(criterion.name)) {
        throw incompleteAiEvaluation(
          `Duplicate criterion for ${section.id}: ${criterion.name}.`,
        );
      }
      seenCriteria.add(criterion.name);

      if (
        !Number.isFinite(criterion.score) ||
        !Number.isInteger(criterion.score) ||
        criterion.score < 0 ||
        criterion.score > 100
      ) {
        throw new InvalidAiCriterionScoreError(
          section.id,
          criterion.name,
          criterion.score,
        );
      }
    }

    for (const criterionName of expectedCriteria) {
      if (!seenCriteria.has(criterionName)) {
        throw incompleteAiEvaluation(
          `Missing criterion for ${section.id}: ${criterionName}.`,
        );
      }
    }
  }

  for (const sectionId of PROFILE_SECTION_IDS) {
    if (!sectionsById.has(sectionId)) {
      throw incompleteAiEvaluation(`Missing section: ${sectionId}.`);
    }
  }
}

function requiredCriterionScore(
  section: ProfileEvaluation['sections'][number],
  criterionName: string,
): number {
  const criterion = section.criteria.find(
    (item) => item.name === criterionName,
  );
  if (!criterion) {
    throw incompleteAiEvaluation(
      `Missing criterion for ${section.id}: ${criterionName}.`,
    );
  }
  return criterion.score;
}

function incompleteAiEvaluation(message: string): AiEvaluationError {
  return new AiEvaluationError(new Error(message));
}

function isSectionApplicable(
  sectionId: ProfileSectionId,
  facts: ProfileFacts,
): boolean {
  switch (sectionId) {
    case 'positioning':
      return facts.presence.title || facts.presence.overview;
    case 'overview':
      return facts.presence.overview;
    case 'title':
      return facts.presence.title;
    case 'skills':
      return facts.presence.skills;
    case 'portfolio':
      return facts.presence.portfolio;
    case 'experience':
      return facts.presence.employment || facts.presence.education;
    case 'trust':
      return (
        facts.presence.portfolio ||
        facts.presence.employment ||
        facts.presence.education ||
        facts.presence.certifications ||
        facts.presence.languages
      );
    case 'goalAlignment':
      return !facts.emptyProfile;
  }
}

function deterministicScore(
  metric: DeterministicMetric,
  sectionId: ProfileSectionId,
  facts: ProfileFacts,
): number {
  switch (metric) {
    case 'presence':
      return sectionId === 'title'
        ? booleanScore(facts.presence.title)
        : booleanScore(facts.presence.overview);
    case 'targetKeywordCoverage':
      return facts.targetKeywords.coverage;
    case 'skillsDepth':
      return depthScore(facts.counts.skills, [1, 3, 6, 10]);
    case 'portfolioDepth':
      return depthScore(facts.counts.portfolio, [1, 2, 3, 5]);
    case 'experienceCompleteness':
      return (
        booleanScore(facts.presence.employment) * 0.7 +
        booleanScore(facts.presence.education) * 0.3
      );
    case 'trustCompleteness': {
      const signals = [
        facts.presence.portfolio,
        facts.presence.employment,
        facts.presence.education,
        facts.presence.certifications,
        facts.presence.languages,
      ].filter(Boolean).length;
      return signals * 20;
    }
  }
}

export function depthScore(
  count: number,
  thresholds: readonly [number, number, number, number],
): number {
  if (count < thresholds[0]) return 0;
  if (count < thresholds[1]) return 25;
  if (count < thresholds[2]) return 50;
  if (count < thresholds[3]) return 75;
  return 100;
}

function booleanScore(value: boolean): number {
  return value ? 100 : 0;
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}
