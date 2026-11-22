import { z } from 'zod';

const providerSchema = z
  .object({ providerId: z.string().trim().min(1) })
  .passthrough();

export const gatewayModelCatalogEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    display_name: z.string().trim().min(1).optional(),
    family: z.string().trim().min(1),
    pricing: z
      .object({
        prompt: z.string().trim().min(1),
        completion: z.string().trim().min(1),
      })
      .passthrough(),
    context_length: z.number().nonnegative(),
    json_output: z.boolean(),
    structured_outputs: z.boolean(),
    providers: z.array(providerSchema),
    deprecated_at: z.iso.datetime().optional(),
    deactivated_at: z.iso.datetime().optional(),
    max_output: z.number().nonnegative().optional(),
    aliases: z.array(z.string()).optional(),
    stability: z.string().optional(),
  })
  .passthrough();

export const gatewayModelCatalogSchema = z
  .object({ data: z.array(z.unknown()) })
  .passthrough();

export type GatewayModelCatalogEntry = z.infer<
  typeof gatewayModelCatalogEntrySchema
>;
