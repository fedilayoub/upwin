import { z } from 'zod';
import {
  UPWORK_TITLE_MAX_LENGTH,
  type ProfileSuggestionField,
} from '../../profile/suggestions/profile-suggestion.schema';

const SKILLS_ITEM_DESCRIPTION =
  'One Upwork skill-tag label and nothing else: the bare name of a skill, tool, or technology, at most five words, no sentence punctuation, never starting with a verb. For example "React" or "Tailwind CSS", never "Add React to your skills."';

const DEFAULT_ITEM_DESCRIPTION =
  'A concrete item to create or add, never a past-tense achievement or unverified existing case study.';

/**
 * Model-facing schema. The backend has already selected the field, item, and
 * suggestion kind. Conditional values are represented as null so every JSON
 * Schema property remains required for OpenAI strict structured output.
 * `stripModelNulls` removes the inactive branch before domain validation.
 *
 * The item description is field-dependent because a skills fill wants tag
 * labels while every other fill wants work to create. Describing both the same
 * way made the model write prose into the skills items, which the domain rules
 * then rejected with no way to retry.
 */
export function buildProfileSuggestionSchema(
  field: ProfileSuggestionField | null = null,
) {
  return z
    .object({
      suggestedValue: z
        .string()
        .nullable()
        .describe(
          field === 'title'
            ? `Complete replacement profile title for rewrite, at most ${UPWORK_TITLE_MAX_LENGTH} characters because Upwork rejects anything longer; null for fill.`
            : 'Complete replacement text for rewrite; null for fill.',
        ),
      guidance: z
        .string()
        .nullable()
        .describe(
          'Future-facing instructions for fill with no claims of completed work; null for rewrite.',
        ),
      items: z
        .array(
          z
            .string()
            .describe(
              field === 'skills'
                ? SKILLS_ITEM_DESCRIPTION
                : DEFAULT_ITEM_DESCRIPTION,
            ),
        )
        .nullable()
        .describe(
          field === 'skills'
            ? 'Non-empty list of Upwork skill-tag labels for fill; null for rewrite.'
            : 'Non-empty future work or additions for fill; null for rewrite.',
        ),
      explanation: z.string(),
      impact: z.enum(['high', 'medium', 'low']),
    })
    .strict();
}

export const profileSuggestionSchema = buildProfileSuggestionSchema();

export type ModelProfileSuggestion = z.output<typeof profileSuggestionSchema>;
