import { z } from 'zod';
import {
  profileRubricV1,
  type AiRubricCriterion,
} from '../../profile/analysis/rubric/upwork-profile-v1';
import { PROFILE_SECTION_IDS } from '../../profile/profile-section';
import { PRIORITY_OUTCOME_STATUSES } from '../../profile/recommendations/verify-previous-priorities';

const criterionEvaluationSchema = z
  .object({
    name: z.string().min(1),
    // Model-facing numeric fields must remain plain z.number(). Range and
    // integer enforcement belongs to the pure scoring layer.
    score: z.number(),
    reasoning: z.string().min(1),
    evidence: z.array(z.string().min(1)),
  })
  .strict();

const sectionEvaluationSchema = z
  .object({
    id: z.enum(PROFILE_SECTION_IDS),
    criteria: z.array(criterionEvaluationSchema),
    strengths: z.array(z.string()),
    issues: z.array(z.string()),
  })
  .strict();

const criterionEvaluationV1Schema = z
  .object({
    name: z.string().min(1),
    score: z.number(),
    reasoning: z.string().min(1),
    evidence: z.array(z.string()),
  })
  .strict();

const sectionEvaluationV1Schema = z
  .object({
    id: z.enum(PROFILE_SECTION_IDS),
    criteria: z.array(criterionEvaluationV1Schema),
    strengths: z.array(z.string()),
    issues: z.array(z.string()),
  })
  .strict();

const evaluationPrioritySchema = z
  .object({
    section: z.enum(PROFILE_SECTION_IDS),
    recommendation: z.string().min(1),
    reason: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
  })
  .strict();

const evaluationPriorityV1Schema = z
  .object({
    section: z.enum(PROFILE_SECTION_IDS),
    impact: z.enum(['high', 'medium', 'low']),
    recommendation: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const profileEvaluationV1Shape = {
  summary: z.string().min(1).max(600),
  sections: z.array(sectionEvaluationV1Schema),
  priorities: z.array(evaluationPriorityV1Schema),
};

// Retained only so the committed analyzer cassette continues to verify the
// historical v1 response against the schema that produced it.
export const profileEvaluationV1Schema = z
  .object(profileEvaluationV1Shape)
  .strict();

const exhaustiveSectionsSchema = z
  .array(sectionEvaluationSchema)
  .length(PROFILE_SECTION_IDS.length)
  .superRefine((sections, context) => {
    const seenSections = new Set<string>();

    sections.forEach((section, sectionIndex) => {
      if (seenSections.has(section.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate section: ${section.id}.`,
          path: [sectionIndex, 'id'],
        });
      }
      seenSections.add(section.id);

      const expectedCriteria = profileRubricV1[section.id].criteria
        .filter(
          (criterion): criterion is AiRubricCriterion =>
            criterion.source === 'ai',
        )
        .map((criterion) => criterion.id);
      const expectedCriterionSet = new Set<string>(expectedCriteria);
      const seenCriteria = new Set<string>();

      section.criteria.forEach((criterion, criterionIndex) => {
        if (!expectedCriterionSet.has(criterion.name)) {
          context.addIssue({
            code: 'custom',
            message: `Unknown criterion for ${section.id}: ${criterion.name}.`,
            path: [sectionIndex, 'criteria', criterionIndex, 'name'],
          });
        }
        if (seenCriteria.has(criterion.name)) {
          context.addIssue({
            code: 'custom',
            message: `Duplicate criterion for ${section.id}: ${criterion.name}.`,
            path: [sectionIndex, 'criteria', criterionIndex, 'name'],
          });
        }
        seenCriteria.add(criterion.name);
      });

      for (const criterionName of expectedCriteria) {
        if (!seenCriteria.has(criterionName)) {
          context.addIssue({
            code: 'custom',
            message: `Missing criterion for ${section.id}: ${criterionName}.`,
            path: [sectionIndex, 'criteria'],
          });
        }
      }
    });

    for (const sectionId of PROFILE_SECTION_IDS) {
      if (!seenSections.has(sectionId)) {
        context.addIssue({
          code: 'custom',
          message: `Missing section: ${sectionId}.`,
        });
      }
    }
  });

const previousPriorityReviewSchema = z
  .object({
    // Model-facing numeric fields must remain plain z.number(); the ordinal is
    // range-checked when it is resolved back to a recommendation row.
    ref: z.number(),
    status: z.enum(PRIORITY_OUTCOME_STATUSES),
    note: z.string().min(1),
  })
  .strict();

const profileEvaluationShape = {
  summary: profileEvaluationV1Shape.summary,
  sections: exhaustiveSectionsSchema,
  priorities: z.array(evaluationPrioritySchema),
};

export const profileEvaluationSchema = z
  .object(profileEvaluationShape)
  .strict();

export type ProfileEvaluation = z.output<typeof profileEvaluationSchema>;
export type EvaluationPriority = ProfileEvaluation['priorities'][number];
export type PreviousPriorityReview = z.output<
  typeof previousPriorityReviewSchema
>;

export interface ProfileEvaluationWithReviews extends ProfileEvaluation {
  previousPriorityReviews?: PreviousPriorityReview[];
}

/**
 * The evaluation schema for one analysis.
 *
 * `previousPriorityCount` is fixed by the prompt, so the review array is
 * length-constrained in the schema rather than checked after the call.
 * `.length()` reaches the model as `minItems`/`maxItems`, which puts arity
 * inside `generateObject`'s retry loop and the primary-to-fallback path.
 * Validating it afterwards instead would let one malformed review fail an
 * entire analysis with no retry and nothing persisted.
 */
export function buildProfileEvaluationSchema(
  previousPriorityCount = 0,
): z.ZodType<ProfileEvaluationWithReviews> {
  if (previousPriorityCount === 0) return profileEvaluationSchema;

  return z
    .object({
      ...profileEvaluationShape,
      previousPriorityReviews: z
        .array(previousPriorityReviewSchema)
        .length(previousPriorityCount),
    })
    .strict();
}
