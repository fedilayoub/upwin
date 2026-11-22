import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AI_CAPABILITIES } from '../capabilities';
import { analyzerTemplateContentSchema } from '../prompts/prompt-template.schema';

export const promptCapabilitySchema = z.enum(AI_CAPABILITIES);
const notesSchema = z.string().trim().min(1).max(2_000).nullable();

export const createPromptRevisionSchema = z
  .object({
    content: analyzerTemplateContentSchema,
    notes: notesSchema.optional().default(null),
  })
  .strict();

export const updatePromptRevisionSchema = z
  .object({
    content: analyzerTemplateContentSchema,
    notes: notesSchema.optional().default(null),
  })
  .strict();

export type CreatePromptRevision = z.output<
  typeof createPromptRevisionSchema
>;
export type UpdatePromptRevision = z.output<
  typeof updatePromptRevisionSchema
>;

export class CreatePromptRevisionDto extends createZodDto(
  createPromptRevisionSchema,
) {}
export class UpdatePromptRevisionDto extends createZodDto(
  updatePromptRevisionSchema,
) {}
