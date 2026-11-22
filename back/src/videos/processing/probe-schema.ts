import { z } from 'zod';
export const probeSchema = z.object({
  format: z.object({
    format_name: z.string().optional(),
    duration: z.string().optional(),
  }),
  streams: z.array(
    z.object({
      codec_type: z.string(),
      codec_name: z.string().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    }),
  ),
});
export type ProbeResult = z.infer<typeof probeSchema>;
