import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { VIDEO_SOURCE_KINDS } from '../database/schema';
const title = z.string().trim().min(1).max(120);
export const createVideoSchema = z.object({
  title: title.optional(),
  sourceKind: z.enum(VIDEO_SOURCE_KINDS),
  hasCamera: z.boolean(),
  hasAudio: z.boolean(),
  mimeType: z.literal('video/mp4'),
  jobSnapshotId: z.uuid().nullable().optional(),
});
export const presignPartsSchema = z.object({
  partNumbers: z.array(z.number().int()),
});
export const completeVideoSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int(),
        etag: z.string().min(1).max(1024),
      }),
    )
    .max(10000),
  clientDurationMs: z.number().nonnegative().finite(),
});
export const updateVideoSchema = z.object({ title });
export const videoCursorSchema = z
  .object({ createdAt: z.iso.datetime(), id: z.uuid() })
  .strict();
export const videoListSchema = z.object({
  cursor: z.string().max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  jobSnapshotId: z.uuid().optional(),
});
export class CreateVideoDto extends createZodDto(createVideoSchema) {}
export class PresignPartsDto extends createZodDto(presignPartsSchema) {}
export class CompleteVideoDto extends createZodDto(completeVideoSchema) {}
export class UpdateVideoDto extends createZodDto(updateVideoSchema) {}
export class VideoListDto extends createZodDto(videoListSchema) {}
/** Share-page progress for one view: distinct video time played, and whether it reached the end. */
export const viewProgressSchema = z.object({
  watchedMs: z.number().int().min(0).max(86_400_000),
  finished: z.boolean(),
});
