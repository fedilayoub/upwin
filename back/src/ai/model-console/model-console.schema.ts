import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MODEL_SELECTABLE_CAPABILITIES } from '../capabilities';

export const modelSelectableCapabilitySchema = z.enum(
  MODEL_SELECTABLE_CAPABILITIES,
);

export const setCapabilityModelsSchema = z
  .object({
    primaryModelId: z.string().trim().min(1),
    fallbackModelId: z.string().trim().min(1),
    notes: z.string().trim().min(1).max(2_000).nullable().optional(),
  })
  .strict();

export class SetCapabilityModelsDto extends createZodDto(
  setCapabilityModelsSchema,
) {}
