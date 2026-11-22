import { z } from 'zod';
import { GOAL_OBJECTIVES } from '../../goals/goal.schema';
import { PROFILE_SECTION_IDS } from '../../profile/profile-section';
import {
  profileRubricV1,
  RUBRIC_ANCHOR_SCORES,
} from '../../profile/analysis/rubric/upwork-profile-v1';

const editableText = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine(
      (value) => !/[<>]/u.test(value) && !/<\/[^>]+>/u.test(value),
      'Editable prompt text cannot contain angle brackets or closing tags.',
    );

const goalStrategyShape = Object.fromEntries(
  GOAL_OBJECTIVES.map((objective) => [objective, editableText(600)]),
) as Record<(typeof GOAL_OBJECTIVES)[number], ReturnType<typeof editableText>>;

export const AI_PROFILE_CRITERION_IDS = PROFILE_SECTION_IDS.flatMap((sectionId) =>
  profileRubricV1[sectionId].criteria
    .filter((criterion) => criterion.source === 'ai')
    .map((criterion) => criterion.id),
);

const anchorShape = Object.fromEntries(
  RUBRIC_ANCHOR_SCORES.map((score) => [String(score), editableText(400)]),
) as Record<
  `${(typeof RUBRIC_ANCHOR_SCORES)[number]}`,
  ReturnType<typeof editableText>
>;
const criterionAnchorSchema = z.object(anchorShape).strict();
const criterionAnchorShape = Object.fromEntries(
  AI_PROFILE_CRITERION_IDS.map((criterionId) => [
    criterionId,
    criterionAnchorSchema,
  ]),
) as Record<string, typeof criterionAnchorSchema>;

export const analyzerTemplateContentSchema = z
  .object({
    systemPersona: editableText(2_000),
    policy: editableText(4_000),
    goalStrategies: z.object(goalStrategyShape).strict(),
    criterionAnchors: z.object(criterionAnchorShape).strict(),
  })
  .strict();

export type AnalyzerTemplateContent = z.output<
  typeof analyzerTemplateContentSchema
>;
