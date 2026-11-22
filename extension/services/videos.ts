import { z } from "zod";
import { apiClient, type TokenProvider } from "./api";
import type {
  CreateVideoRequest,
  CompleteVideoRequest,
  UpdateVideoRequest,
  PresignPartsRequest,
} from "@/types/video";

const count = z.number().int().nonnegative();
const positive = z.number().int().positive();
const date = z.iso.datetime({ offset: true });
export const videoSchema = z.object({
  id: z.uuid(),
  slug: z.string().regex(/^[0-9A-Za-z]{12}$/),
  shareUrl: z.url(),
  title: z.string().trim().min(1).max(120),
  status: z.enum(["uploading", "processing", "ready", "failed"]),
  failureReason: z
    .enum(["upload_abandoned", "invalid_media", "too_long", "processing_error"])
    .nullable(),
  sourceKind: z.enum(["screen", "window", "tab", "area"]),
  hasCamera: z.boolean(),
  hasAudio: z.boolean(),
  durationMs: count.nullable(),
  width: positive.nullable(),
  height: positive.nullable(),
  sizeBytes: count.nullable(),
  thumbnailUrl: z.url().nullable(),
  jobSnapshotId: z.uuid().nullable(),
  viewCount: count,
  // Watch stats. Defaults keep an older API readable.
  finishedViews: count.default(0),
  averageWatchedPercent: z.number().min(0).max(100).nullable().default(null),
  watchTimeMs: count.default(0),
  lastViewedAt: date.nullable(),
  createdAt: date,
  readyAt: date.nullable(),
});
export const limitsSchema = z.object({
  available: z.boolean(),
  storage: z.object({ usedBytes: count }),
  maxDurationMs: positive,
  maxBytes: positive,
});
export const createSchema = z.object({
  video: videoSchema,
  upload: z.object({
    partSizeBytes: positive,
    maxParts: positive,
    maxBytes: positive,
    maxDurationMs: positive,
  }),
});
export const presignSchema = z.object({
  parts: z.array(
    z.object({ partNumber: positive, url: z.url(), expiresAt: date }),
  ),
});
export const uploadedSchema = z.object({
  parts: z.array(
    z.object({
      partNumber: positive,
      sizeBytes: positive,
      etag: z.string().min(1),
    }),
  ),
});
export const listSchema = z.object({
  items: z.array(videoSchema),
  nextCursor: z.string().nullable(),
});
const wrapped = z.object({ video: videoSchema });
export interface VideoListQuery {
  cursor?: string;
  limit?: number;
  jobSnapshotId?: string;
}
const idPath = (id: string) => `/videos/${z.uuid().parse(id)}`;
async function request<T>(
  path: string,
  method: string,
  schema: z.ZodType<T>,
  getToken: TokenProvider,
  body?: unknown,
): Promise<T> {
  const result = await apiClient.request<unknown>(path, {
    method,
    getToken,
    operation: `${method} ${path.split("?")[0]}`,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return schema.parse(result);
}
export const videosService = {
  getLimits: (token: TokenProvider) =>
    request("/videos/limits", "GET", limitsSchema, token),
  create: (body: CreateVideoRequest, token: TokenProvider) =>
    request("/videos", "POST", createSchema, token, body),
  presignParts: (id: string, body: PresignPartsRequest, token: TokenProvider) =>
    request(`${idPath(id)}/upload-parts`, "POST", presignSchema, token, body),
  listUploadedParts: (id: string, token: TokenProvider) =>
    request(`${idPath(id)}/upload-parts`, "GET", uploadedSchema, token),
  complete: (id: string, body: CompleteVideoRequest, token: TokenProvider) =>
    request(`${idPath(id)}/complete`, "POST", wrapped, token, body),
  abortUpload: (id: string, token: TokenProvider) =>
    request(`${idPath(id)}/upload`, "DELETE", z.undefined(), token),
  list: (query: VideoListQuery, token: TokenProvider) => {
    const params = new URLSearchParams();
    if (query.cursor) params.set("cursor", query.cursor);
    if (query.limit !== undefined)
      params.set(
        "limit",
        String(z.number().int().min(1).max(50).parse(query.limit)),
      );
    if (query.jobSnapshotId)
      params.set("jobSnapshotId", z.uuid().parse(query.jobSnapshotId));
    return request(
      `/videos${params.size ? `?${params}` : ""}`,
      "GET",
      listSchema,
      token,
    );
  },
  get: (id: string, token: TokenProvider) =>
    request(idPath(id), "GET", wrapped, token),
  rename: (id: string, body: UpdateVideoRequest, token: TokenProvider) =>
    request(idPath(id), "PATCH", wrapped, token, body),
  remove: (id: string, token: TokenProvider) =>
    request(idPath(id), "DELETE", z.undefined(), token),
};
