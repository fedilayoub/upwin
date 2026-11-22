import { z } from 'zod';

export const PROFILE_SUGGESTION_STYLES = [
  'concise',
  'technical',
  'premium',
  'conversational',
] as const;

export const PROFILE_SUGGESTION_FIELDS = [
  'title',
  'overview',
  'skills',
  'portfolio',
  'employment',
] as const;

export const PROFILE_SUGGESTION_KINDS = ['rewrite', 'fill'] as const;

/**
 * Upwork's own limit on the profile title field. A longer rewrite is not a
 * style problem, it is uncopyable: the user cannot paste it in.
 */
export const UPWORK_TITLE_MAX_LENGTH = 70;

export const profileSuggestionStyleSchema = z.enum(PROFILE_SUGGESTION_STYLES);
export const profileSuggestionFieldSchema = z.enum(PROFILE_SUGGESTION_FIELDS);
export const profileSuggestionKindSchema = z.enum(PROFILE_SUGGESTION_KINDS);

export const createProfileSuggestionRequestSchema = z
  .object({ style: profileSuggestionStyleSchema.nullable().default(null) })
  .strict();

export const updateRecommendationStatusSchema = z
  .object({ status: z.enum(['copied', 'dismissed']) })
  .strict();

const profileSuggestionBaseDomainShape = {
  field: profileSuggestionFieldSchema.nullable(),
  itemIndex: z.number().int().nonnegative().nullable(),
  explanation: z.string().trim().min(1).max(2_000),
  impact: z.enum(['high', 'medium', 'low']),
};

export const profileSuggestionRewriteDomainSchema = z
  .object({
    ...profileSuggestionBaseDomainShape,
    kind: z.literal('rewrite'),
    suggestedValue: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const profileSuggestionFillDomainSchema = z
  .object({
    ...profileSuggestionBaseDomainShape,
    kind: z.literal('fill'),
    guidance: z.string().trim().min(1).max(2_000),
    items: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
  })
  .strict();

export const profileSuggestionDomainSchema = z.discriminatedUnion('kind', [
  profileSuggestionRewriteDomainSchema,
  profileSuggestionFillDomainSchema,
]);

export type ProfileSuggestionStyle = z.output<
  typeof profileSuggestionStyleSchema
>;
export type PersistedSuggestionStyle = ProfileSuggestionStyle | 'default';
export type ProfileSuggestionField = z.output<
  typeof profileSuggestionFieldSchema
>;
export type ProfileSuggestionKind = z.output<
  typeof profileSuggestionKindSchema
>;
export type ProfileSuggestionDraft = z.output<
  typeof profileSuggestionDomainSchema
>;
export type ProfileSuggestionRewriteDraft = z.output<
  typeof profileSuggestionRewriteDomainSchema
>;
export type ProfileSuggestionFillDraft = z.output<
  typeof profileSuggestionFillDomainSchema
>;
export type CreateProfileSuggestionRequest = z.output<
  typeof createProfileSuggestionRequestSchema
>;
export type RecommendationActionStatus = z.output<
  typeof updateRecommendationStatusSchema
>['status'];
